CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_name_code` ON `candidates` (`name`,`code`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`candidate_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
