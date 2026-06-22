/* ============================================================================
   One-time migration: local SQLite file  ->  Turso (cloud)
   ----------------------------------------------------------------------------
   Run once after adding TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to your .env:

       node migrate-to-turso.js

   Copies every projects / highlights / gallery_images row (keeping ids and
   timestamps) from data/realestate.db into your Turso database. It clears the
   Turso tables first, so it is safe to re-run if something goes wrong.
   ============================================================================ */

if (process.platform === 'win32') {
    try { require('win-ca')({ inject: '+' }); } catch (_) { /* optional */ }
}
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const store = require('./db'); // connects to Turso when keys are present

async function copyRows(table, rows) {
    if (!rows.length) return 0;
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
    const statements = rows.map((r) => ({
        sql,
        args: cols.map((c) => (r[c] === undefined ? null : r[c])),
    }));
    await store.client.batch(statements, 'write');
    return rows.length;
}

(async () => {
    if (!store.useTurso) {
        console.error('\n  TURSO_DATABASE_URL is not set. Add it to your .env first.\n');
        process.exit(1);
    }

    const localPath = path.join(__dirname, 'data', 'realestate.db');
    if (!fs.existsSync(localPath)) {
        console.error('\n  No local database found at data/realestate.db — nothing to migrate.\n');
        process.exit(1);
    }

    // Create the schema in Turso (idempotent).
    await store.init();

    const local = new Database(localPath, { readonly: true });
    const projects = local.prepare('SELECT * FROM projects').all();
    const highlights = local.prepare('SELECT * FROM highlights').all();
    const images = local.prepare('SELECT * FROM gallery_images').all();
    local.close();

    console.log(`\n  Found locally: ${projects.length} projects, ${highlights.length} highlights, ${images.length} images.`);

    // Start clean so re-runs don't duplicate.
    await store.client.batch([
        'DELETE FROM gallery_images',
        'DELETE FROM highlights',
        'DELETE FROM projects',
    ], 'write');

    await copyRows('projects', projects);
    await copyRows('highlights', highlights);
    await copyRows('gallery_images', images);

    const check = await store.client.execute('SELECT COUNT(*) AS c FROM projects');
    console.log(`  Turso now has ${Number(check.rows[0].c)} projects. Migration complete.\n`);
    process.exit(0);
})().catch((err) => {
    console.error('\n  Migration failed:', err.message, '\n');
    process.exit(1);
});
