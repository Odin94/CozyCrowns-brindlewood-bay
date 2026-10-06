CREATE TABLE `book_club_theory_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`mystery_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mystery_id`) REFERENCES `book_club_mysteries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `book_club_theory_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `book_club_theory_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_club_theory_edges_mystery_idx` ON `book_club_theory_edges` (`mystery_id`);--> statement-breakpoint
CREATE INDEX `book_club_theory_edges_source_idx` ON `book_club_theory_edges` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `book_club_theory_edges_target_idx` ON `book_club_theory_edges` (`target_node_id`);--> statement-breakpoint
CREATE TABLE `book_club_theory_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`mystery_id` text NOT NULL,
	`source_clue_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`x` integer DEFAULT 160 NOT NULL,
	`y` integer DEFAULT 160 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`editing_by_user_id` text,
	`edit_lock_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mystery_id`) REFERENCES `book_club_mysteries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_clue_id`) REFERENCES `book_club_clues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editing_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `book_club_theory_nodes_mystery_idx` ON `book_club_theory_nodes` (`mystery_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_club_theory_nodes_source_clue_idx` ON `book_club_theory_nodes` (`source_clue_id`);