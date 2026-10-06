CREATE TABLE `mysteries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mysteries_user_id_idx` ON `mysteries` (`user_id`);--> statement-breakpoint
CREATE TABLE `mystery_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`mystery_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`source_version` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mystery_id`) REFERENCES `mysteries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mystery_versions_mystery_created_idx` ON `mystery_versions` (`mystery_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `published_mysteries` (
	`id` text PRIMARY KEY NOT NULL,
	`mystery_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`source_version` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`approved_at` integer,
	`approved_by_user_id` text,
	FOREIGN KEY (`mystery_id`) REFERENCES `mysteries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `published_mysteries_mystery_id_unique` ON `published_mysteries` (`mystery_id`);--> statement-breakpoint
CREATE INDEX `published_mysteries_status_idx` ON `published_mysteries` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `published_mysteries_owner_idx` ON `published_mysteries` (`owner_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_superadmin` integer DEFAULT false NOT NULL;