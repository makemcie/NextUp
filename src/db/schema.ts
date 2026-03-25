import { sql } from "drizzle-orm";
import {
	blob,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export { sql, blob, integer, real, sqliteTable, text };

// User accounts (email/password auth — independent of Whop)
export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	// whopUserId kept for backwards compatibility but now nullable
	whopUserId: text("whop_user_id").unique(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	phone: text("phone"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Sessions — cookie-based auth tokens (replaces Whop header dependency)
export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(), // random 64-char hex token
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Barbershops/Salons
export const shops = sqliteTable("shops", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	ownerId: integer("owner_id").notNull().references(() => users.id),
	name: text("name").notNull(),
	address: text("address"),
	phone: text("phone"),
	googleReviewLink: text("google_review_link"),
	welcomeMessage: text("welcome_message").default(
		"¡Gracias por visitarnos! Por favor toma asiento, serás atendido en breve.",
	),
	followUpMessage: text("follow_up_message").default(
		"¡Gracias por visitarnos hoy! Nos encantaría saber tu opinión. ¿Podrías dejarnos una reseña en Google?",
	),
	smsConsentText: text("sms_consent_text"),
	reminderMessage: text("reminder_message").default(
		"¡Hola {nombre}! Te extrañamos en {barberia}. Ha pasado un tiempo desde tu última visita. ¡Pasa a vernos pronto! 💈",
	),
	reminderDays: integer("reminder_days").notNull().default(30),
	twilioSid: text("twilio_sid"),
	twilioToken: text("twilio_token"),
	twilioPhone: text("twilio_phone"),
	emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(true),
	smsEnabled: integer("sms_enabled", { mode: "boolean" }).notNull().default(false),
	followUpDelayMinutes: integer("follow_up_delay_minutes").notNull().default(180),
	logoUrl: text("logo_url"),
	weeklyHours: text("weekly_hours"),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	subscriptionStatus: text("subscription_status").default("trial"), // trial, active, past_due, canceled
	subscriptionEndsAt: integer("subscription_ends_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Barbers/Stylists
export const barbers = sqliteTable("barbers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	shopId: integer("shop_id").notNull().references(() => shops.id),
	name: text("name").notNull(),
	specialty: text("specialty"),
	photoUrl: text("photo_url"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	phone: text("phone"),
	userId: integer("user_id").references(() => users.id),
	accessCode: text("access_code"),
	workDays: text("work_days").notNull().default("[0,1,2,3,4,5,6]"),
	onVacation: integer("on_vacation", { mode: "boolean" }).notNull().default(false),
	manualOverrideDate: text("manual_override_date"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Clients who visit the shop
export const clients = sqliteTable("clients", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	shopId: integer("shop_id").notNull().references(() => shops.id),
	name: text("name").notNull(),
	phone: text("phone").notNull(),
	email: text("email"),
	smsConsented: integer("sms_consented", { mode: "boolean" }).notNull().default(false),
	smsConsentedAt: integer("sms_consented_at", { mode: "timestamp" }),
	lastVisitAt: integer("last_visit_at", { mode: "timestamp" }),
	lastReminderSentAt: integer("last_reminder_sent_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Visit records
export const visits = sqliteTable("visits", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	shopId: integer("shop_id").notNull().references(() => shops.id),
	clientId: integer("client_id").notNull().references(() => clients.id),
	barberId: integer("barber_id").notNull().references(() => barbers.id),
	status: text("status").notNull().default("waiting"),
	welcomeSent: integer("welcome_sent", { mode: "boolean" }).notNull().default(false),
	followUpSent: integer("follow_up_sent", { mode: "boolean" }).notNull().default(false),
	followUpScheduledAt: integer("follow_up_scheduled_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Appointments
export const appointments = sqliteTable("appointments", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	shopId: integer("shop_id").notNull().references(() => shops.id),
	barberId: integer("barber_id").notNull().references(() => barbers.id),
	clientId: integer("client_id").references(() => clients.id),
	clientName: text("client_name").notNull(),
	clientPhone: text("client_phone").notNull(),
	appointmentDate: text("appointment_date").notNull(), // YYYY-MM-DD
	appointmentTime: text("appointment_time").notNull(), // HH:MM
	status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no_show
	notes: text("notes"),
	visitId: integer("visit_id").references(() => visits.id),
	reminderSent: integer("reminder_sent", { mode: "boolean" }).notNull().default(false),
	cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
	cancelRequestedBy: integer("cancel_requested_by"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});
