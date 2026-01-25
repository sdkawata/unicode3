CREATE TABLE `blocks` (
	`start_cp` integer NOT NULL,
	`end_cp` integer NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`start_cp`, `end_cp`)
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`codepoint` integer PRIMARY KEY NOT NULL,
	`name` text,
	`category` text,
	`block` text,
	`script` text,
	`bidi_class` text,
	`decomposition_type` text,
	`is_emoji` integer
);
--> statement-breakpoint
CREATE INDEX `idx_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_characters_block` ON `characters` (`block`);--> statement-breakpoint
CREATE TABLE `decomposition_mappings` (
	`source_cp` integer NOT NULL,
	`target_cp` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`source_cp`, `position`)
);
--> statement-breakpoint
CREATE INDEX `idx_decomp_source` ON `decomposition_mappings` (`source_cp`);--> statement-breakpoint
CREATE INDEX `idx_decomp_target` ON `decomposition_mappings` (`target_cp`);--> statement-breakpoint
CREATE TABLE `name_aliases` (
	`codepoint` integer NOT NULL,
	`alias` text NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`codepoint`, `type`, `alias`)
);
