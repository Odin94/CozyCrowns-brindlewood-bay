CREATE TABLE `book_club_personal_notes` (
	`book_club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`book_club_id`, `user_id`),
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_personal_notes_user_idx` ON `book_club_personal_notes` (`user_id`);--> statement-breakpoint
ALTER TABLE `book_clubs` ADD `shared_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `book_clubs` ADD `shared_notes_version` integer DEFAULT 0 NOT NULL;