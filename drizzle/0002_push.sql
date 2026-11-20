CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notify_prefs` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`new_gifts` integer DEFAULT true NOT NULL,
	`claim_changed` integer DEFAULT true NOT NULL,
	`price_drop` integer DEFAULT true NOT NULL,
	`reminders` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
ALTER TABLE `items` ADD `announced_at` integer;
--> statement-breakpoint
UPDATE `items` SET `announced_at` = `created_at`;
