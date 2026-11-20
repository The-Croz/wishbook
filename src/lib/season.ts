/** Christmas season a date belongs to. Jan 1–15 still counts as the previous Christmas. */
export function currentSeason(now: Date): number {
	const y = now.getFullYear();
	return now.getMonth() === 0 && now.getDate() <= 15 ? y - 1 : y;
}

/** "Mark received" is offered from Dec 1 through Jan 15. */
export function showReceived(now: Date): boolean {
	return now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 15);
}

/** This season and the whole days left until Dec 25 (0 on the day, negative after). */
export function christmasCountdown(now: Date): { season: number; daysToGo: number } {
	const season = currentSeason(now);
	const xmas = new Date(season, 11, 25);
	return { season, daysToGo: Math.ceil((xmas.getTime() - now.getTime()) / 86_400_000) || 0 };
}
