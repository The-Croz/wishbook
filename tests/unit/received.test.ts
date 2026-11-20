import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { claimItem } from '../../src/lib/server/claims';
import { createItem, getArchive, getListForViewer, getSeasons, markReceived } from '../../src/lib/server/lists';
import { makeUser } from './helpers';

let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>;
beforeEach(() => { createTestDb(); josh = makeUser('josh'); kate = makeUser('kate'); });

describe('markReceived', () => {
	it('only editors can mark received', () => {
		const i = createItem(josh, josh.id, { title: 'Kettle' }, 2026);
		expect(() => markReceived(kate, i.id, true)).toThrow(expect.objectContaining({ status: 403 }));
	});
	it('moves the gift from the list to the archive', () => {
		const i = createItem(josh, josh.id, { title: 'Kettle' }, 2026);
		markReceived(josh, i.id, true);
		expect(getListForViewer(josh, josh.id, 2026).items).toHaveLength(0);
		expect(getArchive(josh, josh.id, 2026).map((x) => x.title)).toEqual(['Kettle']);
	});
	it('can be undone', () => {
		const i = createItem(josh, josh.id, { title: 'Kettle' }, 2026);
		markReceived(josh, i.id, true);
		markReceived(josh, i.id, false);
		expect(getListForViewer(josh, josh.id, 2026).items).toHaveLength(1);
	});
});

describe('archive', () => {
	it('never shows the owner who gave what', () => {
		const i = createItem(josh, josh.id, { title: 'Kettle' }, 2026);
		claimItem(kate, i.id);
		markReceived(josh, i.id, true);
		const arch = getArchive(josh, josh.id, 2026);
		expect(arch.every((x) => !('claim' in x))).toBe(true);
		expect(JSON.stringify(arch)).not.toContain('Kate');
	});
	it('shows givers the claim on an archived gift', () => {
		const i = createItem(josh, josh.id, { title: 'Kettle' }, 2026);
		claimItem(kate, i.id);
		markReceived(josh, i.id, true);
		expect(getArchive(kate, josh.id, 2026)[0].claim?.claimerName).toBe('Kate');
	});
	it('lists past seasons with counts', () => {
		const a = createItem(josh, josh.id, { title: 'A' }, 2025);
		createItem(josh, josh.id, { title: 'B' }, 2025);
		markReceived(josh, a.id, true);
		createItem(josh, josh.id, { title: 'C' }, 2026); // B carries over into 2026
		expect(getSeasons(josh.id)).toEqual([{ season: 2026, count: 2 }, { season: 2025, count: 2 }]);
	});
});
