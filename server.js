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

// ----------------------------------------------------------- static serving
// Hide server-only files from the public web root.
const BLOCKED = new Set([
    '/server.js', '/db.js', '/config.js', '/cloudinary.js',
    '/migrate-images.js', '/migrate-to-turso.js', '/package.json',
    '/package-lock.json', '/readme.md', '/deployment.md', '/.env',
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
    if (err instanceof multer.MulterError || /image files/.test(err.message)) {
        return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
});

async function start() {
    await store.init();
    const projectCount = await store.count();

    app.listen(config.port, () => {
        console.log('\n  Bhram Realty running');
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
