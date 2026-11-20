import { redirect } from '@sveltejs/kit';
import { getVapidKeys } from '$lib/server/notify';
import { christmasCountdown } from '$lib/season';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const { id, displayName, isAdmin, avatarColor, username } = locals.user;
	return { me: { id, displayName, isAdmin, avatarColor, username }, vapidKey: getVapidKeys().publicKey, countdown: christmasCountdown(new Date()) };
};
