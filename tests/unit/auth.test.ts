import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { sessions, users } from '../../src/lib/server/db/schema';
import {
	hashPassword, verifyPassword, createSession, validateSession, invalidateUserSessions,
	checkLoginRate, authenticate, seedAdmin
} from '../../src/lib/server/auth';
import { makeUser } from './helpers';

beforeEach(() => { createTestDb(); });

describe('passwords', () => {
	it('round-trips', async () => {
		const h = await hashPassword('correct horse');
		expect(await verifyPassword(h, 'correct horse')).toBe(true);
		expect(await verifyPassword(h, 'wrong')).toBe(false);
	});
});

describe('sessions', () => {
	it('stores a hash, not the raw token', async () => {
		const u = makeUser('josh');
		const { token } = await createSession(u.id);
		const row = getDb().select().from(sessions).get()!;
		expect(row.id).not.toBe(token);
		expect((await validateSession(token))?.id).toBe(u.id);
	});
	it('rejects unknown and expired tokens', async () => {
		const u = makeUser('josh');
		const { token } = await createSession(u.id);
		getDb().update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).run();
		expect(await validateSession(token)).toBeNull();
		expect(await validateSession('nope')).toBeNull();
	});
	it('invalidates all sessions for a user', async () => {
		const u = makeUser('josh');
		const { token } = await createSession(u.id);
		invalidateUserSessions(u.id);
		expect(await validateSession(token)).toBeNull();
	});
	it('rejects sessions of deactivated users', async () => {
		const u = makeUser('josh');
		const { token } = await createSession(u.id);
		getDb().update(users).set({ isActive: false }).run();
		expect(await validateSession(token)).toBeNull();
	});
});

describe('authenticate', () => {
	it('logs in case-insensitively', async () => {
		makeUser('josh', { passwordHash: await hashPassword('secret123') });
		expect((await authenticate('Josh', 'secret123'))?.username).toBe('josh');
	});
	it('never logs in a managed kid', async () => {
		makeUser('milo', { isManaged: true });
		expect(await authenticate('milo', '')).toBeNull();
	});
});

describe('rate limit', () => {
	it('blocks the 11th attempt in the window', () => {
		for (let i = 0; i < 10; i++) expect(checkLoginRate('josh|1.2.3.4')).toBe(true);
		expect(checkLoginRate('josh|1.2.3.4')).toBe(false);
		expect(checkLoginRate('kate|1.2.3.4')).toBe(true);
	});
});

describe('seedAdmin', () => {
	it('creates the admin only when there are no users', async () => {
		await seedAdmin('Josh', 'longpassword');
		await seedAdmin('other', 'longpassword');
		const all = getDb().select().from(users).all();
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ username: 'josh', isAdmin: true });
	});
});

import { changePassword } from '../../src/lib/server/auth';
describe('changePassword', () => {
	it('needs the current password and 8+ characters, and signs out other sessions', async () => {
		const u = makeUser('josh', { passwordHash: await hashPassword('oldpassword') });
		const { token } = await createSession(u.id);
		expect(await changePassword(u.id, 'wrong', 'newpassword1')).toBe("Your current password isn't right.");
		expect(await changePassword(u.id, 'oldpassword', 'short')).toBe('Use at least 8 characters.');
		expect(await changePassword(u.id, 'oldpassword', 'newpassword1')).toBeNull();
		expect(await validateSession(token)).toBeNull();
		expect((await authenticate('josh', 'newpassword1'))?.id).toBe(u.id);
	});
});
