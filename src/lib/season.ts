/** Christmas season a date belongs to. Jan 1–15 still counts as the previous Christmas. */
export function currentSeason(now: Date): number {
	const y = now.getFullYear();
	return now.getMonth() === 0 && now.getDate() <= 15 ? y - 1 : y;
}

/** "Mark received" is offered from Dec 1 through Jan 15. */
export function showReceived(now: Date): boolean {
	return now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 15);
}
