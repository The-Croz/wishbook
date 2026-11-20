import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = sql`(unixepoch() * 1000)`;

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	passwordHash: text('password_hash'),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	isManaged: integer('is_managed', { mode: 'boolean' }).notNull().default(false),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	avatarColor: text('avatar_color').notNull().default('#F2B705'),
	birthYear: integer('birth_year'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
});

export const managers = sqliteTable(
	'managers',
	{
		kidId: integer('kid_id').notNull().references(() => users.id),
		managerId: integer('manager_id').notNull().references(() => users.id)
	},
	(t) => [primaryKey({ columns: [t.kidId, t.managerId] })]
);

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id').notNull().references(() => users.id),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

export const lists = sqliteTable(
	'lists',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ownerId: integer('owner_id').notNull().references(() => users.id),
		season: integer('season').notNull(),
		/** The owner arranged this list by hand; their order becomes the default view. */
		customOrder: integer('custom_order', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [uniqueIndex('lists_owner_season').on(t.ownerId, t.season)]
);

export const items = sqliteTable('items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	listId: integer('list_id').notNull().references(() => lists.id),
	title: text('title').notNull(),
	url: text('url'),
	imageUrl: text('image_url'),
	store: text('store'),
	priceCents: integer('price_cents'),
	listPriceCents: integer('list_price_cents'),
	currency: text('currency').notNull().default('USD'),
	priceCheckedAt: integer('price_checked_at', { mode: 'timestamp_ms' }),
	notes: text('notes').notNull().default(''),
	priority: text('priority', { enum: ['nice', 'want', 'most'] }).notNull().default('want'),
	status: text('status', { enum: ['active', 'received'] }).notNull().default('active'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdBy: integer('created_by').notNull().references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(now),
	deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
	contentChangedAt: integer('content_changed_at', { mode: 'timestamp_ms' }),
	announcedAt: integer('announced_at', { mode: 'timestamp_ms' }),
	scrapeStatus: text('scrape_status', { enum: ['ok', 'blocked', 'failed', 'manual'] }).notNull().default('manual')
});

export const claims = sqliteTable('claims', {
	itemId: integer('item_id').primaryKey().references(() => items.id),
	claimerId: integer('claimer_id').notNull().references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
	purchased: integer('purchased', { mode: 'boolean' }).notNull().default(false)
});

export const priceHistory = sqliteTable('price_history', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	itemId: integer('item_id').notNull().references(() => items.id),
	priceCents: integer('price_cents').notNull(),
	checkedAt: integer('checked_at', { mode: 'timestamp_ms' }).notNull()
});

export const loginAttempts = sqliteTable('login_attempts', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	windowStart: integer('window_start', { mode: 'timestamp_ms' }).notNull()
});

export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull().references(() => users.id),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
});

export const notifyPrefs = sqliteTable('notify_prefs', {
	userId: integer('user_id').primaryKey().references(() => users.id),
	newGifts: integer('new_gifts', { mode: 'boolean' }).notNull().default(true),
	claimChanged: integer('claim_changed', { mode: 'boolean' }).notNull().default(true),
	priceDrop: integer('price_drop', { mode: 'boolean' }).notNull().default(true),
	reminders: integer('reminders', { mode: 'boolean' }).notNull().default(true)
});

export type User = typeof users.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
