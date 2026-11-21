import { error } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { getDb } from './db';
import { claims, items, lists, users, type User } from './db/schema';
import { toItemView } from './visibility';
import { claimsFor } from './lists';
import type { ClaimView, ItemView } from '$lib/types';
import { currentSeason } from '$lib/season';

export type ClaimResult =
	| { ok: true }
	| { ok: false; reason: 'own-list' | 'removed' | 'bad-quantity' }
	| { ok: false; reason: 'taken'; byName?: string; left: number };

function itemWithOwner(itemId: number) {
	const row = getDb().select({ item: items, ownerId: lists.ownerId }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId)).where(eq(items.id, itemId)).get();
	if (!row) error(404, 'Gift not found');
	return row;
}

/**
 * Claims `quantity` of a gift for the viewer, or changes how many they're getting if they already claimed some.
 * Never lets the total across everyone go past what the owner asked for.
 */
export function claimItem(viewer: User, itemId: number, quantity = 1): ClaimResult {
	const { item, ownerId } = itemWithOwner(itemId);
	if (ownerId === viewer.id) return { ok: false, reason: 'own-list' };
	if (item.deletedAt || item.status !== 'active') return { ok: false, reason: 'removed' };
	if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'bad-quantity' };
	const db = getDb();
	return db.transaction((tx) => {
		const others = tx.select({ id: users.id, name: users.displayName, quantity: claims.quantity }).from(claims)
			.innerJoin(users, eq(users.id, claims.claimerId))
			.where(and(eq(claims.itemId, itemId), ne(claims.claimerId, viewer.id))).all();
		const left = Math.max(0, item.quantity - others.reduce((n, o) => n + o.quantity, 0));
		if (quantity > left) return { ok: false, reason: 'taken', left, byName: others.length === 1 ? others[0].name : undefined } as const;
		const mine = tx.select().from(claims).where(and(eq(claims.itemId, itemId), eq(claims.claimerId, viewer.id))).get();
		if (mine) tx.update(claims).set({ quantity }).where(and(eq(claims.itemId, itemId), eq(claims.claimerId, viewer.id))).run();
		else tx.insert(claims).values({ itemId, claimerId: viewer.id, quantity }).run();
		return { ok: true } as const;
	});
}

const mineWhere = (viewer: User, itemId: number) => and(eq(claims.itemId, itemId), eq(claims.claimerId, viewer.id));

function requireClaimer(viewer: User, itemId: number) {
	const c = getDb().select().from(claims).where(mineWhere(viewer, itemId)).get();
	if (!c) error(403, 'Only the person who claimed this gift can change that');
}

export function unclaimItem(viewer: User, itemId: number) {
	requireClaimer(viewer, itemId);
	getDb().delete(claims).where(mineWhere(viewer, itemId)).run();
}

export function setPurchased(viewer: User, itemId: number, purchased: boolean) {
	requireClaimer(viewer, itemId);
	getDb().update(claims).set({ purchased }).where(mineWhere(viewer, itemId)).run();
}

export type MyClaim = ItemView & { ownerId: number; ownerName: string; removed: boolean; changed: boolean; mine: ClaimView };

/** Gifts I'm buying this season, from other people's lists, including ones since removed. */
export function getMyClaims(viewer: User, season = currentSeason(new Date())): MyClaim[] {
	const rows = getDb()
		.select({ claim: claims, item: items, ownerId: lists.ownerId, ownerName: users.displayName })
		.from(claims)
		.innerJoin(items, eq(items.id, claims.itemId))
		.innerJoin(lists, eq(lists.id, items.listId))
		.innerJoin(users, eq(users.id, lists.ownerId))
		.where(and(eq(claims.claimerId, viewer.id), eq(lists.season, season)))
		.all()
		.filter((r) => r.ownerId !== viewer.id);
	const all = claimsFor(rows.map((r) => r.item.id));
	return rows
		.map((r) => {
			const view = toItemView(viewer, r.ownerId, r.item, all.get(r.item.id) ?? []);
			return {
				...view,
				ownerId: r.ownerId,
				ownerName: r.ownerName,
				removed: r.item.deletedAt != null,
				changed: r.item.contentChangedAt != null && r.item.contentChangedAt.getTime() > r.claim.createdAt.getTime(),
				mine: view.claims!.find((c) => c.isMine)!
			};
		})
		.sort((a, b) => a.ownerName.localeCompare(b.ownerName) || a.id - b.id);
}
