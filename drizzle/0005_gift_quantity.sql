PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_claims` (
	`item_id` integer NOT NULL,
	`claimer_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`purchased` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`item_id`, `claimer_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claimer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_claims`("item_id", "claimer_id", "quantity", "created_at", "purchased") SELECT "item_id", "claimer_id", 1, "created_at", "purchased" FROM `claims`;--> statement-breakpoint
DROP TABLE `claims`;--> statement-breakpoint
ALTER TABLE `__new_claims` RENAME TO `claims`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `items` ADD `quantity` integer DEFAULT 1 NOT NULL;