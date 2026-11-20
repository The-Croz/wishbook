import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { saveGift } from '../../src/lib/server/addGift';
import { getListForViewer } from '../../src/lib/server/lists';
import { POST as preview } from '../../src/routes/api/preview/+server';
import { makeManager, makeUser } from './helpers';

const fd = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};

let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
beforeEach(() => {
	createTestDb();
	josh = makeUser('josh'); kate = makeUser('kate'); milo = makeUser('milo', { isManaged: true });
	makeManager(milo.id, josh.id);
});

describe('saveGift', () => {
	it('adds a gift Amazon blocked, named after the site', () => {
		const item = saveGift(josh, { ownerId: josh.id }, fd({ url: 'https://www.amazon.com/dp/B0D7HXJ8QK', title: '', scrapeStatus: 'blocked', priority: 'want' }));
		expect(item).toMatchObject({ title: 'Gift from amazon.com', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', scrapeStatus: 'blocked' });
	});
	it('names the store from the link when the page could not be read', () => {
		const item = saveGift(josh, { ownerId: josh.id }, fd({ url: 'https://www.amazon.com/dp/B0D7HXJ8QK', title: 'Bonsai', scrapeStatus: 'blocked' }));
		expect(item.store).toBe('Amazon');
	});
	it('parses a typed price and keeps the note and priority', () => {
		const item = saveGift(josh, { ownerId: josh.id }, fd({ title: 'Kettle', price: '$165', notes: ' matte black ', priority: 'most' }));
		expect(item).toMatchObject({ priceCents: 16500, notes: 'matte black', priority: 'most', scrapeStatus: 'manual' });
	});
	it('refuses to add to another adult’s list', () => {
		expect(() => saveGift(kate, { ownerId: josh.id }, fd({ title: 'x' }))).toThrow(expect.objectContaining({ status: 403 }));
	});
	it('lets a manager add to a kid list', () => {
		saveGift(josh, { ownerId: milo.id }, fd({ title: 'Bike' }));
		expect(getListForViewer(josh, milo.id).items.map((i) => i.title)).toEqual(['Bike']);
	});
	it('edits an existing gift', () => {
		const item = saveGift(josh, { ownerId: josh.id }, fd({ title: 'Kettle' }));
		const edited = saveGift(josh, { ownerId: josh.id, editId: item.id }, fd({ title: 'Kettle, black', price: '' }));
		expect(edited).toMatchObject({ id: item.id, title: 'Kettle, black', priceCents: null });
	});
	it('rejects links that are not web links', () => {
		expect(() => saveGift(josh, { ownerId: josh.id }, fd({ title: 'x', url: 'javascript:alert(1)' }))).toThrow(expect.objectContaining({ status: 400 }));
	});
});

describe('preview endpoint', () => {
	it('requires sign-in', async () => {
		const req = new Request('http://x/api/preview', { method: 'POST', body: JSON.stringify({ text: 'https://example.com' }) });
		await expect(preview({ request: req, locals: { user: null } } as never)).rejects.toMatchObject({ status: 401 });
	});
});
