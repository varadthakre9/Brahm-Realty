/* ============================================================================
   Cloudinary image storage
   ----------------------------------------------------------------------------
   When CLOUDINARY_URL is set (see .env / Render env vars), uploaded images are
   stored on Cloudinary's CDN and the database keeps the secure URL + public id.
   When it is NOT set, the app silently falls back to local /uploads storage so
   development keeps working without an account.
   ============================================================================ */

const { v2: cloudinary } = require('cloudinary');

// cloudinary.config() automatically reads CLOUDINARY_URL from the environment.
const enabled = !!process.env.CLOUDINARY_URL;
if (enabled) cloudinary.config({ secure: true });

const FOLDER = process.env.CLOUDINARY_FOLDER || 'bhram-realty';

// Upload an in-memory image buffer; resolves to { secure_url, public_id }.
function uploadBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: FOLDER, resource_type: 'image' },
            (err, result) => (err ? reject(err) : resolve(result)),
        );
        stream.end(buffer);
    });
}

// Upload from a local file path (used by the one-time migration script).
function uploadFile(filePath) {
    return cloudinary.uploader.upload(filePath, { folder: FOLDER, resource_type: 'image' });
}

// Best-effort delete; never throws so a missing image can't block a request.
function destroy(publicId) {
    if (!publicId) return Promise.resolve();
    return cloudinary.uploader.destroy(publicId).catch(() => {});
}

module.exports = { enabled, uploadBuffer, uploadFile, destroy, cloudinary };
