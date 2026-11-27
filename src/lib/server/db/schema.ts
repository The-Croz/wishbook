import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = sql`(unixepoch() * 1000)`;

/** Where a gift is on its way to being given. "shipped" shows as "On the way". */
export const GIFT_STATUSES = ['claimed', 'purchased', 'shipped', 'arrived', 'wrapped'] as const;
export type GiftStatus = (typeof GIFT_STATUSES)[number];

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	passwordHash: text('password_hash'),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	isManaged: integer('is_managed', { mode: 'boolean' }).notNull().default(false),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	avatarColor: text('avatar_color').notNull().default('#F2B705'),
	/** File name of an uploaded profile photo in the avatars folder; shown instead of initials. */
	avatarPhoto: text('avatar_photo'),
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
	/** How many the owner wants. Givers can split it, each claiming some. */
	quantity: integer('quantity').notNull().default(1),
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

/** One row per person buying a gift; quantity is how many of the gift's wanted count they're covering. */
export const claims = sqliteTable(
	'claims',
	{
		itemId: integer('item_id').notNull().references(() => items.id),
		claimerId: integer('claimer_id').notNull().references(() => users.id),
		quantity: integer('quantity').notNull().default(1),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
		purchased: integer('purchased', { mode: 'boolean' }).notNull().default(false),
		/** Where the gift is, for the budget page. Kept in step with `purchased` (purchased = past "claimed"). */
		status: text('status', { enum: GIFT_STATUSES }).notNull().default('claimed'),
		/** What it really cost all in (tax, shipping), when the giver enters it. */
		finalCents: integer('final_cents')
	},
	(t) => [primaryKey({ columns: [t.itemId, t.claimerId] })]
);

/** One price reading per gift per day; the deal check compares today's price with these. */
export const priceHistory = sqliteTable('price_history', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	itemId: integer('item_id').notNull().references(() => items.id),
	priceCents: integer('price_cents').notNull(),
	checkedAt: integer('checked_at', { mode: 'timestamp_ms' }).notNull()
}, (t) => [index('price_history_item').on(t.itemId, t.checkedAt)]);

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

/**
 * Budget books. Each person has one; spouses who share a budget point at the same book.
 * A book holds the overall budget, per-person budgets, people who aren't on Wishbook,
 * and gifts bought outside Wishbook.
 */
export const budgetBooks = sqliteTable('budget_books', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
});

export const budgetMembers = sqliteTable('budget_members', {
	userId: integer('user_id').primaryKey().references(() => users.id),
	bookId: integer('book_id').notNull().references(() => budgetBooks.id)
});

/** "Share my budget with you", waiting for the other person to accept. */
export const budgetInvites = sqliteTable('budget_invites', {
	fromId: integer('from_id').notNull().references(() => users.id),
	toId: integer('to_id').notNull().references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
}, (t) => [primaryKey({ columns: [t.fromId, t.toId] })]);

export const budgetTotals = sqliteTable('budget_totals', {
	bookId: integer('book_id').notNull().references(() => budgetBooks.id),
	season: integer('season').notNull(),
	cents: integer('cents').notNull()
}, (t) => [primaryKey({ columns: [t.bookId, t.season] })]);

/** People the book buys for who aren't on Wishbook. */
export const budgetPeople = sqliteTable('budget_people', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('book_id').notNull().references(() => budgetBooks.id),
	name: text('name').notNull(),
	createdBy: integer('created_by').notNull().references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
});

/** A per-person budget. recipient is "u:<user id>" or "p:<budget person id>". */
export const budgetLimits = sqliteTable('budget_limits', {
	bookId: integer('book_id').notNull().references(() => budgetBooks.id),
	season: integer('season').notNull(),
	recipient: text('recipient').notNull(),
	cents: integer('cents').notNull()
}, (t) => [primaryKey({ columns: [t.bookId, t.season, t.recipient] })]);

/** A gift bought outside Wishbook, for a Wishbook user or a budget person. */
export const budgetGifts = sqliteTable('budget_gifts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('book_id').notNull().references(() => budgetBooks.id),
	season: integer('season').notNull(),
	buyerId: integer('buyer_id').notNull().references(() => users.id),
	recipientUserId: integer('recipient_user_id').references(() => users.id),
	recipientPersonId: integer('recipient_person_id').references(() => budgetPeople.id),
	title: text('title').notNull(),
	url: text('url'),
	quantity: integer('quantity').notNull().default(1),
	/** Price of one. */
	priceCents: integer('price_cents'),
	/** What it really cost all in, when entered. */
	finalCents: integer('final_cents'),
	status: text('status', { enum: GIFT_STATUSES }).notNull().default('purchased'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now)
}, (t) => [index('budget_gifts_book').on(t.bookId, t.season)]);

export type User = typeof users.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
