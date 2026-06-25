/* ============================================================================
   Bhram Realty — single server for the website + admin + database API
   ----------------------------------------------------------------------------
   One folder, one command (`npm start`). This server:
     - Serves the Bhram Realty website (index.html, projects.html, etc.).
     - Serves the admin panel at /admin/.
     - Serves uploaded project images at /uploads/.
     - Exposes a REST API under /api for projects, images and homepage control.
     - Serves a dynamic project detail page at /project/:id.

   GET endpoints are public (the website reads them). Write endpoints
   (POST/PUT/PATCH/DELETE) require a login token from /api/login.
   ============================================================================ */

// On Windows behind a corporate proxy, trust the OS certificate store so
// outbound HTTPS (Cloudinary) isn't blocked by SELF_SIGNED_CERT_IN_CHAIN.
// No-op on Linux hosts like Render.
if (process.platform === 'win32') {
    try { require('win-ca')({ inject: '+' }); } catch (_) { /* optional */ }
}
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./config');
const store = require('./db');
const cloud = require('./cloudinary');

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS on the API (harmless for same-origin; lets other local tools read it too)
app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// --------------------------------------------------------------- directories
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ------------------------------------------------------------------- uploads
// With Cloudinary configured we keep files in memory and stream them up to the
// CDN; otherwise we fall back to writing them into the local /uploads folder.
const storage = cloud.enabled
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOAD_DIR),
        filename: (req, file, cb) => {
            const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10);
            const unique = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
            cb(null, unique + ext);
        },
    });
const upload = multer({
    storage,
    limits: { fileSize: config.maxImageMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    },
});

// Larger uploader that accepts images OR videos (hero banner, etc.). Uses the
// max of the image and video limits so multer's check fires before our own
// mimetype filter — we re-check size per-type after upload.
const uploadMedia = multer({
    storage,
    limits: { fileSize: Math.max(config.maxImageMb, config.maxVideoMb) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image or video files are allowed.'));
    },
});

function isVideoMime(m) { return /^video\//.test(m || ''); }

// Push a buffer (Cloudinary mode) OR adopt a written disk file (local mode) and
// return { url, public_id, kind } where kind is 'image' or 'video'.
async function storeUploadedFile(file) {
    const kind = isVideoMime(file.mimetype) ? 'video' : 'image';
    if (cloud.enabled) {
        const r = await cloud.uploadBuffer(file.buffer, { resourceType: kind });
        return { url: r.secure_url, public_id: r.public_id, kind };
    }
    return { url: file.filename, public_id: '', kind };
}

// Remove a Cloudinary asset OR local file. resourceType matters on Cloudinary.
function removeStoredAsset({ url, public_id, kind = 'image' } = {}) {
    if (public_id) return cloud.destroy(public_id, { resourceType: kind });
    if (url && !/^https?:\/\//i.test(url)) {
        return fs.promises.unlink(path.join(UPLOAD_DIR, url)).catch(() => {});
    }
    return Promise.resolve();
}

// ---------------------------------------------------------------------- auth
// Simple in-memory token set. Tokens are lost on restart (re-login needed).
const tokens = new Set();

function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (token && tokens.has(token)) return next();
    return res.status(401).json({ error: 'Not authorized. Please log in again.' });
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === config.adminUsername && password === config.adminPassword) {
        const token = crypto.randomBytes(24).toString('hex');
        tokens.add(token);
        return res.json({ token });
    }
    return res.status(401).json({ error: 'Incorrect username or password.' });
});

app.post('/api/logout', requireAuth, (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    tokens.delete(token);
    res.json({ ok: true });
});

// Lightweight session-check endpoint. The admin panel calls this on page load
// to verify the token in localStorage is still valid before showing the UI;
// in-memory tokens are wiped on every server restart, so without this check
// a stale token causes a jarring "Session expired" toast on first paint.
app.get('/api/auth/check', requireAuth, (req, res) => {
    res.json({ ok: true });
});

// ----------------------------------------------------------------- API: read
app.get('/api/projects', async (req, res, next) => {
    try {
        const homepageOnly = req.query.homepage === '1' || req.query.homepage === 'true';
        res.json(await store.listProjects({ homepageOnly }));
    } catch (err) { next(err); }
});

app.get('/api/projects/:id', async (req, res, next) => {
    try {
        const project = await store.getProject(Number(req.params.id));
        if (!project) return res.status(404).json({ error: 'Project not found.' });
        res.json(project);
    } catch (err) { next(err); }
});

// ---------------------------------------------------------------- API: write
app.post('/api/projects', requireAuth, async (req, res, next) => {
    try {
        if (!req.body || !String(req.body.name || '').trim()) {
            return res.status(400).json({ error: 'Project name is required.' });
        }
        res.status(201).json(await store.createProject(req.body));
    } catch (err) { next(err); }
});

app.put('/api/projects/:id', requireAuth, async (req, res, next) => {
    try {
        if (!req.body || !String(req.body.name || '').trim()) {
            return res.status(400).json({ error: 'Project name is required.' });
        }
        const updated = await store.updateProject(Number(req.params.id), req.body);
        if (!updated) return res.status(404).json({ error: 'Project not found.' });
        res.json(updated);
    } catch (err) { next(err); }
});

app.patch('/api/projects/:id/homepage', requireAuth, async (req, res, next) => {
    try {
        const ok = await store.setHomepage(Number(req.params.id), !!(req.body && req.body.on_homepage));
        if (!ok) return res.status(404).json({ error: 'Project not found.' });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// Remove an image from wherever it lives (Cloudinary or local disk).
function removeStoredImage(img) {
    if (img && img.public_id) return cloud.destroy(img.public_id);
    if (img && img.filename) return fs.promises.unlink(path.join(UPLOAD_DIR, img.filename)).catch(() => {});
    return Promise.resolve();
}

app.delete('/api/projects/:id', requireAuth, async (req, res, next) => {
    try {
        const files = await store.deleteProject(Number(req.params.id));
        if (files === null) return res.status(404).json({ error: 'Project not found.' });
        await Promise.all(files.map(removeStoredImage));
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ------------------------------------------------------------- API: images
app.post('/api/projects/:id/images', requireAuth, upload.array('images', 30), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        let items;
        if (cloud.enabled) {
            items = [];
            for (const file of req.files || []) {
                const r = await cloud.uploadBuffer(file.buffer);
                items.push({ filename: r.secure_url, public_id: r.public_id, originalname: file.originalname });
            }
        } else {
            items = (req.files || []).map((f) => ({ filename: f.filename, public_id: '', originalname: f.originalname }));
        }

        const images = await store.addImages(id, items);
        if (images === null) {
            await Promise.all(items.map(removeStoredImage));
            return res.status(404).json({ error: 'Project not found.' });
        }
        res.status(201).json(images);
    } catch (err) { next(err); }
});

app.delete('/api/images/:imageId', requireAuth, async (req, res, next) => {
    try {
        const img = await store.deleteImage(Number(req.params.imageId));
        if (!img) return res.status(404).json({ error: 'Image not found.' });
        await removeStoredImage(img);
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// =====================================================================
//   Site settings — homepage hero media, etc.
// =====================================================================
const HERO_KEYS = ['hero_media_url', 'hero_media_public_id', 'hero_media_type'];

app.get('/api/site-settings', async (req, res, next) => {
    try {
        const keys = req.query.keys ? String(req.query.keys).split(',').map((s) => s.trim()).filter(Boolean) : null;
        res.json(await store.getSettings(keys));
    } catch (err) { next(err); }
});

app.put('/api/site-settings', requireAuth, async (req, res, next) => {
    try {
        const pairs = req.body && typeof req.body === 'object' ? req.body : {};
        if (!Object.keys(pairs).length) return res.status(400).json({ error: 'No settings provided.' });
        res.json(await store.setSettings(pairs));
    } catch (err) { next(err); }
});

// Upload a single hero image OR video. Replaces the previous hero asset (if
// stored on Cloudinary / local disk) once the new one is saved.
app.post('/api/site-settings/hero-media', requireAuth, uploadMedia.single('media'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file received.' });
        const kind = isVideoMime(req.file.mimetype) ? 'video' : 'image';
        // Enforce per-type size limits (multer allowed the larger of the two).
        const limit = kind === 'video' ? config.maxVideoMb : config.maxImageMb;
        if (req.file.size > limit * 1024 * 1024) {
            if (!cloud.enabled) await fs.promises.unlink(path.join(UPLOAD_DIR, req.file.filename)).catch(() => {});
            return res.status(400).json({ error: `${kind === 'video' ? 'Video' : 'Image'} exceeds ${limit} MB.` });
        }

        const saved = await storeUploadedFile(req.file);
        const prev = await store.getSettings(HERO_KEYS);
        await store.setSettings({
            hero_media_url: saved.url,
            hero_media_public_id: saved.public_id,
            hero_media_type: kind,
        });
        if (prev.hero_media_url && prev.hero_media_url !== saved.url) {
            await removeStoredAsset({
                url: prev.hero_media_url,
                public_id: prev.hero_media_public_id,
                kind: prev.hero_media_type === 'video' ? 'video' : 'image',
            });
        }
        res.json({ url: saved.url, public_id: saved.public_id, type: kind });
    } catch (err) { next(err); }
});

app.delete('/api/site-settings/hero-media', requireAuth, async (req, res, next) => {
    try {
        const prev = await store.getSettings(HERO_KEYS);
        await store.setSettings({ hero_media_url: '', hero_media_public_id: '', hero_media_type: '' });
        if (prev.hero_media_url) {
            await removeStoredAsset({
                url: prev.hero_media_url,
                public_id: prev.hero_media_public_id,
                kind: prev.hero_media_type === 'video' ? 'video' : 'image',
            });
        }
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// =====================================================================
//   Testimonials
// =====================================================================
app.get('/api/testimonials', async (req, res, next) => {
    try {
        const visibleOnly = req.query.visible === '1' || req.query.visible === 'true';
        res.json(await store.listTestimonials({ visibleOnly }));
    } catch (err) { next(err); }
});

app.post('/api/testimonials', requireAuth, async (req, res, next) => {
    try {
        if (!String((req.body && req.body.name) || '').trim()) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        if (!String((req.body && req.body.content) || '').trim()) {
            return res.status(400).json({ error: 'Testimonial content is required.' });
        }
        res.status(201).json(await store.createTestimonial(req.body));
    } catch (err) { next(err); }
});

app.put('/api/testimonials/:id', requireAuth, async (req, res, next) => {
    try {
        const updated = await store.updateTestimonial(Number(req.params.id), req.body || {});
        if (!updated) return res.status(404).json({ error: 'Testimonial not found.' });
        res.json(updated);
    } catch (err) { next(err); }
});

app.delete('/api/testimonials/:id', requireAuth, async (req, res, next) => {
    try {
        const removed = await store.deleteTestimonial(Number(req.params.id));
        if (!removed) return res.status(404).json({ error: 'Testimonial not found.' });
        if (removed.photo || removed.photo_public_id) {
            await removeStoredAsset({ url: removed.photo, public_id: removed.photo_public_id, kind: 'image' });
        }
        res.json({ ok: true });
    } catch (err) { next(err); }
});

app.post('/api/testimonials/:id/photo', requireAuth, upload.single('photo'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file received.' });
        const id = Number(req.params.id);
        const current = await store.getTestimonial(id);
        if (!current) {
            await removeStoredAsset({ url: req.file.filename, public_id: '', kind: 'image' });
            return res.status(404).json({ error: 'Testimonial not found.' });
        }
        const saved = await storeUploadedFile(req.file);
        const updated = await store.updateTestimonial(id, { photo: saved.url, photo_public_id: saved.public_id });
        if (current.photo || current.photo_public_id) {
            await removeStoredAsset({ url: current.photo, public_id: current.photo_public_id, kind: 'image' });
        }
        res.json(updated);
    } catch (err) { next(err); }
});

// =====================================================================
//   Media items (video testimonials / brand films / gallery photos)
// =====================================================================
app.get('/api/media', async (req, res, next) => {
    try {
        const visibleOnly = req.query.visible === '1' || req.query.visible === 'true';
        const kind = req.query.kind ? String(req.query.kind) : undefined;
        res.json(await store.listMedia({ kind, visibleOnly }));
    } catch (err) { next(err); }
});

app.post('/api/media', requireAuth, async (req, res, next) => {
    try {
        const body = req.body || {};
        if (!store.MEDIA_KINDS.has(body.kind)) {
            return res.status(400).json({ error: 'kind must be one of: ' + [...store.MEDIA_KINDS].join(', ') });
        }
        res.status(201).json(await store.createMedia(body));
    } catch (err) { next(err); }
});

app.put('/api/media/:id', requireAuth, async (req, res, next) => {
    try {
        const updated = await store.updateMedia(Number(req.params.id), req.body || {});
        if (!updated) return res.status(404).json({ error: 'Media item not found.' });
        res.json(updated);
    } catch (err) { next(err); }
});

app.delete('/api/media/:id', requireAuth, async (req, res, next) => {
    try {
        const removed = await store.deleteMedia(Number(req.params.id));
        if (!removed) return res.status(404).json({ error: 'Media item not found.' });
        if (removed.thumbnail || removed.thumbnail_public_id) {
            await removeStoredAsset({ url: removed.thumbnail, public_id: removed.thumbnail_public_id, kind: 'image' });
        }
        res.json({ ok: true });
    } catch (err) { next(err); }
});

app.post('/api/media/:id/thumbnail', requireAuth, upload.single('thumbnail'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file received.' });
        const id = Number(req.params.id);
        const current = await store.getMedia(id);
        if (!current) {
            await removeStoredAsset({ url: req.file.filename, public_id: '', kind: 'image' });
            return res.status(404).json({ error: 'Media item not found.' });
        }
        const saved = await storeUploadedFile(req.file);
        const updated = await store.updateMedia(id, { thumbnail: saved.url, thumbnail_public_id: saved.public_id });
        if (current.thumbnail || current.thumbnail_public_id) {
            await removeStoredAsset({ url: current.thumbnail, public_id: current.thumbnail_public_id, kind: 'image' });
        }
        res.json(updated);
    } catch (err) { next(err); }
});

// =====================================================================
//   Careers
// =====================================================================
app.get('/api/careers', async (req, res, next) => {
    try {
        const visibleOnly = req.query.visible === '1' || req.query.visible === 'true';
        res.json(await store.listCareers({ visibleOnly }));
    } catch (err) { next(err); }
});

app.post('/api/careers', requireAuth, async (req, res, next) => {
    try {
        if (!String((req.body && req.body.title) || '').trim()) {
            return res.status(400).json({ error: 'Job title is required.' });
        }
        res.status(201).json(await store.createCareer(req.body));
    } catch (err) { next(err); }
});

app.put('/api/careers/:id', requireAuth, async (req, res, next) => {
    try {
        const updated = await store.updateCareer(Number(req.params.id), req.body || {});
        if (!updated) return res.status(404).json({ error: 'Career not found.' });
        res.json(updated);
    } catch (err) { next(err); }
});

app.delete('/api/careers/:id', requireAuth, async (req, res, next) => {
    try {
        const ok = await store.deleteCareer(Number(req.params.id));
        if (!ok) return res.status(404).json({ error: 'Career not found.' });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ----------------------------------------------------------- static serving
// Hide server-only files from the public web root.
const BLOCKED = new Set([
    '/server.js', '/db.js', '/config.js', '/cloudinary.js',
    '/package.json', '/package-lock.json', '/readme.md',
    '/render.yaml', '/.env', '/.env.example',
]);
app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (BLOCKED.has(p) || p.startsWith('/node_modules') || p.startsWith('/data') || p.startsWith('/.git')) {
        return res.status(404).send('Not found');
    }
    next();
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(__dirname));   // the Bhram website + /admin + /css + /js

// Pretty URL for admin-managed projects: /project/5 -> project.html
app.get('/project/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'project.html'));
});

// ----------------------------------------------------------- error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || /image|video files/.test(err.message || '')) {
        return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
});

async function start() {
    await store.init();
    const projectCount = await store.count();

    app.listen(config.port, () => {
        console.log('\n  Brahm Estate running');
        console.log('  Website : http://localhost:' + config.port + '/');
        console.log('  Admin   : http://localhost:' + config.port + '/admin/');
        console.log('  Images  : ' + (cloud.enabled ? 'Cloudinary (cloud)' : 'local /uploads folder'));
        console.log('  Database: ' + (store.useTurso ? 'Turso (cloud)' : 'local SQLite file'));
        console.log('  Projects in database: ' + projectCount);

        // Local-file mode only: snapshot the DB outside OneDrive as a safety
        // net. No-op on Turso (the cloud database is already durable).
        const first = store.backupNow();
        if (first) console.log('  Backup  : ' + first);
        console.log('');
        setInterval(() => store.backupNow(), 30 * 60 * 1000).unref();
    });
}

start().catch((err) => {
    console.error('\n  Failed to start:', err.message, '\n');
    process.exit(1);
});
