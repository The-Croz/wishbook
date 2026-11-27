/** View types shared by server loaders and client components. */
import type { Item } from './server/db/schema';
import type { PriceSignal } from './priceSignal';

export type ItemView = {
	id: number;
	title: string;
	url: string | null;
	imageUrl: string | null;
	store: string | null;
	priceCents: number | null;
	listPriceCents: number | null;
	currency: string;
	priceCheckedAt: number | null;
	notes: string;
	priority: Item['priority'];
	/** How many the owner wants. */
	quantity: number;
	status: Item['status'];
	scrapeStatus: Item['scrapeStatus'];
	deleted: boolean;
	createdAt: number;
	sortOrder: number;
	/** Set once we've watched the price long enough to know if today's price is a real sale. */
	priceSignal?: PriceSignal;
	/** Only present for givers: everyone buying some of this gift. */
	claims?: ClaimView[];
};

/** One person's share of a gift. changedSinceClaim: the owner changed name, link, or note after they claimed it. */
export type ClaimView = { claimerId: number; claimerName: string; isMine: boolean; quantity: number; purchased: boolean; status: import('./giftStatus').GiftStatusName; changedSinceClaim: boolean };

export type ListSummary = {
	ownerId: number;
	displayName: string;
	avatarColor: string;
	avatarPhoto: string | null;
	isManaged: boolean;
	managedByMe: boolean;
	wantCount: number;
	claimedCount?: number;
};

