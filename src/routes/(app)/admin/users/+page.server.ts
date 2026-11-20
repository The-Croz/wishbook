import { fail, isHttpError } from '@sveltejs/kit';
import { createManagedKid, createUser, deactivateUser, listPeople, resetPassword, setManagers } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ people: listPeople() });

const ids = (f: FormData, k: string) => f.getAll(k).map(Number).filter(Number.isInteger);
const guard = async <T>(fn: () => T | Promise<T>, form: string) => {
	try {
		return await fn();
	} catch (e) {
		if (isHttpError(e) && e.status === 400) return fail(400, { form, message: e.body.message });
		throw e;
	}
};

export const actions: Actions = {
	addPerson: async ({ locals, request }) => {
		const f = await request.formData();
		const problem = await createUser(locals.user!, {
			username: String(f.get('username') ?? ''), displayName: String(f.get('displayName') ?? ''),
			password: String(f.get('password') ?? ''), isAdmin: f.get('isAdmin') === 'on'
		});
		return problem ? fail(400, { form: 'person', message: problem }) : { form: 'person', done: 'Added. Send them their username and password.' };
	},
	addKid: async ({ locals, request }) => {
		const f = await request.formData();
		return guard(() => {
			createManagedKid(locals.user!, { displayName: String(f.get('displayName') ?? ''), managerIds: ids(f, 'managers') });
			return { form: 'kid', done: 'Kid added.' };
		}, 'kid');
	},
	managers: async ({ locals, request }) => {
		const f = await request.formData();
		return guard(() => { setManagers(locals.user!, Number(f.get('kidId')), ids(f, 'managers')); return { form: 'managers', done: 'Saved.' }; }, 'managers');
	},
	reset: async ({ locals, request }) => {
		const f = await request.formData();
		const problem = await resetPassword(locals.user!, Number(f.get('userId')), String(f.get('password') ?? ''));
		return problem ? fail(400, { form: `reset-${f.get('userId')}`, message: problem }) : { form: `reset-${f.get('userId')}`, done: 'Password reset. They’ll need to sign in again.' };
	},
	active: async ({ locals, request }) => {
		const f = await request.formData();
		return guard(() => { deactivateUser(locals.user!, Number(f.get('userId')), f.get('active') === 'yes'); return { form: 'active', done: 'Saved.' }; }, 'active');
	}
};
