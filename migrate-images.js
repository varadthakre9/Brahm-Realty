/* ============================================================================
   One-time migration: local /uploads images  ->  Cloudinary
   ----------------------------------------------------------------------------
   Run once after adding CLOUDINARY_URL to your .env:

       node migrate-images.js

   For every image still stored as a local filename, it uploads the file to
   Cloudinary and rewrites the database row to point at the Cloudinary URL +
   public id. Safe to run multiple times: already-migrated rows are skipped.
   ============================================================================ */

if (process.platform === 'win32') {
    try { require('win-ca')({ inject: '+' }); } catch (_) { /* optional */ }
}
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const store = require('./db');
const cloud = require('./cloudinary');

if (!cloud.enabled) {
    console.error('\n  CLOUDINARY_URL is not set. Add it to your .env first, then re-run.\n');
    process.exit(1);
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');

(async () => {
    const rows = store.db
        .prepare('SELECT id, filename, public_id FROM gallery_images')
        .all();

    const pending = rows.filter(
        (r) => !r.public_id && !/^https?:\/\//i.test(r.filename || ''),
    );

    if (!pending.length) {
        console.log('\n  Nothing to migrate — all images are already on Cloudinary.\n');
        process.exit(0);
    }

    console.log(`\n  Migrating ${pending.length} image(s) to Cloudinary...\n`);
    const update = store.db.prepare(
        'UPDATE gallery_images SET filename = ?, public_id = ? WHERE id = ?',
    );

    let done = 0;
    let missing = 0;
    for (const row of pending) {
        const filePath = path.join(UPLOAD_DIR, row.filename);
        if (!fs.existsSync(filePath)) {
            console.warn('  - missing file, skipped:', row.filename);
            missing++;
            continue;
        }
        try {
            const r = await cloud.uploadFile(filePath);
            update.run(r.secure_url, r.public_id, row.id);
            done++;
            console.log('  + uploaded:', row.filename);
        } catch (e) {
            console.error('  ! failed:', row.filename, '-', e.message);
        }
    }

    console.log(`\n  Done. ${done} uploaded, ${missing} missing/skipped.\n`);
    process.exit(0);
})();
