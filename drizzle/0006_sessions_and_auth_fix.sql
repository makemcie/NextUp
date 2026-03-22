-- Add sessions table for cookie-based auth
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Make whop_user_id nullable (existing accounts keep their link, new ones don't need it)
-- SQLite doesn't support ALTER COLUMN directly, so we recreate the table
CREATE TABLE `users_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whop_user_id` text,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_new_whop_user_id_unique` ON `users_new` (`whop_user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_new_email_unique` ON `users_new` (`email`);

-- Copy existing data
INSERT INTO `users_new` SELECT `id`, `whop_user_id`, `email`, `password_hash`, `created_at` FROM `users`;

-- Swap tables
DROP TABLE `users`;
ALTER TABLE `users_new` RENAME TO `users`;

-- Update shops.owner_id to reference integer user id
-- (existing shops linked via whop_user_id need manual migration if any)
