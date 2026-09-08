ALTER TABLE `book_club_mysteries` ADD `source_mystery_id` text REFERENCES mysteries(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `book_club_mysteries_source_mystery_idx` ON `book_club_mysteries` (`book_club_id`,`source_mystery_id`);
