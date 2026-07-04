const services = [
  ['ks-api-gateway', 'api-gateway', 'dist/src/main.js', 3000],
  ['ks-auth-service', 'auth-service', 'dist/src/main.js', 3001],
  ['ks-student-service', 'student-service', 'dist/main.js', 3002],
  ['ks-academic-service', 'academic-service', 'dist/src/main.js', 3003],
  ['ks-finance-service', 'finance-service', 'dist/src/main.js', 3004],
  ['ks-notification-service', 'notification-service', 'dist/main.js', 3005],
  ['ks-analytics-service', 'analytics-service', 'dist/src/main.js', 3006],
  ['ks-elearning-service', 'elearning-service', 'dist/src/main.js', 3007],
];

module.exports = {
  apps: services.map(([name, service, script, port]) => ({
    name,
    cwd: `./services/${service}`,
    script,
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
    },
  })),
};
