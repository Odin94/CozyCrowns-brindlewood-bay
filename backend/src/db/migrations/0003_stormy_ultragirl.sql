CREATE TABLE `book_club_character_assignments` (
	`book_club_id` text NOT NULL,
	`character_id` text NOT NULL,
	`assigned_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`book_club_id`, `character_id`),
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_character_assignments_character_idx` ON `book_club_character_assignments` (`character_id`);--> statement-breakpoint
CREATE TABLE `book_club_clues` (
	`id` text PRIMARY KEY NOT NULL,
	`mystery_id` text NOT NULL,
	`text` text NOT NULL,
	`is_void` integer DEFAULT false NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mystery_id`) REFERENCES `book_club_mysteries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_clues_mystery_idx` ON `book_club_clues` (`mystery_id`);--> statement-breakpoint
CREATE TABLE `book_club_invitations` (
	`book_club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`book_club_id`, `user_id`),
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_invitations_user_idx` ON `book_club_invitations` (`user_id`);--> statement-breakpoint
CREATE TABLE `book_club_members` (
	`book_club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_game_master` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`book_club_id`, `user_id`),
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_members_user_idx` ON `book_club_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `book_club_mysteries` (
	`id` text PRIMARY KEY NOT NULL,
	`book_club_id` text NOT NULL,
	`title` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_mysteries_book_club_idx` ON `book_club_mysteries` (`book_club_id`);--> statement-breakpoint
CREATE TABLE `book_club_roll_events` (
	`id` text PRIMARY KEY NOT NULL,
	`book_club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`character_id` text,
	`character_name` text NOT NULL,
	`label` text NOT NULL,
	`dice` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_club_id`) REFERENCES `book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `book_clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_clubs_owner_idx` ON `book_clubs` (`owner_id`);--> statement-breakpoint
