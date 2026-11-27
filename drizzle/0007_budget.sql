CREATE TABLE `budget_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_gifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`season` integer NOT NULL,
	`buyer_id` integer NOT NULL,
	`recipient_user_id` integer,
	`recipient_person_id` integer,
	`title` text NOT NULL,
	`url` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price_cents` integer,
	`final_cents` integer,
	`status` text DEFAULT 'purchased' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `budget_books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_person_id`) REFERENCES `budget_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `budget_gifts_book` ON `budget_gifts` (`book_id`,`season`);--> statement-breakpoint
CREATE TABLE `budget_invites` (
	`from_id` integer NOT NULL,
	`to_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`from_id`, `to_id`),
	FOREIGN KEY (`from_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budget_limits` (
	`book_id` integer NOT NULL,
	`season` integer NOT NULL,
	`recipient` text NOT NULL,
	`cents` integer NOT NULL,
	PRIMARY KEY(`book_id`, `season`, `recipient`),
	FOREIGN KEY (`book_id`) REFERENCES `budget_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budget_members` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`book_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `budget_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budget_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `budget_books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budget_totals` (
	`book_id` integer NOT NULL,
	`season` integer NOT NULL,
	`cents` integer NOT NULL,
	PRIMARY KEY(`book_id`, `season`),
	FOREIGN KEY (`book_id`) REFERENCES `budget_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `claims` ADD `status` text DEFAULT 'claimed' NOT NULL;--> statement-breakpoint
ALTER TABLE `claims` ADD `final_cents` integer;--> statement-breakpoint
UPDATE `claims` SET `status` = 'purchased' WHERE `purchased` = 1;