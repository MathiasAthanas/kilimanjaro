const fs = require('fs');
const path = require('path');

function loadEnvironment(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run: node scripts/setup-local-env.js`);
  }

  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const localEnv = loadEnvironment(path.join(__dirname, '.env'));

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
      ...localEnv,
      NODE_ENV: 'development',
      PORT: String(port),
    },
  })),
};
