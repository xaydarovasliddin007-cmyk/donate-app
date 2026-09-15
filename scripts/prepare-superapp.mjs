import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'superapp/public');
await mkdir(path.join(target, 'assets-store'), { recursive: true });
for (const [from, to] of [
  ['mobile/assets/branding/app_icon_full.png', 'assets-store/brand.png'],
  ['mobile/assets/icons/diamond.png', 'assets-store/diamond.png'],
  ['landing/terms.html', 'terms.html'],
  ['landing/privacy.html', 'privacy.html'],
]) await copyFile(path.join(root, from), path.join(target, to));
