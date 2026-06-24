// PM2 process manager config for Brahm Estate.
// Used by deploy/setup-ec2.sh to run the app under PM2.
module.exports = {
    apps: [
        {
            name: 'brahm-estate',
            script: 'server.js',
            cwd: __dirname + '/..',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                PORT: 5500
            }
        }
    ]
};
