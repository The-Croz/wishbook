import { describe, expect, it } from 'vitest';
import { canEditList, canSeeClaims, toItemView, toListSummary } from '../../src/lib/server/visibility';
import type { Item, User } from '../../src/lib/server/db/schema';

const u = (id: number, name: string, extra: Partial<User> = {}): User => ({
	id, username: name.toLowerCase(), displayName: name, passwordHash: null, isAdmin: false, isManaged: false,
	isActive: true, avatarColor: '#F2B705', avatarPhoto: null, birthYear: null, createdAt: new Date(), ...extra
});
const josh = u(1, 'Josh'), kate = u(2, 'Kate'), milo = u(3, 'Milo', { isManaged: true }), june = u(4, 'June');
const item = (id: number, extra: Partial<Item> = {}): Item => ({
	id, listId: 1, title: 'Socks', url: null, imageUrl: null, store: null, priceCents: 2400, listPriceCents: null,
	currency: 'USD', priceCheckedAt: null, notes: '', priority: 'want', quantity: 1, status: 'active', sortOrder: 0, createdBy: 1,
	createdAt: new Date(), updatedAt: new Date(), deletedAt: null, contentChangedAt: null, announcedAt: null, scrapeStatus: 'manual', ...extra
});
const claimBy = (who: User, itemId = 1) => ({ itemId, claimerId: who.id, claimerName: who.displayName, quantity: 1, createdAt: new Date(), purchased: false, status: 'claimed' as const, finalCents: null });

describe('canSeeClaims', () => {
	it('hides claims from the owner', () => expect(canSeeClaims(josh, josh.id)).toBe(false));
	it('shows claims to other adults', () => expect(canSeeClaims(kate, josh.id)).toBe(true));
	it('shows claims to a managing parent on a kid list', () => expect(canSeeClaims(josh, milo.id)).toBe(true));
});

describe('canEditList', () => {
	it('lets the owner edit', () => expect(canEditList(josh, josh.id, [])).toBe(true));
	it('lets a manager edit the kid list', () => expect(canEditList(josh, milo.id, [josh.id])).toBe(true));
	it('stops other adults', () => expect(canEditList(kate, josh.id, [])).toBe(false));
	it('does not let admins edit other lists', () => expect(canEditList({ ...kate, isAdmin: true }, josh.id, [])).toBe(false));
});

describe('toItemView', () => {
	it('omits the claims key entirely for the owner', () => {
		const v = toItemView(josh, josh.id, item(1), [claimBy(kate)]);
		expect('claims' in v).toBe(false);
		expect(JSON.stringify(v)).not.toContain('Kate');
	});
	it('marks my own claim', () => {
		expect(toItemView(kate, josh.id, item(1), [claimBy(kate)]).claims?.[0]).toMatchObject({ isMine: true, claimerName: 'Kate' });
	});
	it('shows someone else’s claim to a giver', () => {
		expect(toItemView(milo, josh.id, item(1), [claimBy(kate)]).claims?.[0]).toMatchObject({ isMine: false, claimerName: 'Kate' });
	});
	it('gives a giver an empty claims list when nobody has claimed it', () => {
		expect(toItemView(kate, josh.id, item(1), []).claims).toEqual([]);
	});
});

describe('toListSummary', () => {
	const items = [item(1), item(2), item(3, { deletedAt: new Date() }), item(4, { status: 'received' })];
	const claims = [claimBy(kate, 1)];
	it('omits claimedCount for the owner', () => {
		const s = toListSummary(josh, josh, items, claims, []);
		expect('claimedCount' in s).toBe(false);
		expect(s.wantCount).toBe(2);
	});
	it('counts claims for a giver', () => {
		expect(toListSummary(kate, josh, items, claims, [])).toMatchObject({ wantCount: 2, claimedCount: 1 });
	});
	it('counts a gift as claimed only once every wanted one is spoken for', () => {
		const its = [item(1, { quantity: 3 }), item(2, { quantity: 2 })];
		const cl = [{ ...claimBy(kate, 1), quantity: 2 }, { ...claimBy(kate, 2), quantity: 1 }, { ...claimBy(milo, 2), quantity: 1 }];
		expect(toListSummary(josh, josh, its, cl, [])).not.toHaveProperty('claimedCount');
		expect(toListSummary(june, josh, its, cl, []).claimedCount).toBe(1);
	});
	it('flags kid lists the viewer manages', () => {
		expect(toListSummary(josh, milo, [], [], [josh.id]).managedByMe).toBe(true);
	});
});
