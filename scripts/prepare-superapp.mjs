import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'superapp/public');
await mkdir(path.join(target, 'assets-store'), { recursive: true });
for (const [from, to] of [
  ['mobile/assets/branding/app_icon_full.png', 'assets-store/brand.png'],
  ['landing/terms.html', 'terms.html'],
  ['landing/privacy.html', 'privacy.html'],
]) await copyFile(path.join(root, from), path.join(target, to));

const productIcons = await readdir(path.join(root, 'mobile/assets/icons'));
await Promise.all(productIcons
  .filter((file) => file.endsWith('.png'))
  .map((file) => copyFile(
    path.join(root, 'mobile/assets/icons', file),
    path.join(target, 'assets-store', file),
  )));
