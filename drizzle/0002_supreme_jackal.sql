ALTER TABLE `clients` ADD `sms_consented` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `sms_consented_at` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `last_visit_at` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `last_reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `shops` ADD `sms_consent_text` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `reminder_message` text DEFAULT '¡Hola {nombre}! Te extrañamos en {barberia}. Ha pasado un tiempo desde tu última visita. ¡Pasa a vernos pronto! 💈';--> statement-breakpoint
ALTER TABLE `shops` ADD `reminder_days` integer DEFAULT 30 NOT NULL;