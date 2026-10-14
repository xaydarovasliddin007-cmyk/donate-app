import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'superapp/public');
await mkdir(path.join(target, 'assets-store'), { recursive: true });
for (const [from, to] of [
  ['mobile/assets/branding/brand-profile.png', 'assets-store/brand.png'],
  ['mobile/assets/branding/brand-mark.svg', 'assets-store/brand.svg'],
  ['mobile/assets/branding/brand-bot-card.png', 'assets-store/brand-bot-card.png'],
  ['mobile/assets/branding/favicon.png', 'assets-store/favicon.png'],
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
