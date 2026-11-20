import { getListForViewer } from '$lib/server/lists';
import { listOrderActions } from '$lib/server/listActions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => getListForViewer(locals.user!, locals.user!.id);

export const actions = listOrderActions((me) => me.id);
