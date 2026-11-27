/** How each step a gift goes through reads on screen. Order matches GIFT_STATUSES. */
export const STATUS_LABELS = {
	claimed: 'Claimed',
	purchased: 'Bought',
	shipped: 'On the way',
	arrived: 'Arrived',
	wrapped: 'Wrapped'
} as const;

export type GiftStatusName = keyof typeof STATUS_LABELS;
export const STATUS_ORDER = Object.keys(STATUS_LABELS) as GiftStatusName[];
