import { describe, expect, it } from 'vitest';
import { canEditList, canSeeClaims, toItemView, toListSummary } from '../../src/lib/server/visibility';
import type { Item, User } from '../../src/lib/server/db/schema';

const u = (id: number, name: string, extra: Partial<User> = {}): User => ({
	id, username: name.toLowerCase(), displayName: name, passwordHash: null, isAdmin: false, isManaged: false,
	isActive: true, avatarColor: '#F2B705', birthYear: null, createdAt: new Date(), ...extra
});
const josh = u(1, 'Josh'), kate = u(2, 'Kate'), milo = u(3, 'Milo', { isManaged: true });
const item = (id: number, extra: Partial<Item> = {}): Item => ({
	id, listId: 1, title: 'Socks', url: null, imageUrl: null, store: null, priceCents: 2400, listPriceCents: null,
	currency: 'USD', priceCheckedAt: null, notes: '', priority: 'want', status: 'active', sortOrder: 0, createdBy: 1,
	createdAt: new Date(), updatedAt: new Date(), deletedAt: null, contentChangedAt: null, scrapeStatus: 'manual', ...extra
});
const claimBy = (who: User, itemId = 1) => ({ itemId, claimerId: who.id, claimerName: who.displayName, createdAt: new Date(), purchased: false });

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
	it('omits the claim key entirely for the owner', () => {
		const v = toItemView(josh, josh.id, item(1), claimBy(kate));
		expect('claim' in v).toBe(false);
		expect(JSON.stringify(v)).not.toContain('Kate');
	});
	it('marks my own claim', () => {
		expect(toItemView(kate, josh.id, item(1), claimBy(kate)).claim).toMatchObject({ isMine: true, claimerName: 'Kate' });
	});
	it('shows someone else’s claim to a giver', () => {
		expect(toItemView(milo, josh.id, item(1), claimBy(kate)).claim).toMatchObject({ isMine: false, claimerName: 'Kate' });
	});
	it('omits the claim key when nobody has claimed it', () => {
		expect('claim' in toItemView(kate, josh.id, item(1), null)).toBe(false);
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
	it('flags kid lists the viewer manages', () => {
		expect(toListSummary(josh, milo, [], [], [josh.id]).managedByMe).toBe(true);
	});
});
