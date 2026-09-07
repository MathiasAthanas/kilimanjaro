#!/usr/bin/env node
/* Creates ignored local development credentials. It never overwrites .env. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.env');
if (fs.existsSync(output)) {
  console.error(`${output} already exists; refusing to overwrite it.`);
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const escape = (value) => value.replace(/\n/g, '\\n').trim();
const values = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://kilimanjaro:kilimanjaro@127.0.0.1:5432/kilimanjaro',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  RABBITMQ_URL: 'amqp://kilimanjaro:kilimanjaro@127.0.0.1:5672',
  INTERNAL_API_KEY: crypto.randomBytes(32).toString('base64url'),
  JWT_PRIVATE_KEY: escape(privateKey),
  JWT_PUBLIC_KEY: escape(publicKey),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  AUTH_SERVICE_URL: 'http://127.0.0.1:3001',
  STUDENT_SERVICE_URL: 'http://127.0.0.1:3002',
  ACADEMIC_SERVICE_URL: 'http://127.0.0.1:3003',
  FINANCE_SERVICE_URL: 'http://127.0.0.1:3004',
  NOTIFICATION_SERVICE_URL: 'http://127.0.0.1:3005',
  ANALYTICS_SERVICE_URL: 'http://127.0.0.1:3006',
  ELEARNING_SERVICE_URL: 'http://127.0.0.1:3007',
  ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  PROXY_TIMEOUT_MS: '600000',
  UPLOAD_DIR: path.join(root, '.local', 'uploads'),
};
fs.writeFileSync(output, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
console.log('Created backend/.env with local-only credentials.');
