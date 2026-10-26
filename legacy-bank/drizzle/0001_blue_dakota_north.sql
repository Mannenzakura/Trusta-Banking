ALTER TABLE `candidates` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `candidate_name_phone` ON `candidates` (`name`,`phone`);