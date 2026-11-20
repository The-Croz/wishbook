import { getFamily } from '$lib/server/lists';
import { currentSeason } from '$lib/season';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const now = new Date();
	const season = currentSeason(now);
	const xmas = new Date(season, 11, 25);
	const daysToGo = Math.ceil((xmas.getTime() - now.getTime()) / 86_400_000);
	return { family: getFamily(locals.user!, season), season, daysToGo };
};
