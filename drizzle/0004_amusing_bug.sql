ALTER TABLE `barbers` ADD `work_days` text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL;--> statement-breakpoint
ALTER TABLE `barbers` ADD `on_vacation` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `barbers` ADD `manual_override_date` text;