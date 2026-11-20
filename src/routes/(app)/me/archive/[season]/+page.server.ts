import { error } from '@sveltejs/kit';
import { getArchive } from '$lib/server/lists';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const season = Number(params.season);
	if (!Number.isInteger(season)) error(404, 'Not found');
	return { season, items: getArchive(locals.user!, locals.user!.id, season) };
};
