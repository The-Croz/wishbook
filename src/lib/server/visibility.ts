/**
 * The one place that decides what a viewer may see about a list.
 * Every loader and endpoint that returns items or list summaries goes through here,
 * so a list owner never receives claim data in any response.
 */
import type { Claim, Item, User } from './db/schema';

export type ClaimWithName = Claim & { claimerName: string };

import type { ItemView, ListSummary } from '$lib/types';
export type { ItemView, ListSummary };

export function canSeeClaims(viewer: User, ownerId: number): boolean {
	return viewer.id !== ownerId;
}

export function canEditList(viewer: User, ownerId: number, managerIds: number[]): boolean {
	return viewer.id === ownerId || managerIds.includes(viewer.id);
}

export function toItemView(viewer: User, ownerId: number, item: Item, claim: ClaimWithName | null): ItemView {
	const view: ItemView = {
		id: item.id,
		title: item.title,
		url: item.url,
		imageUrl: item.imageUrl,
		store: item.store,
		priceCents: item.priceCents,
		listPriceCents: item.listPriceCents,
		currency: item.currency,
		priceCheckedAt: item.priceCheckedAt?.getTime() ?? null,
		notes: item.notes,
		priority: item.priority,
		status: item.status,
		scrapeStatus: item.scrapeStatus,
		deleted: item.deletedAt != null,
		createdAt: item.createdAt.getTime(),
		sortOrder: item.sortOrder
	};
	if (claim && canSeeClaims(viewer, ownerId)) {
		view.claim = {
			claimerId: claim.claimerId,
			claimerName: claim.claimerName,
			isMine: claim.claimerId === viewer.id,
			purchased: claim.purchased,
			changedSinceClaim: item.contentChangedAt != null && item.contentChangedAt.getTime() > claim.createdAt.getTime()
		};
	}
	return view;
}

export function toListSummary(
	viewer: User,
	owner: User,
	items: Item[],
	claims: Pick<Claim, 'itemId'>[],
	managerIds: number[]
): ListSummary {
	const open = items.filter((i) => i.deletedAt == null && i.status === 'active');
	const summary: ListSummary = {
		ownerId: owner.id,
		displayName: owner.displayName,
		avatarColor: owner.avatarColor,
		avatarPhoto: owner.avatarPhoto,
		isManaged: owner.isManaged,
		managedByMe: managerIds.includes(viewer.id),
		wantCount: open.length
	};
	if (canSeeClaims(viewer, owner.id)) {
		const ids = new Set(open.map((i) => i.id));
		summary.claimedCount = claims.filter((c) => ids.has(c.itemId)).length;
	}
	return summary;
}
