import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { authenticate, createSession, hashPassword, validateSession } from '../../src/lib/server/auth';
import { createManagedKid, createUser, deactivateUser, listPeople, requireAdmin, resetPassword, setManagers } from '../../src/lib/server/admin';
import { getManagerIds } from '../../src/lib/server/lists';
import { makeUser } from './helpers';

let admin: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>;
beforeEach(async () => {
	createTestDb();
	admin = makeUser('josh', { isAdmin: true, passwordHash: await hashPassword('adminpass') });
	kate = makeUser('kate');
});

describe('requireAdmin', () => {
	it('stops non-admins', () => expect(() => requireAdmin(kate)).toThrow(expect.objectContaining({ status: 403 })));
});

describe('createUser', () => {
	it('creates a login', async () => {
		expect(await createUser(admin, { username: 'June', displayName: 'Grandma June', password: 'cookies123', isAdmin: false })).toBeNull();
		expect((await authenticate('june', 'cookies123'))?.displayName).toBe('Grandma June');
	});
	it('rejects duplicate usernames regardless of case', async () => {
		expect(await createUser(admin, { username: 'KATE', displayName: 'K2', password: 'longenough', isAdmin: false })).toBe('That username is taken.');
	});
	it('rejects short passwords and odd usernames', async () => {
		expect(await createUser(admin, { username: 'rob', displayName: 'Rob', password: 'short', isAdmin: false })).toBe('Use at least 8 characters.');
		expect(await createUser(admin, { username: 'r o b', displayName: 'Rob', password: 'longenough', isAdmin: false })).toBe('Usernames can use letters, numbers, dots, dashes, and underscores.');
	});
});

describe('kids', () => {
	it('creates a kid with managers who cannot log in', async () => {
		const kid = createManagedKid(admin, { displayName: 'Milo', managerIds: [admin.id, kate.id] });
		expect(getManagerIds(kid.id).sort()).toEqual([admin.id, kate.id].sort());
		expect(await authenticate(kid.username, '')).toBeNull();
	});
	it('requires at least one manager', () => {
		expect(() => createManagedKid(admin, { displayName: 'Milo', managerIds: [] })).toThrow(expect.objectContaining({ status: 400 }));
	});
	it('replaces managers', () => {
		const kid = createManagedKid(admin, { displayName: 'Milo', managerIds: [admin.id] });
		setManagers(admin, kid.id, [kate.id]);
		expect(getManagerIds(kid.id)).toEqual([kate.id]);
	});
});

describe('resetPassword and deactivate', () => {
	it('resets and signs the person out everywhere', async () => {
		const { token } = await createSession(kate.id);
		expect(await resetPassword(admin, kate.id, 'brandnew99')).toBeNull();
		expect(await validateSession(token)).toBeNull();
		expect((await authenticate('kate', 'brandnew99'))?.id).toBe(kate.id);
	});
	it('deactivates without deleting, and refuses to deactivate yourself', async () => {
		deactivateUser(admin, kate.id);
		expect(listPeople().find((p) => p.id === kate.id)?.isActive).toBe(false);
		expect(() => deactivateUser(admin, admin.id)).toThrow(expect.objectContaining({ status: 400 }));
	});
});
