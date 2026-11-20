import { getDb } from '../../src/lib/server/db';
import { users, managers, type User } from '../../src/lib/server/db/schema';

export function makeUser(username: string, extra: Partial<User> = {}): User {
	const [u] = getDb()
		.insert(users)
		.values({ username, displayName: username[0].toUpperCase() + username.slice(1), ...extra })
		.returning()
		.all();
	return u;
}

export function makeManager(kidId: number, managerId: number) {
	getDb().insert(managers).values({ kidId, managerId }).run();
}
