module.exports = {
  apps: [
    {
      name: 'notification-service',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
    },
  ],
};
