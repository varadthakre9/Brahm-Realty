/* ============================================================================
   Database layer — libSQL (Turso in the cloud, or a local file in dev)
   ----------------------------------------------------------------------------
   If TURSO_DATABASE_URL is set, the app talks to your cloud Turso database so
   data is durable and shared across every device/deploy. Otherwise it falls
   back to a local SQLite file (file:data/realestate.db) for offline dev.

   Tables:
     - projects         : the main project record (all detail fields)
     - highlights       : 0..n highlight bullet points per project
     - gallery_images   : 0..n images per project (Cloudinary URL + public id)

   All functions are async (libSQL is a network client). Call init() once at
   startup to create the schema before serving requests.
   ============================================================================ */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@libsql/client');

const useTurso = !!process.env.TURSO_DATABASE_URL;

const DATA_DIR = path.join(__dirname, 'data');
if (!useTurso && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const client = createClient(
    useTurso
        ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
        : { url: 'file:' + path.join(DATA_DIR, 'realestate.db') },
);

// ------------------------------------------------------------------- helpers
async function all(sql, args = []) {
    return (await client.execute({ sql, args })).rows;
}
async function get(sql, args = []) {
    return (await client.execute({ sql, args })).rows[0] || null;
}
async function run(sql, args = []) {
    return client.execute({ sql, args });
}

// ------------------------------------------------------------------- schema
const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS projects (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        name                 TEXT NOT NULL,
        location             TEXT DEFAULT '',
        rera_number          TEXT DEFAULT '',
        starting_price       TEXT DEFAULT '',
        configurations       TEXT DEFAULT '',
        category             TEXT DEFAULT '',
        carpet_area          TEXT DEFAULT '',
        possession_date      TEXT DEFAULT '',
        about                TEXT DEFAULT '',
        location_title       TEXT DEFAULT '',
        location_description TEXT DEFAULT '',
        map_embed            TEXT DEFAULT '',
        on_homepage          INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS highlights (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        text       TEXT NOT NULL,
        position   INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_images (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        filename      TEXT NOT NULL,
        public_id     TEXT DEFAULT '',
        original_name TEXT DEFAULT '',
        position      INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_highlights_project ON highlights(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_images_project ON gallery_images(project_id)`,

    // -------- Homepage hero + other key-value site settings -----------------
    `CREATE TABLE IF NOT EXISTS site_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
    )`,

    // -------- Client Echoes (homepage testimonials) -------------------------
    `CREATE TABLE IF NOT EXISTS testimonials (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        role            TEXT DEFAULT '',
        content         TEXT NOT NULL,
        photo           TEXT DEFAULT '',
        photo_public_id TEXT DEFAULT '',
        position        INTEGER NOT NULL DEFAULT 0,
        visible         INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_testimonials_pos ON testimonials(position, id)`,

    // -------- Media items: video testimonials / brand films / gallery -------
    `CREATE TABLE IF NOT EXISTS media_items (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        kind               TEXT NOT NULL,
        title              TEXT DEFAULT '',
        subtitle           TEXT DEFAULT '',
        video_url          TEXT DEFAULT '',
        thumbnail          TEXT DEFAULT '',
        thumbnail_public_id TEXT DEFAULT '',
        position           INTEGER NOT NULL DEFAULT 0,
        visible            INTEGER NOT NULL DEFAULT 1,
        created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_media_kind ON media_items(kind, position, id)`,

    // -------- Open job positions -------------------------------------------
    `CREATE TABLE IF NOT EXISTS careers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        department  TEXT DEFAULT '',
        job_type    TEXT DEFAULT '',
        location    TEXT DEFAULT '',
        experience  TEXT DEFAULT '',
        description TEXT DEFAULT '',
        position    INTEGER NOT NULL DEFAULT 0,
        visible     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_careers_pos ON careers(position, id)`,
];

async function init() {
    await client.batch(SCHEMA, 'write');

    // Migrations for databases created before these columns existed.
    const pcols = (await client.execute('PRAGMA table_info(projects)')).rows.map((r) => r.name);
    if (!pcols.includes('category')) {
        await client.execute("ALTER TABLE projects ADD COLUMN category TEXT DEFAULT ''");
    }
    const gcols = (await client.execute('PRAGMA table_info(gallery_images)')).rows.map((r) => r.name);
    if (!gcols.includes('public_id')) {
        await client.execute("ALTER TABLE gallery_images ADD COLUMN public_id TEXT DEFAULT ''");
    }

    // First-boot seed: copy the content that was previously hardcoded in
    // index.html / media.html / careers.html into the new tables so the admin
    // panel shows it and the user can edit it. Guarded by a flag so it only
    // ever runs once — clearing a table later will NOT re-seed it.
    const flag = await get("SELECT value FROM site_settings WHERE key = 'content_seeded'");
    if (!flag || flag.value !== '1') {
        await seedDefaultContent();
        await run(
            "INSERT INTO site_settings (key, value) VALUES ('content_seeded', '1') " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        );
    }
}

// One-time defaults pulled verbatim from the original static HTML.
async function seedDefaultContent() {
    // ---- Homepage hero (the image baked into index.html) ------------------
    const heroRow = await get("SELECT value FROM site_settings WHERE key = 'hero_media_url'");
    if (!heroRow || !heroRow.value) {
        const heroUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjNFXshF7yaUW3JUOfteD6d_LN1h2gCdvTjCN4d643xCbnk1v8hSdCUoZuJo14KMMVLRqEON8b1S_72gQR31O1yVWBZclOXG2aUxBKM1Spo9TQRPGuvckySkDCVNPGG-nUuOJ5lgVRtYZ4u0J4CaOu7XquvpEKb7_O0aY3xypc5jELCOTE33zSRbD1efWJzWjleSP-lr6EN3tzby7NkUjrd7WKw6xX2CGZUDd4InQeL_r3JnGfim8fWzi6nkZcEIvh-SWiOdNX5Rwf';
        await run(
            "INSERT INTO site_settings (key, value) VALUES ('hero_media_url', ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [heroUrl]
        );
        await run(
            "INSERT INTO site_settings (key, value) VALUES ('hero_media_type', 'image') " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        );
    }

    // ---- Testimonials (Client Echoes on the homepage) ---------------------
    const tCount = await get('SELECT COUNT(*) AS c FROM testimonials');
    if (!tCount || Number(tCount.c) === 0) {
        const testimonials = [
            {
                name: 'Rajesh Khanna',
                role: 'Global Industrialist · Delhi',
                content: "Brahm Estate's discretion and market knowledge are second to none in India. We found our dream estate in Lutyens' before it ever hit the market.",
                photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=facearea&facepad=2.5&w=200&h=200&q=80',
            },
            {
                name: 'Ananya Deshmukh',
                role: 'FinTech Pioneer · Bangalore',
                content: 'A seamless experience from start to finish. They understand that for clients like us, time and privacy are the ultimate luxuries.',
                photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=facearea&facepad=2.5&w=200&h=200&q=80',
            },
            {
                name: 'Aditya Verma',
                role: 'Heritage Investor · Mumbai',
                content: "The level of bespoke service was beyond anything we've experienced globally. They truly are the concierge of Indian luxury real estate.",
                photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2.5&w=200&h=200&q=80',
            },
        ];
        for (let i = 0; i < testimonials.length; i++) {
            const t = testimonials[i];
            await run(
                'INSERT INTO testimonials (name, role, content, photo, photo_public_id, position, visible) VALUES (?, ?, ?, ?, ?, ?, 1)',
                [t.name, t.role, t.content, t.photo, '', i]
            );
        }
    }

    // ---- Media: video testimonials, brand films, gallery photos ----------
    const mCount = await get('SELECT COUNT(*) AS c FROM media_items');
    if (!mCount || Number(mCount.c) === 0) {
        const videoTestimonials = [
            { title: '"They understood our vision completely"', subtitle: 'Homeowner · The Sky Penthouse',     thumbnail: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80' },
            { title: '"A truly effortless experience"',         subtitle: 'Client · The Zen Villa',             thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80' },
            { title: '"The home we always dreamed of"',         subtitle: 'Family · Marine Drive Residence',    thumbnail: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=1200&q=80' },
        ];
        const brandFilms = [
            { title: 'The Brahm Standard',         subtitle: 'Brand Film',   thumbnail: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Inside the Sky Penthouse',   subtitle: 'Project Tour', thumbnail: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80' },
            { title: 'The Zen Villa, from above',  subtitle: 'Drone',        thumbnail: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80' },
        ];
        const galleryPhotos = [
            { title: 'Marble bathroom',     thumbnail: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=80' },
            { title: 'Modern kitchen',      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80' },
            { title: 'Grand living room',   thumbnail: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80' },
            { title: 'Home cinema',         thumbnail: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80' },
            { title: 'Marine Drive facade', thumbnail: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80' },
            { title: 'Coastal villa pool',  thumbnail: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=80' },
            { title: 'Brutalist concrete',  thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80' },
            { title: 'Lutyens bungalow',    thumbnail: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80' },
        ];

        const insertMedia = async (kind, list) => {
            for (let i = 0; i < list.length; i++) {
                const m = list[i];
                await run(
                    'INSERT INTO media_items (kind, title, subtitle, video_url, thumbnail, thumbnail_public_id, position, visible) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                    [kind, m.title || '', m.subtitle || '', '', m.thumbnail || '', '', i]
                );
            }
        };
        await insertMedia('video_testimonial', videoTestimonials);
        await insertMedia('brand_film',        brandFilms);
        await insertMedia('gallery_photo',     galleryPhotos);
    }

    // ---- Careers (open positions on careers.html) -------------------------
    const cCount = await get('SELECT COUNT(*) AS c FROM careers');
    if (!cCount || Number(cCount.c) === 0) {
        const careersList = [
            {
                title: 'Sales Executive', department: 'Sales', job_type: 'Full-time',
                location: 'Nagpur', experience: '1-2 years',
                description: 'Cultivate relationships with HNI clients across our Nagpur portfolio. Strong network in luxury real estate required.',
            },
            {
                title: 'Senior Architect', department: 'Architecture', job_type: 'Full-time',
                location: 'Nagpur', experience: '7-10 years',
                description: 'Lead design across two upcoming developments in Nagpur. Portfolio of completed residential work required.',
            },
            {
                title: 'Interior Designer', department: 'Design', job_type: 'Full-time',
                location: 'Nagpur', experience: '3-5 years',
                description: 'Shape model apartments and bespoke client interiors. Sensibility for materiality and craft essential.',
            },
            {
                title: 'Brand & Content Manager', department: 'Marketing', job_type: 'Full-time',
                location: 'Nagpur (HQ)', experience: '4-7 years',
                description: 'Steward the Brahm voice across digital, print, and broker channels. Strong editorial background expected.',
            },
        ];
        for (let i = 0; i < careersList.length; i++) {
            const c = careersList[i];
            await run(
                'INSERT INTO careers (title, department, job_type, location, experience, description, position, visible) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                [c.title, c.department, c.job_type, c.location, c.experience, c.description, i]
            );
        }
    }
}

// Fields that come from the admin form (everything except id/timestamps).
const FIELDS = [
    'name', 'location', 'rera_number', 'starting_price', 'configurations',
    'category', 'carpet_area', 'possession_date', 'about', 'location_title',
    'location_description', 'map_embed',
];

function cleanFields(data) {
    const out = {};
    FIELDS.forEach((f) => { out[f] = data[f] != null ? String(data[f]) : ''; });
    out.on_homepage = data.on_homepage ? 1 : 0;
    return out;
}

async function imagesFor(projectId) {
    return all(
        'SELECT id, filename, public_id, original_name, position FROM gallery_images WHERE project_id = ? ORDER BY position, id',
        [projectId],
    );
}

async function highlightsFor(projectId) {
    return all(
        'SELECT id, text, position FROM highlights WHERE project_id = ? ORDER BY position, id',
        [projectId],
    );
}

function cleanHighlights(highlights) {
    if (!Array.isArray(highlights)) return [];
    return highlights
        .map((h) => (typeof h === 'string' ? h : (h && h.text) || ''))
        .map((t) => t.trim())
        .filter(Boolean);
}

async function replaceHighlightsTx(tx, projectId, highlights) {
    await tx.execute({ sql: 'DELETE FROM highlights WHERE project_id = ?', args: [projectId] });
    const cleaned = cleanHighlights(highlights);
    for (let i = 0; i < cleaned.length; i++) {
        await tx.execute({
            sql: 'INSERT INTO highlights (project_id, text, position) VALUES (?, ?, ?)',
            args: [projectId, cleaned[i], i],
        });
    }
}

// ----------------------------------------------------------------- public API

async function listProjects({ homepageOnly = false } = {}) {
    const where = homepageOnly ? 'WHERE p.on_homepage = 1' : '';
    return all(`
        SELECT p.*,
               (SELECT filename FROM gallery_images g
                 WHERE g.project_id = p.id ORDER BY g.position, g.id LIMIT 1) AS cover,
               (SELECT COUNT(*) FROM gallery_images g WHERE g.project_id = p.id) AS image_count
        FROM projects p
        ${where}
        ORDER BY p.created_at DESC, p.id DESC
    `);
}

async function getProject(id) {
    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return null;
    project.highlights = await highlightsFor(id);
    project.images = await imagesFor(id);
    return project;
}

async function createProject(data) {
    const f = cleanFields(data);
    const tx = await client.transaction('write');
    try {
        const result = await tx.execute({
            sql: `INSERT INTO projects
                    (name, location, rera_number, starting_price, configurations, category, carpet_area,
                     possession_date, about, location_title, location_description, map_embed, on_homepage)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                f.name, f.location, f.rera_number, f.starting_price, f.configurations, f.category,
                f.carpet_area, f.possession_date, f.about, f.location_title, f.location_description,
                f.map_embed, f.on_homepage,
            ],
        });
        const id = Number(result.lastInsertRowid);
        await replaceHighlightsTx(tx, id, data.highlights);
        await tx.commit();
        return getProject(id);
    } catch (e) {
        await tx.rollback();
        throw e;
    }
}

async function updateProject(id, data) {
    const exists = await get('SELECT id FROM projects WHERE id = ?', [id]);
    if (!exists) return null;
    const f = cleanFields(data);
    const tx = await client.transaction('write');
    try {
        await tx.execute({
            sql: `UPDATE projects SET
                    name=?, location=?, rera_number=?, starting_price=?, configurations=?,
                    category=?, carpet_area=?, possession_date=?, about=?, location_title=?,
                    location_description=?, map_embed=?, on_homepage=?, updated_at=datetime('now')
                  WHERE id=?`,
            args: [
                f.name, f.location, f.rera_number, f.starting_price, f.configurations, f.category,
                f.carpet_area, f.possession_date, f.about, f.location_title, f.location_description,
                f.map_embed, f.on_homepage, id,
            ],
        });
        if (data.highlights !== undefined) await replaceHighlightsTx(tx, id, data.highlights);
        await tx.commit();
    } catch (e) {
        await tx.rollback();
        throw e;
    }
    return getProject(id);
}

async function setHomepage(id, on) {
    const r = await run("UPDATE projects SET on_homepage = ?, updated_at = datetime('now') WHERE id = ?",
        [on ? 1 : 0, id]);
    return r.rowsAffected > 0;
}

// Returns the deleted project's images ({filename, public_id}) so the caller
// can remove them from Cloudinary / disk, or null if the project didn't exist.
async function deleteProject(id) {
    const imgs = await imagesFor(id);
    const files = imgs.map((img) => ({ filename: img.filename, public_id: img.public_id }));
    const tx = await client.transaction('write');
    try {
        await tx.execute({ sql: 'DELETE FROM gallery_images WHERE project_id = ?', args: [id] });
        await tx.execute({ sql: 'DELETE FROM highlights WHERE project_id = ?', args: [id] });
        const r = await tx.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
        await tx.commit();
        return r.rowsAffected > 0 ? files : null;
    } catch (e) {
        await tx.rollback();
        throw e;
    }
}

async function addImages(projectId, files) {
    const exists = await get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!exists) return null;
    const row = await get('SELECT COALESCE(MAX(position), -1) AS m FROM gallery_images WHERE project_id = ?',
        [projectId]);
    const startPos = (row ? Number(row.m) : -1) + 1;
    const tx = await client.transaction('write');
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await tx.execute({
                sql: 'INSERT INTO gallery_images (project_id, filename, public_id, original_name, position) VALUES (?, ?, ?, ?, ?)',
                args: [projectId, file.filename, file.public_id || '', file.originalname || '', startPos + i],
            });
        }
        await tx.commit();
    } catch (e) {
        await tx.rollback();
        throw e;
    }
    return imagesFor(projectId);
}

// Returns {filename, public_id} to delete from storage, or null if not found.
async function deleteImage(imageId) {
    const img = await get('SELECT filename, public_id FROM gallery_images WHERE id = ?', [imageId]);
    if (!img) return null;
    await run('DELETE FROM gallery_images WHERE id = ?', [imageId]);
    return { filename: img.filename, public_id: img.public_id };
}

async function count() {
    const r = await get('SELECT COUNT(*) AS c FROM projects');
    return r ? Number(r.c) : 0;
}

// ====================================================================
//   Site settings (key/value) — used for the homepage hero, etc.
// ====================================================================
async function getSettings(keys) {
    let sql = 'SELECT key, value FROM site_settings';
    const args = [];
    if (Array.isArray(keys) && keys.length) {
        sql += ` WHERE key IN (${keys.map(() => '?').join(',')})`;
        args.push(...keys);
    }
    const rows = await all(sql, args);
    const out = {};
    rows.forEach((r) => { out[r.key] = r.value; });
    return out;
}

async function setSettings(pairs) {
    const tx = await client.transaction('write');
    try {
        for (const [key, value] of Object.entries(pairs)) {
            await tx.execute({
                sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)
                      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                args: [key, value == null ? '' : String(value)],
            });
        }
        await tx.commit();
    } catch (e) {
        await tx.rollback();
        throw e;
    }
    return getSettings(Object.keys(pairs));
}

// ====================================================================
//   Testimonials (homepage "Client Echoes")
// ====================================================================
async function listTestimonials({ visibleOnly = false } = {}) {
    const where = visibleOnly ? 'WHERE visible = 1' : '';
    return all(`SELECT * FROM testimonials ${where} ORDER BY position ASC, id ASC`);
}

async function getTestimonial(id) {
    return get('SELECT * FROM testimonials WHERE id = ?', [id]);
}

async function createTestimonial(t) {
    const row = await get('SELECT COALESCE(MAX(position), -1) AS m FROM testimonials');
    const pos = (row ? Number(row.m) : -1) + 1;
    const r = await run(
        `INSERT INTO testimonials (name, role, content, photo, photo_public_id, position, visible)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            t.name || '',
            t.role || '',
            t.content || '',
            t.photo || '',
            t.photo_public_id || '',
            Number.isFinite(t.position) ? Number(t.position) : pos,
            t.visible === 0 ? 0 : 1,
        ]
    );
    return getTestimonial(Number(r.lastInsertRowid));
}

async function updateTestimonial(id, t) {
    const fields = ['name', 'role', 'content', 'photo', 'photo_public_id', 'position', 'visible'];
    const sets = [];
    const args = [];
    fields.forEach((f) => {
        if (t[f] !== undefined) { sets.push(`${f} = ?`); args.push(t[f]); }
    });
    if (!sets.length) return getTestimonial(id);
    args.push(id);
    await run(`UPDATE testimonials SET ${sets.join(', ')} WHERE id = ?`, args);
    return getTestimonial(id);
}

async function deleteTestimonial(id) {
    const t = await getTestimonial(id);
    if (!t) return null;
    await run('DELETE FROM testimonials WHERE id = ?', [id]);
    return { photo: t.photo, photo_public_id: t.photo_public_id };
}

// ====================================================================
//   Media items (video testimonials / brand films / gallery photos)
// ====================================================================
const MEDIA_KINDS = new Set(['video_testimonial', 'brand_film', 'gallery_photo']);

async function listMedia({ kind, visibleOnly = false } = {}) {
    const where = [];
    const args = [];
    if (kind) { where.push('kind = ?'); args.push(kind); }
    if (visibleOnly) where.push('visible = 1');
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return all(`SELECT * FROM media_items ${clause} ORDER BY position ASC, id ASC`, args);
}

async function getMedia(id) {
    return get('SELECT * FROM media_items WHERE id = ?', [id]);
}

async function createMedia(m) {
    const kind = MEDIA_KINDS.has(m.kind) ? m.kind : 'gallery_photo';
    const row = await get(
        'SELECT COALESCE(MAX(position), -1) AS m FROM media_items WHERE kind = ?',
        [kind]
    );
    const pos = (row ? Number(row.m) : -1) + 1;
    const r = await run(
        `INSERT INTO media_items (kind, title, subtitle, video_url, thumbnail, thumbnail_public_id, position, visible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            kind,
            m.title || '',
            m.subtitle || '',
            m.video_url || '',
            m.thumbnail || '',
            m.thumbnail_public_id || '',
            Number.isFinite(m.position) ? Number(m.position) : pos,
            m.visible === 0 ? 0 : 1,
        ]
    );
    return getMedia(Number(r.lastInsertRowid));
}

async function updateMedia(id, m) {
    const fields = ['kind', 'title', 'subtitle', 'video_url', 'thumbnail', 'thumbnail_public_id', 'position', 'visible'];
    const sets = [];
    const args = [];
    fields.forEach((f) => {
        if (m[f] !== undefined) {
            if (f === 'kind' && !MEDIA_KINDS.has(m[f])) return;
            sets.push(`${f} = ?`);
            args.push(m[f]);
        }
    });
    if (!sets.length) return getMedia(id);
    args.push(id);
    await run(`UPDATE media_items SET ${sets.join(', ')} WHERE id = ?`, args);
    return getMedia(id);
}

async function deleteMedia(id) {
    const m = await getMedia(id);
    if (!m) return null;
    await run('DELETE FROM media_items WHERE id = ?', [id]);
    return { thumbnail: m.thumbnail, thumbnail_public_id: m.thumbnail_public_id };
}

// ====================================================================
//   Careers (open job positions)
// ====================================================================
async function listCareers({ visibleOnly = false } = {}) {
    const where = visibleOnly ? 'WHERE visible = 1' : '';
    return all(`SELECT * FROM careers ${where} ORDER BY position ASC, id ASC`);
}

async function getCareer(id) {
    return get('SELECT * FROM careers WHERE id = ?', [id]);
}

async function createCareer(c) {
    const row = await get('SELECT COALESCE(MAX(position), -1) AS m FROM careers');
    const pos = (row ? Number(row.m) : -1) + 1;
    const r = await run(
        `INSERT INTO careers (title, department, job_type, location, experience, description, position, visible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            c.title || '',
            c.department || '',
            c.job_type || '',
            c.location || '',
            c.experience || '',
            c.description || '',
            Number.isFinite(c.position) ? Number(c.position) : pos,
            c.visible === 0 ? 0 : 1,
        ]
    );
    return getCareer(Number(r.lastInsertRowid));
}

async function updateCareer(id, c) {
    const fields = ['title', 'department', 'job_type', 'location', 'experience', 'description', 'position', 'visible'];
    const sets = [];
    const args = [];
    fields.forEach((f) => {
        if (c[f] !== undefined) { sets.push(`${f} = ?`); args.push(c[f]); }
    });
    if (!sets.length) return getCareer(id);
    args.push(id);
    await run(`UPDATE careers SET ${sets.join(', ')} WHERE id = ?`, args);
    return getCareer(id);
}

async function deleteCareer(id) {
    const c = await getCareer(id);
    if (!c) return null;
    await run('DELETE FROM careers WHERE id = ?', [id]);
    return true;
}

// ----------------------------------------------------------------- backups
// On the cloud (Turso) the database is already durable and replicated, so no
// local snapshots are needed. In local-file mode we keep a best-effort copy
// outside OneDrive as a safety net.
const BACKUP_DIR = process.env.BHRAM_BACKUP_DIR
    || path.join(os.homedir(), 'BhramRealtyBackups');
const MAX_BACKUPS = 20;

function backupNow() {
    if (useTurso) return null;
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const dest = path.join(BACKUP_DIR, `realestate-${stamp}.db`);
        fs.copyFileSync(path.join(DATA_DIR, 'realestate.db'), dest);

        const files = fs.readdirSync(BACKUP_DIR)
            .filter((f) => /^realestate-.*\.db$/.test(f))
            .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
        files.slice(MAX_BACKUPS).forEach((x) => {
            try { fs.unlinkSync(path.join(BACKUP_DIR, x.f)); } catch (_) { /* ignore */ }
        });
        return dest;
    } catch (e) {
        console.error('  Backup failed:', e.message);
        return null;
    }
}

module.exports = {
    client,
    useTurso,
    SCHEMA,
    init,
    listProjects,
    getProject,
    createProject,
    updateProject,
    setHomepage,
    deleteProject,
    addImages,
    deleteImage,
    count,
    // Site settings
    getSettings,
    setSettings,
    // Testimonials
    listTestimonials,
    getTestimonial,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    // Media items
    MEDIA_KINDS,
    listMedia,
    getMedia,
    createMedia,
    updateMedia,
    deleteMedia,
    // Careers
    listCareers,
    getCareer,
    createCareer,
    updateCareer,
    deleteCareer,
    // Backups
    backupNow,
    BACKUP_DIR,
};
