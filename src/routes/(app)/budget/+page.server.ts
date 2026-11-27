import { error, fail } from '@sveltejs/kit';
import {
	acceptInvite, addGift, addPerson, cancelInvite, declineInvite, deleteGift, getBudget, invitePartner,
	removePerson, renamePerson, setLimit, setTotal, stopSharing, updateClaim, updateGift, GIFT_STATUSES, type GiftStatus
} from '$lib/server/budget';
import { currentSeason } from '$lib/season';
import { parseCents } from '$lib/money';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => getBudget(locals.user!, currentSeason(new Date()));

const season = () => currentSeason(new Date());
const str = (f: FormData, k: string) => String(f.get(k) ?? '');
const num = (f: FormData, k: string) => {
	const n = Number(f.get(k));
	if (!Number.isInteger(n) || n <= 0) error(400, 'Something’s missing');
	return n;
};
/** A money box. Returns undefined (and the caller fails) when it isn't an amount. */
const money = (f: FormData, k: string) => parseCents(str(f, k));
const status = (f: FormData): GiftStatus => {
	const s = str(f, 'status') as GiftStatus;
	if (!GIFT_STATUSES.includes(s)) error(400, 'Unknown status');
	return s;
};

/** "c:<item>:<claimer>" is a Wishbook claim; "g:<id>" is a gift added here. */
function giftKey(key: string): { kind: 'claim'; itemId: number; claimerId: number } | { kind: 'own'; id: number } {
	let m = key.match(/^c:(\d+):(\d+)$/);
	if (m) return { kind: 'claim', itemId: Number(m[1]), claimerId: Number(m[2]) };
	m = key.match(/^g:(\d+)$/);
	if (m) return { kind: 'own', id: Number(m[1]) };
	error(400, 'Gift not found');
}

function giftFields(f: FormData) {
	const priceCents = money(f, 'price');
	const finalCents = money(f, 'final');
	if (priceCents === undefined || finalCents === undefined) return null;
	const quantity = Number(str(f, 'quantity') || '1');
	return { title: str(f, 'title'), url: str(f, 'url') || null, quantity, priceCents, finalCents, status: status(f) };
}

export const actions: Actions = {
	total: async ({ locals, request }) => {
		const cents = money(await request.formData(), 'cents');
		if (cents === undefined) return fail(400, { message: 'That budget doesn’t look like an amount' });
		setTotal(locals.user!, season(), cents);
	},
	limit: async ({ locals, request }) => {
		const f = await request.formData();
		const cents = money(f, 'cents');
		if (cents === undefined) return fail(400, { message: 'That budget doesn’t look like an amount' });
		setLimit(locals.user!, season(), str(f, 'recipient'), cents);
	},
	status: async ({ locals, request }) => {
		const f = await request.formData();
		const k = giftKey(str(f, 'key'));
		if (k.kind === 'claim') updateClaim(locals.user!, k.itemId, k.claimerId, { status: status(f) });
		else updateGift(locals.user!, k.id, { status: status(f) });
	},
	final: async ({ locals, request }) => {
		const f = await request.formData();
		const finalCents = money(f, 'final');
		if (finalCents === undefined) return fail(400, { message: 'That total doesn’t look like an amount' });
		const k = giftKey(str(f, 'key'));
		if (k.kind === 'claim') updateClaim(locals.user!, k.itemId, k.claimerId, { finalCents });
		else updateGift(locals.user!, k.id, { finalCents });
	},
	addGift: async ({ locals, request }) => {
		const f = await request.formData();
		const g = giftFields(f);
		if (!g) return fail(400, { message: 'Check the prices: they should be amounts like 24.99' });
		addGift(locals.user!, season(), str(f, 'recipient'), g);
	},
	editGift: async ({ locals, request }) => {
		const f = await request.formData();
		const g = giftFields(f);
		if (!g) return fail(400, { message: 'Check the prices: they should be amounts like 24.99' });
		updateGift(locals.user!, num(f, 'id'), g);
	},
	deleteGift: async ({ locals, request }) => deleteGift(locals.user!, num(await request.formData(), 'id')),
	addPerson: async ({ locals, request }) => { addPerson(locals.user!, str(await request.formData(), 'name')); },
	renamePerson: async ({ locals, request }) => {
		const f = await request.formData();
		renamePerson(locals.user!, num(f, 'id'), str(f, 'name'));
	},
	removePerson: async ({ locals, request }) => removePerson(locals.user!, num(await request.formData(), 'id')),
	invite: async ({ locals, request }) => invitePartner(locals.user!, num(await request.formData(), 'id')),
	cancelInvite: async ({ locals, request }) => cancelInvite(locals.user!, num(await request.formData(), 'id')),
	accept: async ({ locals, request }) => acceptInvite(locals.user!, num(await request.formData(), 'id')),
	decline: async ({ locals, request }) => declineInvite(locals.user!, num(await request.formData(), 'id')),
	stopSharing: async ({ locals }) => stopSharing(locals.user!)
};
