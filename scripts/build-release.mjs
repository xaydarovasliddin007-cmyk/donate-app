import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const project of ['admin', 'superapp']) {
  const directory = path.join(root, project);
  if (!existsSync(path.join(directory, 'node_modules')) || process.env.CI) execSync('npm ci --include=dev', { cwd: directory, stdio: 'inherit' });
  execSync('npm run build', { cwd: directory, stdio: 'inherit' });
  const destination = path.resolve(root, 'backend/public', project === 'superapp' ? 'webapp' : 'admin');
  const publicRoot = path.resolve(root, 'backend/public') + path.sep;
  if (!destination.startsWith(publicRoot)) throw new Error('Invalid build destination');
  mkdirSync(destination, { recursive: true });
  // Remove only previous generated bundles; keep unrelated public files.
  const assets = path.resolve(destination, 'assets');
  if (assets.startsWith(destination + path.sep) && existsSync(assets)) rmSync(assets, { recursive: true });
  for (const entry of readdirSync(path.join(directory, 'dist'))) {
    cpSync(path.join(directory, 'dist', entry), path.join(destination, entry), { recursive: true });
  }
}
execSync('npm run build', { cwd: path.join(root, 'backend'), stdio: 'inherit' });
