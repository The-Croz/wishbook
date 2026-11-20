/** View types shared by server loaders and client components. */
import type { Item } from './server/db/schema';

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
	status: Item['status'];
	scrapeStatus: Item['scrapeStatus'];
	deleted: boolean;
	/** Only present for givers. changedSinceClaim: the owner changed name, link, or note after it was claimed. */
	claim?: { claimerId: number; claimerName: string; isMine: boolean; purchased: boolean; changedSinceClaim: boolean };
};

export type ListSummary = {
	ownerId: number;
	displayName: string;
	avatarColor: string;
	isManaged: boolean;
	managedByMe: boolean;
	wantCount: number;
	claimedCount?: number;
};

