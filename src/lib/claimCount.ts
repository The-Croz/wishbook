/** How much of a gift is spoken for, from a giver's point of view. Owners never get claims, so these read as 0. */
import type { ItemView } from './types';

export function claimedCount(item: Pick<ItemView, 'claims'>): number {
	return (item.claims ?? []).reduce((n, c) => n + c.quantity, 0);
}

export function remainingCount(item: Pick<ItemView, 'claims' | 'quantity'>): number {
	return Math.max(0, item.quantity - claimedCount(item));
}

export function isFullyClaimed(item: Pick<ItemView, 'claims' | 'quantity'>): boolean {
	return claimedCount(item) > 0 && remainingCount(item) === 0;
}

export function myClaim(item: Pick<ItemView, 'claims'>) {
	return item.claims?.find((c) => c.isMine);
}
