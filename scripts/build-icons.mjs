// Builds app icons and outlined logo files from design/brand/.  Run: node scripts/build-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import opentype from 'opentype.js';

const font = opentype.parse(readFileSync('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff').buffer);

/** Replaces each Archivo Black <text> with an outlined <path>, honoring x, y, font-size, fill, letter-spacing, text-anchor. */
function outline(svg) {
	return svg
		.replace(/<style>[^<]*<\/style>/g, '')
		.replace(/<text([^>]*)>([^<]*)<\/text>/g, (m, attrs, text) => {
			const a = (k) => attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1];
			if (!/Archivo Black/.test(a('font-family') ?? '')) return m;
			const size = Number(a('font-size'));
			const spacing = Number(a('letter-spacing') ?? 0);
			let x = Number(a('x'));
			const y = Number(a('y'));
			const glyphs = font.stringToGlyphs(text);
			const width = glyphs.reduce((w, g) => w + (g.advanceWidth / font.unitsPerEm) * size + spacing, 0) - spacing;
			if (a('text-anchor') === 'middle') x -= width / 2;
			const d = [];
			for (const g of glyphs) {
				d.push(g.getPath(x, y, size).toPathData(2));
				x += (g.advanceWidth / font.unitsPerEm) * size + spacing;
			}
			return `<path fill="${a('fill')}" d="${d.join('')}"/>`;
		});
}

mkdirSync('static/brand', { recursive: true });
mkdirSync('static/icons', { recursive: true });
for (const name of ['logo', 'logo-on-red']) {
	const out = outline(readFileSync(`design/brand/${name}.svg`, 'utf8'));
	writeFileSync(`design/brand/${name}.svg`, out);
	writeFileSync(`static/brand/${name}.svg`, out);
}

const icon = readFileSync('design/brand/icon.svg');
const maskable = readFileSync('design/brand/icon-maskable.svg');
const png = (src, size, file) => sharp(src, { density: 600 }).resize(size, size).png().toFile(`static/icons/${file}`);
await png(icon, 192, 'icon-192.png');
await png(icon, 512, 'icon-512.png');
await png(maskable, 512, 'maskable-512.png');
await png(maskable, 180, 'apple-touch-180.png');
writeFileSync('static/favicon.svg', readFileSync('design/brand/icon-maskable.svg'));
console.log('icons and outlined logos written');
