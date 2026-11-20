import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getDb } from './db';
import { claims, items, lists, managers, users, type Item, type List, type User } from './db/schema';
import { canEditList, canSeeClaims, toItemView, toListSummary, type ClaimWithName, type ItemView, type ListSummary } from './visibility';
import { currentSeason } from '$lib/season';
import { notifyClaimChanged } from './notify';

export type Priority = Item['priority'];
export type ItemInput = {
	title: string;
	url?: string | null;
	imageUrl?: string | null;
	store?: string | null;
	priceCents?: number | null;
	listPriceCents?: number | null;
	currency?: string;
	notes?: string;
	priority?: Priority;
	scrapeStatus?: Item['scrapeStatus'];
};

const PRIORITY_RANK: Record<Priority, number> = { most: 0, want: 1, nice: 2 };

export function getManagerIds(kidId: number): number[] {
	return getDb().select({ id: managers.managerId }).from(managers).where(eq(managers.kidId, kidId)).all().map((r) => r.id);
}

export function getUser(id: number): User {
	const u = getDb().select().from(users).where(eq(users.id, id)).get();
	if (!u || !u.isActive) error(404, 'Person not found');
	return u;
}

/** Returns the owner's list for a season, creating it (and carrying over last season's open gifts) on first use. */
export function ensureSeasonList(ownerId: number, season: number): List {
	const db = getDb();
	const found = db.select().from(lists).where(and(eq(lists.ownerId, ownerId), eq(lists.season, season))).get();
	if (found) return found;
	return db.transaction((tx) => {
		const [list] = tx.insert(lists).values({ ownerId, season }).returning().all();
		const prev = tx.select().from(lists).where(and(eq(lists.ownerId, ownerId), eq(lists.season, season - 1))).get();
		if (prev) {
			const carry = tx.select().from(items)
				.where(and(eq(items.listId, prev.id), eq(items.status, 'active'), isNull(items.deletedAt))).all();
			for (const { id: _id, listId: _l, createdAt: _c, updatedAt: _u, ...rest } of carry) {
				tx.insert(items).values({ ...rest, listId: list.id, announcedAt: new Date() }).run();
			}
		}
		return list;
	});
}

function claimsFor(itemIds: number[]): Map<number, ClaimWithName> {
	if (itemIds.length === 0) return new Map();
	const rows = getDb()
		.select({ claim: claims, name: users.displayName })
		.from(claims).innerJoin(users, eq(users.id, claims.claimerId))
		.where(inArray(claims.itemId, itemIds)).all();
	return new Map(rows.map((r) => [r.claim.itemId, { ...r.claim, claimerName: r.name }]));
}

function sortItems(a: Item, b: Item) {
	return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.sortOrder - b.sortOrder || a.id - b.id;
}

/** Everyone except the viewer: kids the viewer manages first, then by name. */
export function getFamily(viewer: User, season = currentSeason(new Date())): ListSummary[] {
	const db = getDb();
	const people = db.select().from(users).where(and(ne(users.id, viewer.id), eq(users.isActive, true))).all();
	const summaries = people.map((owner) => {
		const list = ensureSeasonList(owner.id, season);
		const its = db.select().from(items).where(eq(items.listId, list.id)).all();
		const cl = its.length ? db.select({ itemId: claims.itemId }).from(claims).where(inArray(claims.itemId, its.map((i) => i.id))).all() : [];
		return toListSummary(viewer, owner, its, cl, owner.isManaged ? getManagerIds(owner.id) : []);
	});
	return summaries.sort((a, b) => Number(b.managedByMe) - Number(a.managedByMe) || a.displayName.localeCompare(b.displayName));
}

export function getListForViewer(viewer: User, ownerId: number, season = currentSeason(new Date())) {
	const owner = ownerId === viewer.id ? viewer : getUser(ownerId);
	const managerIds = getManagerIds(ownerId);
	const list = ensureSeasonList(ownerId, season);
	const rows = getDb().select().from(items)
		.where(and(eq(items.listId, list.id), eq(items.status, 'active'), isNull(items.deletedAt)))
		.orderBy(asc(items.sortOrder)).all().sort(sortItems);
	const cl = claimsFor(rows.map((r) => r.id));
	return {
		owner: { id: owner.id, displayName: owner.displayName, isManaged: owner.isManaged, avatarColor: owner.avatarColor },
		managerNames: managerIds.length ? getDb().select({ n: users.displayName }).from(users).where(inArray(users.id, managerIds)).all().map((r) => r.n) : [],
		season,
		items: rows.map((r) => toItemView(viewer, ownerId, r, cl.get(r.id) ?? null)),
		canEdit: canEditList(viewer, ownerId, managerIds),
		showClaims: canSeeClaims(viewer, ownerId)
	};
}

function loadItem(itemId: number) {
	const row = getDb().select({ item: items, list: lists }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId)).where(eq(items.id, itemId)).get();
	if (!row) error(404, 'Gift not found');
	return row;
}

export function getItemForViewer(viewer: User, itemId: number): {
	item: ItemView; owner: { id: number; displayName: string; isManaged: boolean }; canEdit: boolean; showClaims: boolean; season: number;
} {
	const { item, list } = loadItem(itemId);
	const owner = list.ownerId === viewer.id ? viewer : getUser(list.ownerId);
	const managerIds = getManagerIds(owner.id);
	const canEdit = canEditList(viewer, owner.id, managerIds);
	const claim = claimsFor([item.id]).get(item.id) ?? null;
	if (item.deletedAt && !canEdit && claim?.claimerId !== viewer.id) error(404, 'Gift not found');
	return {
		item: toItemView(viewer, owner.id, item, claim),
		owner: { id: owner.id, displayName: owner.displayName, isManaged: owner.isManaged },
		canEdit,
		showClaims: canSeeClaims(viewer, owner.id),
		season: list.season
	};
}

function requireEditor(viewer: User, ownerId: number) {
	if (!canEditList(viewer, ownerId, getManagerIds(ownerId))) error(403, 'Only the list owner can change this gift');
}

function clean(input: Partial<ItemInput>): Partial<ItemInput> {
	const out = { ...input };
	if (out.title !== undefined) {
		out.title = out.title.trim();
		if (!out.title) error(400, 'Give the gift a name');
		if (out.title.length > 200) error(400, 'That name is too long (200 characters max)');
	}
	if (out.notes !== undefined) out.notes = out.notes.trim().slice(0, 1000);
	return out;
}

export function createItem(viewer: User, ownerId: number, input: ItemInput, season = currentSeason(new Date())): Item {
	requireEditor(viewer, ownerId);
	const data = clean(input) as ItemInput;
	const list = ensureSeasonList(ownerId, season);
	const [row] = getDb().insert(items).values({
		...data,
		listId: list.id,
		createdBy: viewer.id,
		priceCheckedAt: data.priceCents != null && data.scrapeStatus === 'ok' ? new Date() : null,
		sortOrder: Date.now() % 2_000_000_000
	}).returning().all();
	return row;
}

export function updateItem(viewer: User, itemId: number, patch: Partial<ItemInput>): Item {
	const { item, list } = loadItem(itemId);
	requireEditor(viewer, list.ownerId);
	if (item.deletedAt) error(404, 'Gift not found');
	const data = clean(patch);
	const contentChanged = (['title', 'url', 'notes'] as const).some((k) => data[k] !== undefined && (data[k] ?? null) !== (item[k] ?? null));
	const now = new Date();
	const [row] = getDb().update(items).set({ ...data, updatedAt: now, ...(contentChanged ? { contentChangedAt: now } : {}) }).where(eq(items.id, itemId)).returning().all();
	if (contentChanged) notifyClaimChanged(itemId, 'changed', viewer.id);
	return row;
}

export function deleteItem(viewer: User, itemId: number) {
	const { item, list } = loadItem(itemId);
	requireEditor(viewer, list.ownerId);
	getDb().update(items).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(items.id, itemId)).run();
	if (!item.deletedAt) notifyClaimChanged(itemId, 'removed', viewer.id);
}

export function setPriority(viewer: User, itemId: number, priority: Priority) {
	if (!(priority in PRIORITY_RANK)) error(400, 'Unknown priority');
	updateItem(viewer, itemId, { priority });
}

export function markReceived(viewer: User, itemId: number, received: boolean) {
	const { item, list } = loadItem(itemId);
	requireEditor(viewer, list.ownerId);
	if (item.deletedAt) error(404, 'Gift not found');
	getDb().update(items).set({ status: received ? 'received' : 'active', updatedAt: new Date() }).where(eq(items.id, itemId)).run();
}

/** Everything on a season's list that wasn't removed, received gifts first. Same claim rules as the live list. */
export function getArchive(viewer: User, ownerId: number, season: number): ItemView[] {
	const list = getDb().select().from(lists).where(and(eq(lists.ownerId, ownerId), eq(lists.season, season))).get();
	if (!list) return [];
	const rows = getDb().select().from(items).where(and(eq(items.listId, list.id), isNull(items.deletedAt))).all()
		.sort((a, b) => Number(b.status === 'received') - Number(a.status === 'received') || sortItems(a, b));
	const cl = claimsFor(rows.map((r) => r.id));
	return rows.map((r) => toItemView(viewer, ownerId, r, cl.get(r.id) ?? null));
}

export function getSeasons(ownerId: number): { season: number; count: number }[] {
	const db = getDb();
	return db.select().from(lists).where(eq(lists.ownerId, ownerId)).all()
		.map((l) => ({ season: l.season, count: db.select({ id: items.id }).from(items).where(and(eq(items.listId, l.id), isNull(items.deletedAt))).all().length }))
		.sort((a, b) => b.season - a.season);
}
