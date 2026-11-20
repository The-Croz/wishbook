import { error, redirect } from '@sveltejs/kit';
import { getListForViewer } from '$lib/server/lists';
import { listOrderActions } from '$lib/server/listActions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const id = Number(params.userId);
	if (!Number.isInteger(id)) error(404, 'Person not found');
	if (id === locals.user!.id) redirect(303, '/me/list');
	return getListForViewer(locals.user!, id);
};

export const actions = listOrderActions((_me, _url, params) => {
	const id = Number(params.userId);
	if (!Number.isInteger(id)) error(404, 'Person not found');
	return id;
});
