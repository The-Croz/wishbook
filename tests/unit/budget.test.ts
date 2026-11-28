import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { claims } from '../../src/lib/server/db/schema';
import { createItem } from '../../src/lib/server/lists';
import { claimItem, setPurchased } from '../../src/lib/server/claims';
import {
	acceptInvite, addGift, budgetForUser, addPerson, getBudget, invitePartner, removePerson, setLimit, setTotal, stopSharing, updateClaim, updateGift
} from '../../src/lib/server/budget';
import { makeUser, makeManager } from './helpers';

const S = 2026;
let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, june: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
beforeEach(() => {
	createTestDb();
	josh = makeUser('josh');
	kate = makeUser('kate');
	june = makeUser('june');
	milo = makeUser('milo', { isManaged: true });
	makeManager(milo.id, josh.id);
	makeManager(milo.id, kate.id);
});
const share = () => { invitePartner(josh, kate.id); acceptInvite(kate, josh.id); };
const person = (view: ReturnType<typeof getBudget>, name: string) => view.people.find((p) => p.name === name)!;
const gift = (owner: typeof josh, title: string, priceCents: number, quantity = 1) =>
	createItem(owner, owner.id, { title, priceCents, quantity }, S);

describe('budget', () => {
	it('lists everyone on Wishbook but me, with my claims and totals', () => {
		const socks = gift(june, 'Socks', 2400, 2);
		claimItem(josh, socks.id, 2);
		const b = getBudget(josh, S);
		expect(b.people.map((p) => p.name)).not.toContain('Josh');
		expect(person(b, 'June')).toMatchObject({ plannedCents: 4800, spentCents: 0 });
		expect(person(b, 'June').gifts[0]).toMatchObject({ source: 'wishbook', status: 'claimed', totalCents: 4800, quantity: 2 });
	});
	it('uses the final cost once entered, and counts it as spent once bought', () => {
		const socks = gift(june, 'Socks', 2400);
		claimItem(josh, socks.id);
		updateClaim(josh, socks.id, josh.id, { status: 'shipped', finalCents: 2711 });
		const b = getBudget(josh, S);
		expect(b).toMatchObject({ plannedCents: 2711, spentCents: 2711 });
		expect(getDb().select().from(claims).get()!.purchased).toBe(true);
	});
	it('adds people and gifts from outside Wishbook', () => {
		const p = addPerson(josh, 'Mr. Alvarez');
		setLimit(josh, S, `p:${p.id}`, 3000);
		addGift(josh, S, `p:${p.id}`, { title: 'Mug', url: 'shop.com/mug', priceCents: 1200, quantity: 2, status: 'arrived' });
		const b = getBudget(josh, S);
		expect(person(b, 'Mr. Alvarez')).toMatchObject({ kind: 'person', limitCents: 3000, plannedCents: 2400, spentCents: 2400 });
		expect(person(b, 'Mr. Alvarez').gifts[0].url).toBe('https://shop.com/mug');
	});
	it('sets an overall budget', () => {
		setTotal(josh, S, 150000);
		expect(getBudget(josh, S).totalCents).toBe(150000);
		setTotal(josh, S, null);
		expect(getBudget(josh, S).totalCents).toBeNull();
	});
	it('won’t let me budget for myself', () => {
		expect(() => setLimit(josh, S, `u:${josh.id}`, 100)).toThrow();
		expect(() => addGift(josh, S, `u:${josh.id}`, { title: 'Me' })).toThrow();
	});
	it('removing a person removes their gifts', () => {
		const p = addPerson(josh, 'Teacher');
		addGift(josh, S, `p:${p.id}`, { title: 'Card', priceCents: 500 });
		removePerson(josh, p.id);
		expect(getBudget(josh, S).plannedCents).toBe(0);
	});
});

describe('sharing with a spouse', () => {
	it('needs the other person to accept', () => {
		invitePartner(josh, kate.id);
		expect(getBudget(josh, S).partner).toBeNull();
		expect(getBudget(kate, S).invitesIn.map((i) => i.displayName)).toEqual(['Josh']);
		acceptInvite(kate, josh.id);
		expect(getBudget(josh, S).partner?.displayName).toBe('Kate');
	});
	it('inviting someone who already invited me just shares', () => {
		invitePartner(josh, kate.id);
		invitePartner(kate, josh.id);
		expect(getBudget(kate, S).partner?.displayName).toBe('Josh');
	});
	it('can’t share with a managed kid', () => {
		expect(() => invitePartner(josh, milo.id)).toThrow();
	});
	it('both see each other’s gifts for other people, and one budget', () => {
		share();
		claimItem(kate, gift(june, 'Scarf', 3000).id);
		addGift(josh, S, `u:${milo.id}`, { title: 'Bike bell', priceCents: 900 });
		setTotal(josh, S, 100000);
		const k = getBudget(kate, S);
		expect(k.totalCents).toBe(100000);
		expect(person(k, 'June').gifts[0].buyerName).toBe('Kate');
		expect(person(k, 'Milo').gifts[0].buyerName).toBe('Josh');
		expect(person(getBudget(josh, S), 'June').gifts[0].title).toBe('Scarf');
	});
	it('never shows me what my partner is buying me, but counts it', () => {
		share();
		const watch = gift(josh, 'Watch', 25000);
		claimItem(kate, watch.id);
		addGift(kate, S, `u:${josh.id}`, { title: 'Secret book', priceCents: 2000 });
		const j = getBudget(josh, S);
		expect(JSON.stringify(j)).not.toContain('Watch');
		expect(JSON.stringify(j)).not.toContain('Secret book');
		expect(j.people.find((p) => p.key === `u:${josh.id}`)).toBeUndefined();
		expect(j.hidden).toEqual({ fromName: 'Kate', count: 2 });
		expect(j.plannedCents).toBe(27000);
		// Kate sees them fine.
		expect(person(getBudget(kate, S), 'Josh').gifts.map((g) => g.title).sort()).toEqual(['Secret book', 'Watch']);
	});
	it('won’t let me edit gifts meant for me', () => {
		share();
		const watch = gift(josh, 'Watch', 25000);
		claimItem(kate, watch.id);
		const g = addGift(kate, S, `u:${josh.id}`, { title: 'Secret book' });
		expect(() => updateClaim(josh, watch.id, kate.id, { status: 'wrapped' })).toThrow();
		expect(() => updateGift(josh, g.id, { title: 'peek' })).toThrow();
	});
	it('lets either partner update the other’s claims for someone else', () => {
		share();
		const scarf = gift(june, 'Scarf', 3000);
		claimItem(kate, scarf.id);
		updateClaim(josh, scarf.id, kate.id, { status: 'wrapped' });
		expect(person(getBudget(kate, S), 'June').gifts[0].status).toBe('wrapped');
	});
	it('outsiders can’t touch our claims', () => {
		const scarf = gift(june, 'Scarf', 3000);
		claimItem(kate, scarf.id);
		expect(() => updateClaim(josh, scarf.id, kate.id, { status: 'wrapped' })).toThrow();
	});
	it('stopping keeps a copy of the plan and takes my own gifts along', () => {
		share();
		const p = addPerson(kate, 'Neighbor');
		setLimit(kate, S, `p:${p.id}`, 2000);
		addGift(josh, S, `p:${p.id}`, { title: 'Cookies', priceCents: 1500 });
		addGift(kate, S, `p:${p.id}`, { title: 'Candle', priceCents: 1800 });
		stopSharing(josh);
		const j = getBudget(josh, S), k = getBudget(kate, S);
		expect(j.partner).toBeNull();
		expect(person(j, 'Neighbor')).toMatchObject({ limitCents: 2000, plannedCents: 1500 });
		expect(person(k, 'Neighbor')).toMatchObject({ limitCents: 2000, plannedCents: 1800 });
	});
});

describe('budget on a person’s page', () => {
	it('shows my budget and spending for them', () => {
		setLimit(josh, S, `u:${june.id}`, 10000);
		claimItem(josh, gift(june, 'Socks', 2400).id);
		expect(budgetForUser(josh, june.id, S)).toMatchObject({ limitCents: 10000, plannedCents: 2400, spentCents: 0, giftCount: 1, shared: false });
	});
	it('is nothing on my own page', () => {
		expect(budgetForUser(josh, josh.id, S)).toBeNull();
	});
	it('on my spouse’s page, shows only what I can see', () => {
		share();
		claimItem(kate, gift(josh, 'Watch', 25000).id);
		claimItem(josh, gift(kate, 'Scarf', 3000).id);
		expect(budgetForUser(kate, josh.id, S)).toMatchObject({ plannedCents: 25000, giftCount: 1, shared: true });
		expect(budgetForUser(josh, kate.id, S)).toMatchObject({ plannedCents: 3000, giftCount: 1 });
	});
});

describe('the bought checkbox', () => {
	it('moves claimed to purchased and back, without undoing later steps', () => {
		const socks = gift(june, 'Socks', 2400);
		claimItem(josh, socks.id);
		const status = () => getDb().select().from(claims).where(eq(claims.itemId, socks.id)).get()!.status;
		setPurchased(josh, socks.id, true);
		expect(status()).toBe('purchased');
		updateClaim(josh, socks.id, josh.id, { status: 'arrived' });
		setPurchased(josh, socks.id, true);
		expect(status()).toBe('arrived');
		setPurchased(josh, socks.id, false);
		expect(status()).toBe('claimed');
	});
});
