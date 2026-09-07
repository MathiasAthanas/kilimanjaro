#!/usr/bin/env node
/* Bootstrap a fresh local database from the repository baseline and apply tenant upgrades. */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) throw new Error('Missing backend/.env. Run: node scripts/setup-local-env.js');
const env = { ...process.env };
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const at = line.indexOf('=');
  if (at > 0) env[line.slice(0, at)] = line.slice(at + 1);
}
const services = ['auth-service', 'student-service', 'academic-service', 'finance-service', 'notification-service', 'elearning-service', 'api-gateway', 'analytics-service'];
const baseline = 'a87c805928dc962230111f4288da7bc62997a75e';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}
function sql(input) {
  run('psql', [env.DATABASE_URL, '-X', '-v', 'ON_ERROR_STOP=1'], { input, stdio: ['pipe', 'inherit', 'inherit'] });
}

const tableCount = spawnSync('psql', [env.DATABASE_URL, '-X', '-A', '-t', '-c', "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast');"], { cwd: root, env, encoding: 'utf8' });
if (tableCount.status !== 0) process.exit(tableCount.status || 1);
if (Number(tableCount.stdout.trim()) !== 0) {
  throw new Error('The local database is not empty. This bootstrap only initializes a fresh local database; do not use it against an existing environment.');
}

for (const service of services) {
  const schemaText = spawnSync('git', ['show', `${baseline}:backend/services/${service}/prisma/schema.prisma`], { cwd: path.resolve(root, '..'), env, encoding: 'utf8' });
  if (schemaText.status !== 0) process.exit(schemaText.status || 1);
  const schemaPath = path.join(root, `.local-${service}.prisma`);
  fs.writeFileSync(schemaPath, schemaText.stdout);
  const diff = spawnSync(path.join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'], { cwd: root, env, encoding: 'utf8' });
  fs.unlinkSync(schemaPath);
  if (diff.status !== 0) process.exit(diff.status || 1);
  const ddl = service === 'analytics-service'
    ? `${diff.stdout.split(';').filter((statement) => statement.includes('"analytics"')).join(';')};`
    : diff.stdout;
  sql(ddl);
}

for (const service of services) {
  const migrationsPath = path.join(root, 'services', service, 'prisma', 'migrations');
  for (const migration of fs.readdirSync(migrationsPath).filter((name) => name.startsWith('20260906')).sort()) {
    sql(fs.readFileSync(path.join(migrationsPath, migration, 'migration.sql'), 'utf8'));
  }
}
sql(fs.readFileSync(path.join(root, 'scripts', 'school-integrity.sql'), 'utf8'));
console.log('Local database initialized with the current tenant schema.');
