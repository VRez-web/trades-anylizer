CREATE TABLE `period_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`period_key` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `period_notes_scope_key` ON `period_notes` (`scope`,`period_key`);--> statement-breakpoint
CREATE TABLE `reasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strategy_doc` (
	`id` integer PRIMARY KEY NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`entry_reason_id` integer,
	`exit_reason_id` integer,
	`entry_at` integer NOT NULL,
	`exit_at` integer NOT NULL,
	`leverage` real NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real NOT NULL,
	`income` real NOT NULL,
	`commission` real NOT NULL,
	`funding` real NOT NULL,
	`rr` real,
	`check_system` integer DEFAULT false NOT NULL,
	`check_technique` integer DEFAULT false NOT NULL,
	`check_psychology` integer DEFAULT false NOT NULL,
	`check_analysis` integer DEFAULT false NOT NULL,
	`description` text,
	`conclusion` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`entry_reason_id`) REFERENCES `reasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exit_reason_id`) REFERENCES `reasons`(`id`) ON UPDATE no action ON DELETE no action
);
