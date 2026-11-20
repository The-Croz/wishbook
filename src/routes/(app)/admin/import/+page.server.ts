import { fail } from '@sveltejs/kit';
import { listPeople, requireAdmin } from '$lib/server/admin';
import { fetchElfsterWishes, importWishes, parseElfsterLink, toImportRows } from '$lib/server/elfster';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ people: listPeople().filter((p) => p.isActive) });

async function rowsFor(link: string) {
	const id = parseElfsterLink(link);
	if (!id) throw new Error('That doesn’t look like an Elfster wish list link.');
	return toImportRows(await fetchElfsterWishes(id));
}

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		requireAdmin(locals.user!);
		const f = await request.formData();
		const link = String(f.get('link') ?? '');
		const ownerId = Number(f.get('ownerId'));
		if (!Number.isInteger(ownerId)) return fail(400, { link, message: 'Pick whose list this is.' });
		try {
			return { link, ownerId, rows: await rowsFor(link) };
		} catch (e) {
			return fail(400, { link, ownerId, message: (e as Error).message });
		}
	},
	import: async ({ request, locals }) => {
		requireAdmin(locals.user!);
		const f = await request.formData();
		const link = String(f.get('link') ?? '');
		const ownerId = Number(f.get('ownerId'));
		const keep = new Set(f.getAll('keep').map(String));
		try {
			const rows = (await rowsFor(link)).filter((r) => keep.has(r.key));
			const result = importWishes(locals.user!, ownerId, rows);
			return { done: result, ownerId };
		} catch (e) {
			return fail(400, { link, ownerId, message: (e as Error).message });
		}
	}
};
