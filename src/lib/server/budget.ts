/**
 * The family budget: what each household plans to spend, on whom, and where every gift is.
 *
 * A household is a "budget book". Everyone has their own until two people share,
 * then both point at one book. Gifts come from two places: Wishbook claims made by
 * anyone in the book, and gifts added by hand for purchases made outside Wishbook.
 *
 * The surprise is sacred here too: a viewer never sees gifts for themselves, even
 * ones their partner bought. Those only count toward the totals.
 */
import { error } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import { getDb } from './db';
import {
	budgetBooks, budgetGifts, budgetInvites, budgetLimits, budgetMembers, budgetPeople, budgetTotals,
	claims, items, lists, users, GIFT_STATUSES, type GiftStatus, type User
} from './db/schema';

export { GIFT_STATUSES, type GiftStatus };

/** "u:<user id>" for someone on Wishbook, "p:<budget person id>" for someone who isn't. */
export type RecipientKey = `u:${number}` | `p:${number}`;

export type BudgetGift = {
	/** "c:<item>:<claimer>" for a Wishbook claim, "g:<id>" for a gift added here. */
	key: string;
	source: 'wishbook' | 'own';
	title: string;
	url: string | null;
	imageUrl: string | null;
	store: string | null;
	quantity: number;
	/** Price of one, if known. */
	unitCents: number | null;
	finalCents: number | null;
	/** finalCents if entered, otherwise price × quantity. */
	totalCents: number | null;
	status: GiftStatus;
	buyerId: number;
	buyerName: string;
	/** The owner took it off their list after it was claimed. */
	removed: boolean;
	itemId: number | null;
};

export type BudgetPerson = {
	key: RecipientKey;
	name: string;
	kind: 'user' | 'person';
	avatarColor: string | null;
	avatarPhoto: string | null;
	limitCents: number | null;
	plannedCents: number;
	spentCents: number;
	gifts: BudgetGift[];
};

export type BudgetView = {
	season: number;
	members: { id: number; displayName: string }[];
	partner: { id: number; displayName: string } | null;
	/** Invites I sent that are waiting, and ones waiting for me. */
	invitesOut: { id: number; displayName: string }[];
	invitesIn: { id: number; displayName: string }[];
	/** Who I could share with: grown-ups on Wishbook who aren't already sharing with someone. */
	canInvite: { id: number; displayName: string }[];
	totalCents: number | null;
	plannedCents: number;
	spentCents: number;
	people: BudgetPerson[];
	/** Gifts my partner is buying for me: counted in the totals, never shown. */
	hidden: { fromName: string; count: number } | null;
};

const SPENT: GiftStatus[] = ['purchased', 'shipped', 'arrived', 'wrapped'];
export const isSpent = (s: GiftStatus) => SPENT.includes(s);

/** The viewer's budget book, made the first time they need one. */
export function bookOf(userId: number): number {
	const db = getDb();
	const m = db.select().from(budgetMembers).where(eq(budgetMembers.userId, userId)).get();
	if (m) return m.bookId;
	const [b] = db.insert(budgetBooks).values({}).returning().all();
	db.insert(budgetMembers).values({ userId, bookId: b.id }).run();
	return b.id;
}

function memberIds(bookId: number): number[] {
	return getDb().select({ id: budgetMembers.userId }).from(budgetMembers).where(eq(budgetMembers.bookId, bookId)).all().map((r) => r.id);
}

function partnerOf(userId: number): number | null {
	return memberIds(bookOf(userId)).find((id) => id !== userId) ?? null;
}

// ---------- sharing ----------

/** Asks someone to share a budget. If they already asked me, we're sharing now. */
export function invitePartner(viewer: User, toId: number) {
	if (toId === viewer.id) error(400, 'You can’t share with yourself');
	const to = getDb().select().from(users).where(eq(users.id, toId)).get();
	if (!to || !to.isActive || to.isManaged) error(400, 'Pick a grown-up on Wishbook');
	if (partnerOf(viewer.id)) error(400, 'You already share your budget. Stop sharing first.');
	if (partnerOf(toId)) error(400, `${to.displayName} already shares a budget with someone`);
	const db = getDb();
	if (db.select().from(budgetInvites).where(and(eq(budgetInvites.fromId, toId), eq(budgetInvites.toId, viewer.id))).get()) {
		acceptInvite(viewer, toId);
		return;
	}
	db.insert(budgetInvites).values({ fromId: viewer.id, toId }).onConflictDoNothing().run();
}

export function cancelInvite(viewer: User, toId: number) {
	getDb().delete(budgetInvites).where(and(eq(budgetInvites.fromId, viewer.id), eq(budgetInvites.toId, toId))).run();
}

export function declineInvite(viewer: User, fromId: number) {
	getDb().delete(budgetInvites).where(and(eq(budgetInvites.fromId, fromId), eq(budgetInvites.toId, viewer.id))).run();
}

/**
 * Joins the inviter's book. Anything I'd already set up comes along: my people,
 * budgets they don't already have, and gifts I added.
 */
export function acceptInvite(viewer: User, fromId: number) {
	const db = getDb();
	if (!db.select().from(budgetInvites).where(and(eq(budgetInvites.fromId, fromId), eq(budgetInvites.toId, viewer.id))).get()) {
		error(400, 'That invite isn’t there anymore');
	}
	if (partnerOf(viewer.id) || partnerOf(fromId)) error(400, 'One of you already shares a budget');
	const mine = bookOf(viewer.id);
	const theirs = bookOf(fromId);
	db.transaction((tx) => {
		tx.update(budgetPeople).set({ bookId: theirs }).where(eq(budgetPeople.bookId, mine)).run();
		tx.update(budgetGifts).set({ bookId: theirs }).where(eq(budgetGifts.bookId, mine)).run();
		for (const l of tx.select().from(budgetLimits).where(eq(budgetLimits.bookId, mine)).all()) {
			tx.insert(budgetLimits).values({ ...l, bookId: theirs }).onConflictDoNothing().run();
		}
		for (const t of tx.select().from(budgetTotals).where(eq(budgetTotals.bookId, mine)).all()) {
			tx.insert(budgetTotals).values({ ...t, bookId: theirs }).onConflictDoNothing().run();
		}
		tx.delete(budgetLimits).where(eq(budgetLimits.bookId, mine)).run();
		tx.delete(budgetTotals).where(eq(budgetTotals.bookId, mine)).run();
		tx.update(budgetMembers).set({ bookId: theirs }).where(eq(budgetMembers.userId, viewer.id)).run();
		tx.delete(budgetBooks).where(eq(budgetBooks.id, mine)).run();
		tx.delete(budgetInvites).where(or(
			inArray(budgetInvites.fromId, [viewer.id, fromId]),
			inArray(budgetInvites.toId, [viewer.id, fromId])
		)).run();
	});
}

/**
 * Stops sharing. I get my own book with a copy of the plan (budgets and people),
 * and the gifts I added come with me. My partner keeps the shared book.
 */
export function stopSharing(viewer: User) {
	const db = getDb();
	const shared = bookOf(viewer.id);
	if (memberIds(shared).length < 2) return;
	db.transaction((tx) => {
		const [b] = tx.insert(budgetBooks).values({}).returning().all();
		const personMap = new Map<number, number>();
		for (const p of tx.select().from(budgetPeople).where(eq(budgetPeople.bookId, shared)).all()) {
			const [np] = tx.insert(budgetPeople).values({ bookId: b.id, name: p.name, createdBy: p.createdBy }).returning().all();
			personMap.set(p.id, np.id);
		}
		for (const l of tx.select().from(budgetLimits).where(eq(budgetLimits.bookId, shared)).all()) {
			const recipient = l.recipient.startsWith('p:') ? `p:${personMap.get(Number(l.recipient.slice(2)))}` : l.recipient;
			tx.insert(budgetLimits).values({ ...l, bookId: b.id, recipient }).run();
		}
		for (const t of tx.select().from(budgetTotals).where(eq(budgetTotals.bookId, shared)).all()) {
			tx.insert(budgetTotals).values({ ...t, bookId: b.id }).run();
		}
		for (const g of tx.select().from(budgetGifts).where(and(eq(budgetGifts.bookId, shared), eq(budgetGifts.buyerId, viewer.id))).all()) {
			tx.update(budgetGifts).set({
				bookId: b.id,
				recipientPersonId: g.recipientPersonId != null ? personMap.get(g.recipientPersonId)! : null
			}).where(eq(budgetGifts.id, g.id)).run();
		}
		tx.update(budgetMembers).set({ bookId: b.id }).where(eq(budgetMembers.userId, viewer.id)).run();
	});
}

// ---------- reading ----------

const giftTotal = (unit: number | null, qty: number, final: number | null) => final ?? (unit != null ? unit * qty : null);

export function getBudget(viewer: User, season: number): BudgetView {
	const db = getDb();
	const bookId = bookOf(viewer.id);
	const ids = memberIds(bookId);
	const everyone = db.select().from(users).all();
	const byId = new Map(everyone.map((u) => [u.id, u]));
	const name = (id: number) => byId.get(id)?.displayName ?? 'Someone';

	type Row = BudgetGift & { recipient: RecipientKey };
	const rows: Row[] = [];

	for (const r of db.select({ claim: claims, item: items, ownerId: lists.ownerId }).from(claims)
		.innerJoin(items, eq(items.id, claims.itemId))
		.innerJoin(lists, eq(lists.id, items.listId))
		.where(and(inArray(claims.claimerId, ids), eq(lists.season, season))).all()) {
		rows.push({
			key: `c:${r.item.id}:${r.claim.claimerId}`,
			source: 'wishbook',
			recipient: `u:${r.ownerId}`,
			title: r.item.title,
			url: r.item.url,
			imageUrl: r.item.imageUrl,
			store: r.item.store,
			quantity: r.claim.quantity,
			unitCents: r.item.priceCents,
			finalCents: r.claim.finalCents,
			totalCents: giftTotal(r.item.priceCents, r.claim.quantity, r.claim.finalCents),
			status: r.claim.status,
			buyerId: r.claim.claimerId,
			buyerName: name(r.claim.claimerId),
			removed: r.item.deletedAt != null,
			itemId: r.item.id
		});
	}
	for (const g of db.select().from(budgetGifts).where(and(eq(budgetGifts.bookId, bookId), eq(budgetGifts.season, season))).all()) {
		rows.push({
			key: `g:${g.id}`,
			source: 'own',
			recipient: g.recipientUserId != null ? `u:${g.recipientUserId}` : `p:${g.recipientPersonId!}`,
			title: g.title,
			url: g.url,
			imageUrl: null,
			store: null,
			quantity: g.quantity,
			unitCents: g.priceCents,
			finalCents: g.finalCents,
			totalCents: giftTotal(g.priceCents, g.quantity, g.finalCents),
			status: g.status,
			buyerId: g.buyerId,
			buyerName: name(g.buyerId),
			removed: false,
			itemId: null
		});
	}

	const limits = new Map(db.select().from(budgetLimits).where(and(eq(budgetLimits.bookId, bookId), eq(budgetLimits.season, season))).all()
		.map((l) => [l.recipient, l.cents]));
	const people = new Map<RecipientKey, BudgetPerson>();
	const person = (key: RecipientKey, name: string, kind: BudgetPerson['kind'], u?: User): BudgetPerson => ({
		key, name, kind, avatarColor: u?.avatarColor ?? null, avatarPhoto: u?.avatarPhoto ?? null,
		limitCents: limits.get(key) ?? null, plannedCents: 0, spentCents: 0, gifts: []
	});
	for (const u of everyone) {
		if (u.id === viewer.id || !u.isActive) continue;
		people.set(`u:${u.id}`, person(`u:${u.id}`, u.displayName, 'user', u));
	}
	for (const p of db.select().from(budgetPeople).where(eq(budgetPeople.bookId, bookId)).all()) {
		people.set(`p:${p.id}`, person(`p:${p.id}`, p.name, 'person'));
	}

	let planned = 0;
	let spent = 0;
	const hiddenFrom = new Map<number, number>();
	for (const { recipient, ...g } of rows) {
		const cents = g.removed && !isSpent(g.status) ? 0 : (g.totalCents ?? 0);
		planned += cents;
		if (isSpent(g.status)) spent += cents;
		if (recipient === `u:${viewer.id}`) {
			hiddenFrom.set(g.buyerId, (hiddenFrom.get(g.buyerId) ?? 0) + 1);
			continue;
		}
		let p = people.get(recipient);
		if (!p) {
			// Someone no longer active who still has gifts this year.
			const u = byId.get(Number(recipient.slice(2)));
			p = person(recipient, u?.displayName ?? 'Someone', 'user', u);
			people.set(recipient, p);
		}
		p.gifts.push(g);
		p.plannedCents += cents;
		if (isSpent(g.status)) p.spentCents += cents;
	}

	const STATUS_ORDER = Object.fromEntries(GIFT_STATUSES.map((s, i) => [s, i]));
	const list = [...people.values()];
	for (const p of list) p.gifts.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title));
	const isPlanned = (p: BudgetPerson) => Number(p.kind === 'person' || p.gifts.length > 0 || p.limitCents != null);
	list.sort((a, b) => isPlanned(b) - isPlanned(a) || a.name.localeCompare(b.name));

	const partnerId = ids.find((id) => id !== viewer.id) ?? null;
	const bookSizes = new Map<number, number[]>();
	for (const r of db.select().from(budgetMembers).all()) bookSizes.set(r.bookId, [...(bookSizes.get(r.bookId) ?? []), r.userId]);
	const sharing = new Set([...bookSizes.values()].filter((g) => g.length > 1).flat());
	const out = db.select().from(budgetInvites).where(eq(budgetInvites.fromId, viewer.id)).all();
	const inc = db.select().from(budgetInvites).where(eq(budgetInvites.toId, viewer.id)).all();
	const brief = (id: number) => ({ id, displayName: name(id) });
	const hiddenCount = [...hiddenFrom.values()].reduce((a, b) => a + b, 0);

	return {
		season,
		members: ids.map(brief),
		partner: partnerId ? brief(partnerId) : null,
		invitesOut: out.map((i) => brief(i.toId)),
		invitesIn: inc.map((i) => brief(i.fromId)),
		canInvite: partnerId ? [] : everyone
			.filter((u) => u.id !== viewer.id && u.isActive && !u.isManaged && !sharing.has(u.id))
			.map((u) => brief(u.id)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
		totalCents: db.select().from(budgetTotals).where(and(eq(budgetTotals.bookId, bookId), eq(budgetTotals.season, season))).get()?.cents ?? null,
		plannedCents: planned,
		spentCents: spent,
		people: list,
		hidden: hiddenCount ? { fromName: [...hiddenFrom.keys()].map(name).join(' & '), count: hiddenCount } : null
	};
}

// ---------- editing ----------

export function setTotal(viewer: User, season: number, cents: number | null) {
	const bookId = bookOf(viewer.id);
	const db = getDb();
	if (cents == null) db.delete(budgetTotals).where(and(eq(budgetTotals.bookId, bookId), eq(budgetTotals.season, season))).run();
	else db.insert(budgetTotals).values({ bookId, season, cents }).onConflictDoUpdate({ target: [budgetTotals.bookId, budgetTotals.season], set: { cents } }).run();
}

/** Checks a recipient belongs in the viewer's budget, and isn't the viewer. */
function checkRecipient(viewer: User, key: string): RecipientKey {
	const m = key.match(/^([up]):(\d+)$/);
	if (!m) error(400, 'Pick who it’s for');
	const id = Number(m[2]);
	if (m[1] === 'u') {
		if (id === viewer.id) error(400, 'That’s you');
		if (!getDb().select().from(users).where(eq(users.id, id)).get()) error(400, 'Pick who it’s for');
	} else {
		const p = getDb().select().from(budgetPeople).where(eq(budgetPeople.id, id)).get();
		if (!p || p.bookId !== bookOf(viewer.id)) error(400, 'Pick who it’s for');
	}
	return key as RecipientKey;
}

export function setLimit(viewer: User, season: number, key: string, cents: number | null) {
	const recipient = checkRecipient(viewer, key);
	const bookId = bookOf(viewer.id);
	const db = getDb();
	const where = and(eq(budgetLimits.bookId, bookId), eq(budgetLimits.season, season), eq(budgetLimits.recipient, recipient));
	if (cents == null) db.delete(budgetLimits).where(where).run();
	else db.insert(budgetLimits).values({ bookId, season, recipient, cents })
		.onConflictDoUpdate({ target: [budgetLimits.bookId, budgetLimits.season, budgetLimits.recipient], set: { cents } }).run();
}

export function addPerson(viewer: User, rawName: string) {
	const name = rawName.trim().slice(0, 80);
	if (!name) error(400, 'Give them a name');
	const [p] = getDb().insert(budgetPeople).values({ bookId: bookOf(viewer.id), name, createdBy: viewer.id }).returning().all();
	return p;
}

function ownPerson(viewer: User, id: number) {
	const p = getDb().select().from(budgetPeople).where(eq(budgetPeople.id, id)).get();
	if (!p || p.bookId !== bookOf(viewer.id)) error(404, 'Person not found');
	return p;
}

export function renamePerson(viewer: User, id: number, rawName: string) {
	ownPerson(viewer, id);
	const name = rawName.trim().slice(0, 80);
	if (!name) error(400, 'Give them a name');
	getDb().update(budgetPeople).set({ name }).where(eq(budgetPeople.id, id)).run();
}

/** Removes someone added here, along with their gifts and budgets. */
export function removePerson(viewer: User, id: number) {
	const p = ownPerson(viewer, id);
	getDb().transaction((tx) => {
		tx.delete(budgetGifts).where(eq(budgetGifts.recipientPersonId, id)).run();
		tx.delete(budgetLimits).where(and(eq(budgetLimits.bookId, p.bookId), eq(budgetLimits.recipient, `p:${id}`))).run();
		tx.delete(budgetPeople).where(eq(budgetPeople.id, id)).run();
	});
}

export type GiftInput = {
	title?: string;
	url?: string | null;
	quantity?: number;
	priceCents?: number | null;
	finalCents?: number | null;
	status?: GiftStatus;
};

function cleanGift(input: GiftInput): GiftInput {
	const out = { ...input };
	if (out.title !== undefined) {
		out.title = out.title.trim().slice(0, 200);
		if (!out.title) error(400, 'Give the gift a name');
	}
	if (out.url !== undefined && out.url !== null) {
		const u = out.url.trim();
		out.url = u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`).slice(0, 2000) : null;
	}
	if (out.quantity !== undefined && (!Number.isInteger(out.quantity) || out.quantity < 1 || out.quantity > 99)) error(400, 'How many should be 1 to 99');
	if (out.status !== undefined && !GIFT_STATUSES.includes(out.status)) error(400, 'Unknown status');
	for (const k of ['priceCents', 'finalCents'] as const) {
		const v = out[k];
		if (v != null && (!Number.isInteger(v) || v < 0 || v > 100_000_00)) error(400, 'That amount doesn’t look right');
	}
	return out;
}

export function addGift(viewer: User, season: number, recipientKey: string, input: GiftInput & { title: string }) {
	const recipient = checkRecipient(viewer, recipientKey);
	const data = cleanGift(input);
	const id = Number(recipient.slice(2));
	const [g] = getDb().insert(budgetGifts).values({
		...data,
		title: data.title!,
		bookId: bookOf(viewer.id),
		season,
		buyerId: viewer.id,
		recipientUserId: recipient.startsWith('u:') ? id : null,
		recipientPersonId: recipient.startsWith('p:') ? id : null
	}).returning().all();
	return g;
}

function ownGift(viewer: User, id: number) {
	const g = getDb().select().from(budgetGifts).where(eq(budgetGifts.id, id)).get();
	if (!g || g.bookId !== bookOf(viewer.id) || g.recipientUserId === viewer.id) error(404, 'Gift not found');
	return g;
}

export function updateGift(viewer: User, id: number, patch: GiftInput) {
	ownGift(viewer, id);
	getDb().update(budgetGifts).set(cleanGift(patch)).where(eq(budgetGifts.id, id)).run();
}

export function deleteGift(viewer: User, id: number) {
	ownGift(viewer, id);
	getDb().delete(budgetGifts).where(eq(budgetGifts.id, id)).run();
}

/**
 * Status and final cost of a Wishbook claim. Either partner in a shared book can
 * update the other's claims, but never a claim on their own list.
 */
export function updateClaim(viewer: User, itemId: number, claimerId: number, patch: { status?: GiftStatus; finalCents?: number | null }) {
	if (!memberIds(bookOf(viewer.id)).includes(claimerId)) error(403, 'That isn’t one of your gifts');
	const db = getDb();
	const row = db.select({ ownerId: lists.ownerId }).from(claims)
		.innerJoin(items, eq(items.id, claims.itemId)).innerJoin(lists, eq(lists.id, items.listId))
		.where(and(eq(claims.itemId, itemId), eq(claims.claimerId, claimerId))).get();
	if (!row || row.ownerId === viewer.id) error(404, 'Gift not found');
	const data = cleanGift(patch);
	const set: Partial<typeof claims.$inferInsert> = {};
	if (data.status !== undefined) { set.status = data.status; set.purchased = isSpent(data.status); }
	if (data.finalCents !== undefined) set.finalCents = data.finalCents;
	if (Object.keys(set).length) db.update(claims).set(set).where(and(eq(claims.itemId, itemId), eq(claims.claimerId, claimerId))).run();
}
