import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { getItemForViewer, getListForViewer } from '$lib/server/lists';
import { saveGift } from '$lib/server/addGift';
import { retrySoon } from '$lib/server/prices';
import { extractUrl } from '$lib/server/scrape/extractUrl';
import type { Actions, PageServerLoad } from './$types';

function target(url: URL, meId: number) {
	const editId = url.searchParams.get('edit') ? Number(url.searchParams.get('edit')) : undefined;
	const forId = url.searchParams.get('for') ? Number(url.searchParams.get('for')) : meId;
	if ((editId !== undefined && !Number.isInteger(editId)) || !Number.isInteger(forId)) error(404, 'Not found');
	return { editId, forId };
}

export const load: PageServerLoad = ({ locals, url }) => {
	const me = locals.user!;
	const { editId, forId } = target(url, me.id);
	if (editId !== undefined) {
		const found = getItemForViewer(me, editId);
		if (!found.canEdit || found.item.deleted) error(403, 'Only the list owner can change this gift');
		return { mode: 'edit' as const, ownerId: found.owner.id, ownerName: found.owner.displayName, isMe: found.owner.id === me.id, item: found.item, shared: null };
	}
	const list = getListForViewer(me, forId);
	if (!list.canEdit) error(403, 'Only the list owner can add gifts here');
	const shareText = [url.searchParams.get('url'), url.searchParams.get('share'), url.searchParams.get('title')].filter(Boolean).join(' ');
	return { mode: 'add' as const, ownerId: forId, ownerName: list.owner.displayName, isMe: forId === me.id, item: null, shared: shareText && extractUrl(shareText) ? shareText : null };
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const me = locals.user!;
		const { editId, forId } = target(url, me.id);
		const form = await request.formData();
		let item;
		try {
			item = saveGift(me, { ownerId: forId, editId }, form);
			if (!editId && item.url && (item.scrapeStatus === 'blocked' || item.scrapeStatus === 'failed')) retrySoon(item.id);
		} catch (e) {
			if (isHttpError(e) && e.status === 400) return fail(400, { message: e.body.message });
			throw e;
		}
		redirect(303, editId ? `/items/${item.id}` : forId === me.id ? '/me/list' : `/people/${forId}`);
	}
};
