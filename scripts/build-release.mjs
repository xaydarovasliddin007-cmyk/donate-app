import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
function runInstalled(directory, cli, args) {
  execFileSync(process.execPath, [path.join(directory, 'node_modules', cli), ...args],
    { cwd: directory, stdio: 'inherit' });
}
for (const project of ['admin', 'superapp']) {
  const directory = path.join(root, project);
  if (!existsSync(path.join(directory, 'node_modules')) || process.env.CI) execSync('npm ci --include=dev', { cwd: directory, stdio: 'inherit' });
  if (project === 'superapp') execFileSync(process.execPath, [path.join(root, 'scripts/prepare-superapp.mjs')], { stdio: 'inherit' });
  runInstalled(directory, 'typescript/bin/tsc', project === 'admin' ? ['-b'] : []);
  runInstalled(directory, 'vite/bin/vite.js', ['build']);
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
runInstalled(path.join(root, 'backend'), 'typescript/bin/tsc', ['-p', 'tsconfig.json']);
