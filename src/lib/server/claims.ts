import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { claims, items, lists, users, type User } from './db/schema';
import { toItemView } from './visibility';
import type { ItemView } from '$lib/types';
import { currentSeason } from '$lib/season';

export type ClaimResult = { ok: true } | { ok: false; reason: 'own-list' | 'taken' | 'removed'; byName?: string };

function itemWithOwner(itemId: number) {
	const row = getDb().select({ item: items, ownerId: lists.ownerId }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId)).where(eq(items.id, itemId)).get();
	if (!row) error(404, 'Gift not found');
	return row;
}

export function claimItem(viewer: User, itemId: number): ClaimResult {
	const { item, ownerId } = itemWithOwner(itemId);
	if (ownerId === viewer.id) return { ok: false, reason: 'own-list' };
	if (item.deletedAt || item.status !== 'active') return { ok: false, reason: 'removed' };
	try {
		getDb().insert(claims).values({ itemId, claimerId: viewer.id }).run();
		return { ok: true };
	} catch (e) {
		const holder = getDb().select({ id: users.id, name: users.displayName }).from(claims)
			.innerJoin(users, eq(users.id, claims.claimerId)).where(eq(claims.itemId, itemId)).get();
		if (!holder) throw e;
		if (holder.id === viewer.id) return { ok: true };
		return { ok: false, reason: 'taken', byName: holder.name };
	}
}

function requireClaimer(viewer: User, itemId: number) {
	const c = getDb().select().from(claims).where(eq(claims.itemId, itemId)).get();
	if (!c || c.claimerId !== viewer.id) error(403, 'Only the person who claimed this gift can change that');
}

export function unclaimItem(viewer: User, itemId: number) {
	requireClaimer(viewer, itemId);
	getDb().delete(claims).where(and(eq(claims.itemId, itemId), eq(claims.claimerId, viewer.id))).run();
}

export function setPurchased(viewer: User, itemId: number, purchased: boolean) {
	requireClaimer(viewer, itemId);
	getDb().update(claims).set({ purchased }).where(eq(claims.itemId, itemId)).run();
}

export type MyClaim = ItemView & { ownerId: number; ownerName: string; removed: boolean; changed: boolean };

/** Gifts I'm getting this season, from other people's lists, including ones since removed. */
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
	return rows
		.map((r) => ({
			...toItemView(viewer, r.ownerId, r.item, { ...r.claim, claimerName: viewer.displayName }),
			ownerId: r.ownerId,
			ownerName: r.ownerName,
			removed: r.item.deletedAt != null,
			changed: r.item.contentChangedAt != null && r.item.contentChangedAt.getTime() > r.claim.createdAt.getTime()
		}))
		.sort((a, b) => a.ownerName.localeCompare(b.ownerName) || a.id - b.id);
}
