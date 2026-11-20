import { getListForViewer } from '$lib/server/lists';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => getListForViewer(locals.user!, locals.user!.id);
