/* ============================================================================
   Cloudinary image / video storage
   ----------------------------------------------------------------------------
   When CLOUDINARY_URL is set (see .env / Render env vars), uploaded media is
   stored on Cloudinary's CDN and the database keeps the secure URL + public id.
   When it is NOT set, the app silently falls back to local /uploads storage so
   development keeps working without an account.
   ============================================================================ */

const { v2: cloudinary } = require('cloudinary');

// cloudinary.config() automatically reads CLOUDINARY_URL from the environment.
const enabled = !!process.env.CLOUDINARY_URL;
if (enabled) cloudinary.config({ secure: true });

const FOLDER = process.env.CLOUDINARY_FOLDER || 'bhram-realty';

// Upload an in-memory buffer (image OR video). resource_type controls Cloudinary
// processing. Pass { resourceType: 'video' } when uploading mp4/webm/mov files.
function uploadBuffer(buffer, { resourceType = 'image' } = {}) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: FOLDER, resource_type: resourceType },
            (err, result) => (err ? reject(err) : resolve(result)),
        );
        stream.end(buffer);
    });
}

// Upload from a local file path (used by the one-time migration script).
function uploadFile(filePath, { resourceType = 'image' } = {}) {
    return cloudinary.uploader.upload(filePath, { folder: FOLDER, resource_type: resourceType });
}

// Best-effort delete; never throws so a missing asset can't block a request.
// resourceType must match the type used at upload time ('image' or 'video').
function destroy(publicId, { resourceType = 'image' } = {}) {
    if (!publicId) return Promise.resolve();
    return cloudinary.uploader
        .destroy(publicId, { resource_type: resourceType })
        .catch(() => {});
}

module.exports = { enabled, uploadBuffer, uploadFile, destroy, cloudinary };
