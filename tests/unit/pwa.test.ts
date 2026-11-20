import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));

it('is named Wishbook', () => expect([manifest.name, manifest.short_name]).toEqual(['Wishbook', 'Wishbook']));
it('shares links into the add page', () => expect(manifest.share_target).toMatchObject({ action: '/add', method: 'GET', params: { text: 'share', url: 'url' } }));
it('ships every icon it lists', () => {
	for (const i of manifest.icons) expect(existsSync(`static${i.src}`)).toBe(true);
	expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
});
it('never mentions the old project name', () => expect(JSON.stringify(manifest).toLowerCase()).not.toContain('tinsel'));
