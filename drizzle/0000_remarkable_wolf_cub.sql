CREATE TABLE `barbers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`name` text NOT NULL,
	`specialty` text,
	`photo_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`google_review_link` text,
	`welcome_message` text DEFAULT '¡Gracias por visitarnos! Por favor toma asiento, serás atendido en breve.',
	`follow_up_message` text DEFAULT '¡Gracias por visitarnos hoy! Nos encantaría saber tu opinión. ¿Podrías dejarnos una reseña en Google?',
	`twilio_sid` text,
	`twilio_token` text,
	`twilio_phone` text,
	`email_enabled` integer DEFAULT true NOT NULL,
	`sms_enabled` integer DEFAULT false NOT NULL,
	`follow_up_delay_minutes` integer DEFAULT 180 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`barber_id` integer NOT NULL,
	`welcome_sent` integer DEFAULT false NOT NULL,
	`follow_up_sent` integer DEFAULT false NOT NULL,
	`follow_up_scheduled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE no action
);
