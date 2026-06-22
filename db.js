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
    backupNow,
    BACKUP_DIR,
};
