/* ============================================================================
   Configuration — edit these values.
   ----------------------------------------------------------------------------
   You can also override any of them with environment variables of the same
   (UPPER_CASE) name, e.g.  set ADMIN_PASSWORD=secret  before starting.
   ============================================================================ */

module.exports = {
    // Port the server listens on. Open http://localhost:<PORT>/
    port: process.env.PORT || 5500,

    // Login for the admin panel (/admin). CHANGE THESE before going live.
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

    // Max upload size per image (in megabytes).
    maxImageMb: Number(process.env.MAX_IMAGE_MB || 8),
};
