import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { fetchElfsterWishes, importWishes, parseElfsterLink, toImportRows } from '../../src/lib/server/elfster';
import { createItem, getListForViewer } from '../../src/lib/server/lists';
import { makeUser } from './helpers';

const wishes = JSON.parse(readFileSync(new URL('../fixtures/elfster-wishes.json', import.meta.url), 'utf8'));
const LINK = 'https://www.elfster.com/profile/ef7859f3-f6d2-42a1-8453-c22e98138bac/wish-lists/67565494-235c-4360-919b-13c4f16ac301';

describe('parseElfsterLink', () => {
	it('finds the wish list id', () => expect(parseElfsterLink(LINK)).toBe('67565494-235c-4360-919b-13c4f16ac301'));
	it('accepts share text around the link', () => expect(parseElfsterLink(`Here's my list! ${LINK}?share=1`)).toBe('67565494-235c-4360-919b-13c4f16ac301'));
	it('rejects other links', () => expect(parseElfsterLink('https://www.amazon.com/dp/B0X')).toBeNull());
});

describe('fetchElfsterWishes', () => {
	it('pages through the list', async () => {
		const calls: string[] = [];
		const all = Array.from({ length: 55 }, (_, i) => ({ ...wishes[1], wishId: `w${i}` }));
		const fake = (async (url: string) => {
			calls.push(url);
			const off = Number(new URL(url).searchParams.get('offset'));
			return { ok: true, status: 200, json: async () => all.slice(off, off + 50) } as Response;
		}) as unknown as typeof fetch;
		expect(await fetchElfsterWishes('L1', fake)).toHaveLength(55);
		expect(calls[0]).toBe('https://www.elfster.com/v1/wishlists/L1/wishes?limit=50&offset=0');
	});
	it('explains a private or missing list', async () => {
		const fake = (async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response) as unknown as typeof fetch;
		await expect(fetchElfsterWishes('L1', fake)).rejects.toThrow('Elfster didn’t share that list. Make sure it’s set to public.');
	});
});

describe('toImportRows', () => {
	const rows = toImportRows(wishes);
	it('cleans links, prices, and most-wanted', () => {
		expect(rows[0]).toMatchObject({ title: 'Sourdough starter warmer', url: 'https://www.amazon.com/dp/B0TEST0001', priceCents: 17900, priority: 'most', imageUrl: 'https://cdn.example/img1.jpg', store: 'Amazon', selected: true });
		expect(rows[1]).toMatchObject({ title: 'Gardening gloves, size S', notes: 'Green if they have it', priceCents: 2450, url: 'https://www.etsy.com/listing/123/gloves', imageUrl: null });
		expect(rows[2]).toMatchObject({ url: null, priceCents: null, selected: true });
	});
	it('leaves received gifts unticked', () => expect(rows[3]).toMatchObject({ selected: false, reason: 'Already received on Elfster' }));
	it('unticks duplicates of the same product', () => expect(rows[4]).toMatchObject({ selected: false, reason: 'Same link as another gift' }));
});

describe('importWishes', () => {
	let admin: ReturnType<typeof makeUser>, mom: ReturnType<typeof makeUser>;
	beforeEach(() => { createTestDb(); admin = makeUser('josh', { isAdmin: true }); mom = makeUser('lisa'); });
	it('adds the chosen gifts to the person’s list, skipping links already there', () => {
		createItem(mom, mom.id, { title: 'Old', url: 'https://www.amazon.com/dp/B0TEST0001' }, 2026);
		const r = importWishes(admin, mom.id, toImportRows(wishes).filter((x) => x.selected), 2026);
		expect(r).toEqual({ added: 2, skipped: 1 });
		expect(getListForViewer(mom, mom.id, 2026).items.map((i) => i.title).sort()).toEqual(['Gardening gloves, size S', 'Gift card to the bookstore', 'Old']);
	});
	it('is admin only', () => {
		expect(() => importWishes(mom, mom.id, [], 2026)).toThrow(expect.objectContaining({ status: 403 }));
	});
});
