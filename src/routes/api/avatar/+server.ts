import { error, json } from '@sveltejs/kit';
import { clearAvatarPhoto, setAvatarColor, setAvatarPhoto } from '$lib/server/profile';
import type { RequestHandler } from './$types';

/** One place for every picture change: a color, a new photo, or removing the photo. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const f = await request.formData();
	const userId = Number(f.get('userId'));
	if (!Number.isInteger(userId)) error(400, 'Who is this for?');
	const photo = f.get('photo');
	if (photo instanceof File) setAvatarPhoto(locals.user!, userId, new Uint8Array(await photo.arrayBuffer()));
	else if (f.get('remove') === '1') clearAvatarPhoto(locals.user!, userId);
	else if (typeof f.get('color') === 'string') setAvatarColor(locals.user!, userId, String(f.get('color')));
	else error(400, 'Nothing to change');
	return json({ ok: true });
};
