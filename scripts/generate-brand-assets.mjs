import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

// Raster exports are derived from the same editable vector used by web and Flutter.
// Install sharp in your toolchain, or set UZDONATE_SHARP_PATH to its module path.
const require = createRequire(import.meta.url);
const sharp = require(process.env.UZDONATE_SHARP_PATH || 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const branding = path.join(root, 'mobile/assets/branding');
const mark = await readFile(path.join(branding, 'brand-mark.svg'), 'utf8');
const glyph = mark.replace(/<rect[^>]*\/>/g, '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const frame = (size, inner, background = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background}${inner}</svg>`;
const placedGlyph = (size, glyphSize) => `<g transform="translate(${(size - glyphSize) / 2} ${(size - glyphSize) / 2}) scale(${glyphSize / 128})">${glyph}</g>`;
const ink = '#0A0D15';
const full = frame(1024, placedGlyph(1024, 840), `<rect width="1024" height="1024" fill="${ink}"/>`);
const foreground = frame(1024, placedGlyph(1024, 650));
const background = frame(1024, '', `<rect width="1024" height="1024" fill="${ink}"/>`);
const splash = frame(1152, `<g transform="translate(326 326) scale(3.90625)">${mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>`);
for (const [name, svg] of [
  ['brand-profile.png', full], ['app_icon_full.png', full],
  ['app_icon_fg.png', foreground], ['app_icon_bg.png', background],
  ['splash_logo.png', splash],
]) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(branding, name));
}
await sharp(Buffer.from(full)).jpeg({ quality: 94 }).toFile(path.join(branding, 'brand-profile.jpg'));

const botCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${ink}"/>
<path d="M860-50 510 680M1120-50 770 680M1380-50 1030 680" stroke="#15243B" stroke-width="100"/>
<path d="M0 530h1200" stroke="#26354A"/>
<g transform="translate(64 128) scale(2.7)">${mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>
<text x="466" y="266" font-family="Arial,sans-serif" font-weight="800" font-size="85" letter-spacing="-3" fill="#F5F8FF">UZ<tspan fill="#46DCEF">DONATE</tspan></text>
<text x="471" y="328" font-family="Arial,sans-serif" font-size="28" fill="#B5C3D7">O'yiningiz bilan birga.</text>
<rect x="471" y="369" width="164" height="4" rx="2" fill="#387BFF"/>
<text x="64" y="586" font-family="Arial,sans-serif" font-weight="600" font-size="22" fill="#B5C3D7">Mobile Legends</text>
<circle cx="272" cy="579" r="3" fill="#46DCEF"/>
<text x="295" y="586" font-family="Arial,sans-serif" font-weight="600" font-size="22" fill="#B5C3D7">PUBG Mobile</text>
<circle cx="474" cy="579" r="3" fill="#46DCEF"/>
<text x="497" y="586" font-family="Arial,sans-serif" font-weight="600" font-size="22" fill="#B5C3D7">Free Fire</text>
<text x="1136" y="586" text-anchor="end" font-family="Arial,sans-serif" font-weight="600" font-size="18" fill="#46DCEF">O'YINLAR / PAKETLAR / OBUNALAR</text>
</svg>`;
await writeFile(path.join(branding, 'brand-bot-card.svg'), botCard);
await sharp(Buffer.from(botCard)).png().toFile(path.join(branding, 'brand-bot-card.png'));
await sharp(Buffer.from(mark)).resize(64, 64).png().toFile(path.join(branding, 'favicon.png'));
await mkdir(path.join(root, 'admin/public'), { recursive: true });
await copyFile(path.join(branding, 'brand-mark.svg'), path.join(root, 'admin/public/brand.svg'));
console.log('Shared UD vector, launcher, splash, profile, bot card and favicon exports generated.');
