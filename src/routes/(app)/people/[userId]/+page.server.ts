import { error, redirect } from '@sveltejs/kit';
import { getListForViewer } from '$lib/server/lists';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const id = Number(params.userId);
	if (!Number.isInteger(id)) error(404, 'Person not found');
	if (id === locals.user!.id) redirect(303, '/me/list');
	return getListForViewer(locals.user!, id);
};
