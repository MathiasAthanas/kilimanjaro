const fs = require('fs');
const path = require('path');

const serviceRoot = process.cwd();
const source = path.join(serviceRoot, 'generated', 'prisma');
const target = path.join(serviceRoot, 'dist', 'generated', 'prisma');

if (!fs.existsSync(source)) {
  console.warn(`[copy-prisma-generated] skipped: ${source} does not exist`);
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });

console.log(`[copy-prisma-generated] copied ${source} -> ${target}`);
