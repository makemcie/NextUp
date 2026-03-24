"use server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { broadcast, db } from "@/db";
import { barbers, clients, sessions, shops, users, visits } from "@/db/schema";
import { sendSMS } from "@/lib/messaging";

async function getTwilioCreds() {
	const mod = await import("cloudflare:workers");
	const env = mod.env as Record<string, string>;
	return {
		sid: env.TWILIO_SID ?? "",
		token: env.TWILIO_TOKEN ?? "",
		phone: env.TWILIO_PHONE ?? "",
	};
}

async function sendSmsSafe(to: string, body: string): Promise<void> {
	try {
		const creds = await getTwilioCreds();
		if (!creds.sid || !creds.token || !creds.phone) return;
		await sendSMS({ to, body, twilioSid: creds.sid, twilioToken: creds.token, twilioPhone: creds.phone });
	} catch {}
}

// ============ SESSION HELPERS ============

function generateSessionId(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

const SESSION_COOKIE = "nextup_session";

const SESSION_DURATION_DAYS = 30;

async function getSessionUser(): Promise<{ id: number; email: string } | null> {
	const request = getRequest();
	const cookieHeader = request.headers.get("cookie") ?? "";
	// Parse the session cookie manually
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...vals] = part.trim().split("=");
		if (key) cookies[key.trim()] = vals.join("=");
	}
	const sessionId = cookies[SESSION_COOKIE];
	if (!sessionId) return null;

	const now = new Date();
	const result = await (await db())
		.select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1)
		.all();

	const session = result[0];
	if (!session) return null;
	if (session.expiresAt < now) {
		// Expired — clean up
		await (await db()).delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	const user = await (await db())
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1)
		.all();

	return user[0] ?? null;
}

// Legacy Whop header fallback (keeps existing accounts working)
async function getUserId(): Promise<number | null> {
	// First try session cookie
	const sessionUser = await getSessionUser();
	if (sessionUser) return sessionUser.id;

	// Fallback: Whop header (for existing linked accounts)
	const request = getRequest();
	const whopUserId = request.headers.get("x-whop-user-id");
	if (!whopUserId) return null;

	const result = await (await db())
		.select({ id: users.id })
		.from(users)
		.where(eq(users.whopUserId, whopUserId))
		.limit(1)
		.all();

	return result[0]?.id ?? null;
}

// ============ AUTH FUNCTIONS ============

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
	const sessionUser = await getSessionUser();
	if (sessionUser) {
		return { authenticated: true as const, email: sessionUser.email };
	}
	// Whop fallback
	const request = getRequest();
	const whopUserId = request.headers.get("x-whop-user-id");
	if (whopUserId) {
		const result = await (await db())
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.whopUserId, whopUserId))
			.limit(1)
			.all();
		if (result[0]) return { authenticated: true as const, email: result[0].email };
	}
	return { authenticated: false as const };
});

export const signup = createServerFn({ method: "POST" })
	.inputValidator((input: { email: string; password: string }) => input)
	.handler(async ({ data }) => {
		// Check if email already taken
		const emailExists = await (await db())
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, data.email.toLowerCase().trim()))
			.limit(1)
			.all();
		if (emailExists[0]) {
			return { success: false as const, error: "EMAIL_EXISTS" as const };
		}

		if (data.password.length < 6) {
			return { success: false as const, error: "PASSWORD_TOO_SHORT" as const };
		}

		const passwordHash = await bcrypt.hash(data.password, 10);

		// Also try to link Whop user ID if present
		const request = getRequest();
		const whopUserId = request.headers.get("x-whop-user-id") ?? undefined;

		const result = await (await db())
			.insert(users)
			.values({
				email: data.email.toLowerCase().trim(),
				passwordHash,
				whopUserId: whopUserId ?? null,
			})
			.returning();

		const newUser = result[0];

		// Create session
		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
		await (await db()).insert(sessions).values({
			id: sessionId,
			userId: newUser.id,
			expiresAt,
		});

		setCookie(SESSION_COOKIE, sessionId, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			expires: expiresAt,
		});

		return { success: true as const };
	});

export const login = createServerFn({ method: "POST" })
	.inputValidator((input: { email: string; password: string }) => input)
	.handler(async ({ data }) => {
		const result = await (await db())
			.select()
			.from(users)
			.where(eq(users.email, data.email.toLowerCase().trim()))
			.limit(1)
			.all();

		if (!result[0]) {
			return { success: false as const, error: "INVALID_CREDENTIALS" as const };
		}

		const valid = await bcrypt.compare(data.password, result[0].passwordHash);
		if (!valid) {
			return { success: false as const, error: "INVALID_CREDENTIALS" as const };
		}

		// Create session
		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
		await (await db()).insert(sessions).values({
			id: sessionId,
			userId: result[0].id,
			expiresAt,
		});

		setCookie(SESSION_COOKIE, sessionId, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			expires: expiresAt,
		});

		return { success: true as const };
	});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
	const request = getRequest();
	const cookieHeader = request.headers.get("cookie") ?? "";
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...vals] = part.trim().split("=");
		if (key) cookies[key.trim()] = vals.join("=");
	}
	const sessionId = cookies[SESSION_COOKIE];
	if (sessionId) {
		await (await db()).delete(sessions).where(eq(sessions.id, sessionId));
	}
	deleteCookie(SESSION_COOKIE);
	return { success: true as const };
});

export const getRecoveryInfo = createServerFn({ method: "GET" }).handler(async () => {
	const sessionUser = await getSessionUser();
	if (!sessionUser) return { found: false as const };
	const email = sessionUser.email;
	const [local, domain] = email.split("@");
	const masked =
		local.length <= 2
			? `${local[0]}***@${domain}`
			: `${local[0]}***${local[local.length - 1]}@${domain}`;
	return { found: true as const, maskedEmail: masked };
});

export const resetPassword = createServerFn({ method: "POST" })
	.inputValidator((input: { newPassword: string }) => input)
	.handler(async ({ data }) => {
		const sessionUser = await getSessionUser();
		if (!sessionUser) throw new Error("Not authenticated");
		if (data.newPassword.length < 6) {
			return { success: false as const, error: "PASSWORD_TOO_SHORT" as const };
		}
		const passwordHash = await bcrypt.hash(data.newPassword, 10);
		await (await db())
			.update(users)
			.set({ passwordHash })
			.where(eq(users.id, sessionUser.id));
		return { success: true as const };
	});

// ============ SHOP FUNCTIONS ============

export const getMyShop = createServerFn({ method: "GET" }).handler(async () => {
	const userId = await getUserId();
	if (!userId) return null;
	const result = await (await db())
		.select()
		.from(shops)
		.where(eq(shops.ownerId, userId))
		.limit(1)
		.all();
	return result[0] ?? null;
});

export const createShop = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			name: string;
			address?: string;
			phone?: string;
			googleReviewLink?: string;
		}) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const result = await (await db())
			.insert(shops)
			.values({
				ownerId: userId,
				name: data.name,
				address: data.address,
				phone: data.phone,
				googleReviewLink: data.googleReviewLink,
			})
			.returning();
		return result[0];
	});

export const updateShop = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			id: number;
			name?: string;
			address?: string;
			phone?: string;
			googleReviewLink?: string;
			welcomeMessage?: string;
			followUpMessage?: string;
			smsConsentText?: string;
			reminderMessage?: string;
			reminderDays?: number;
			twilioSid?: string;
			twilioToken?: string;
			twilioPhone?: string;
			emailEnabled?: boolean;
			smsEnabled?: boolean;
			followUpDelayMinutes?: number;
			logoUrl?: string;
			weeklyHours?: string;
		}) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const { id, ...updates } = data;
		// Remove undefined values
		const cleanUpdates = Object.fromEntries(
			Object.entries(updates).filter(([, v]) => v !== undefined),
		);
		await (await db())
			.update(shops)
			.set(cleanUpdates)
			.where(and(eq(shops.id, id), eq(shops.ownerId, userId)));
		return { success: true };
	});

// ============ BARBER FUNCTIONS ============

export const getBarbers = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		return await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.shopId, data.shopId))
			.orderBy(barbers.name)
			.all();
	});

// Generate a random 6-char alphanumeric access code
function generateAccessCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

export const createBarber = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { shopId: number; name: string; specialty?: string }) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select()
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (!shop[0]) throw new Error("Shop not found");
		const accessCode = generateAccessCode();
		const result = await (await db())
			.insert(barbers)
			.values({
				shopId: data.shopId,
				name: data.name,
				specialty: data.specialty,
				accessCode,
			})
			.returning();
		return result[0];
	});

export const toggleBarber = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { id: number; isActive: boolean; shopId: number }) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		await (await db())
			.update(barbers)
			.set({ isActive: data.isActive })
			.where(and(eq(barbers.id, data.id), eq(barbers.shopId, data.shopId)));
		return { success: true };
	});

// Update barber's work schedule (days of the week)
export const updateBarberSchedule = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { barberId: number; shopId: number; workDays: number[] }) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		// Validate days (0-6)
		const validDays = data.workDays.filter(
			(d) => Number.isInteger(d) && d >= 0 && d <= 6,
		);
		await (await db())
			.update(barbers)
			.set({ workDays: JSON.stringify(validDays) })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { success: true };
	});

// Toggle barber vacation/rest mode
export const toggleBarberVacation = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { barberId: number; shopId: number; onVacation: boolean }) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		await (await db())
			.update(barbers)
			.set({ onVacation: data.onVacation })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { success: true };
	});

// Set manual override to force-show a barber today (even if it's their day off)
export const setBarberOverride = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { barberId: number; shopId: number; active: boolean }) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		const now = new Date();
		const todayStr = data.active
			? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
			: null;
		await (await db())
			.update(barbers)
			.set({ manualOverrideDate: todayStr })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { success: true };
	});

export const deleteBarber = createServerFn({ method: "POST" })
	.inputValidator((input: { id: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		await (await db())
			.delete(barbers)
			.where(and(eq(barbers.id, data.id), eq(barbers.shopId, data.shopId)));
		return { success: true };
	});

// Update barber photo (owner)
export const updateBarberPhoto = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { barberId: number; shopId: number; photoUrl: string | null }) =>
			input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");
		await (await db())
			.update(barbers)
			.set({ photoUrl: data.photoUrl })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { success: true };
	});

// Update own barber photo (barber self-service)
export const updateMyBarberPhoto = createServerFn({ method: "POST" })
	.inputValidator((input: { photoUrl: string | null }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const barberRecord = await (await db())
			.select({ id: barbers.id })
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1)
			.all();
		if (barberRecord.length === 0) throw new Error("No barber profile found");
		await (await db())
			.update(barbers)
			.set({ photoUrl: data.photoUrl })
			.where(eq(barbers.id, barberRecord[0].id));
		return { success: true };
	});

// ============ CLIENT REGISTRATION (Public) ============

export const getShopPublic = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const shop = await (await db())
			.select({
				id: shops.id,
				name: shops.name,
				address: shops.address,
				welcomeMessage: shops.welcomeMessage,
				smsConsentText: shops.smsConsentText,
				smsEnabled: shops.smsEnabled,
			})
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();
		return shop[0] ?? null;
	});

// Public business page — returns full shop info (without logo to keep payload small)
export const getShopPublicFull = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const shop = await (await db())
			.select({
				id: shops.id,
				name: shops.name,
				address: shops.address,
				phone: shops.phone,
				googleReviewLink: shops.googleReviewLink,
				welcomeMessage: shops.welcomeMessage,
				weeklyHours: shops.weeklyHours,
			})
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();
		return shop[0] ?? null;
	});

// Get shop logo separately (base64 can be large)
export const getShopLogo = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const shop = await (await db())
			.select({ logoUrl: shops.logoUrl })
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();
		return shop[0]?.logoUrl ?? null;
	});

export const getActiveBarbers = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		// Get all active, non-vacation barbers
		const allBarbers = await (await db())
			.select({
				id: barbers.id,
				name: barbers.name,
				specialty: barbers.specialty,
				photoUrl: barbers.photoUrl,
				workDays: barbers.workDays,
				onVacation: barbers.onVacation,
				manualOverrideDate: barbers.manualOverrideDate,
			})
			.from(barbers)
			.where(and(eq(barbers.shopId, data.shopId), eq(barbers.isActive, true)))
			.orderBy(barbers.name)
			.all();

		// Filter by availability: schedule + vacation + manual override
		const now = new Date();
		const todayDow = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

		return allBarbers
			.filter((b) => {
				// Vacation mode hides completely
				if (b.onVacation) return false;
				// Manual override for today → force visible
				if (b.manualOverrideDate === todayStr) return true;
				// Check regular schedule
				const days: number[] = JSON.parse(b.workDays || "[0,1,2,3,4,5,6]");
				return days.includes(todayDow);
			})
			.map((b) => ({
				id: b.id,
				name: b.name,
				specialty: b.specialty,
				photoUrl: b.photoUrl,
			}));
	});

export const registerVisit = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			shopId: number;
			name: string;
			phone: string;
			email?: string;
			barberId: number;
			smsConsented: boolean;
		}) => input,
	)
	.handler(async ({ data }) => {
		// Get shop details first (need delay setting + Twilio creds)
		const shopResult = await (await db())
			.select()
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();
		const shop = shopResult[0];
		if (!shop) throw new Error("Shop not found");

		const now = new Date();

		// Find or create client
		const existingClient = await (await db())
			.select()
			.from(clients)
			.where(
				and(eq(clients.shopId, data.shopId), eq(clients.phone, data.phone)),
			)
			.limit(1)
			.all();

		let clientId: number;
		if (existingClient[0]) {
			clientId = existingClient[0].id;
			const updateFields: Record<string, unknown> = {
				name: data.name,
				email: data.email,
				lastVisitAt: now,
			};
			// Update SMS consent if client is giving new consent
			if (data.smsConsented) {
				updateFields.smsConsented = true;
				updateFields.smsConsentedAt = now;
			}
			await (await db())
				.update(clients)
				.set(updateFields)
				.where(eq(clients.id, clientId));
		} else {
			const newClient = await (await db())
				.insert(clients)
				.values({
					shopId: data.shopId,
					name: data.name,
					phone: data.phone,
					email: data.email,
					smsConsented: data.smsConsented,
					smsConsentedAt: data.smsConsented ? now : undefined,
					lastVisitAt: now,
				})
				.returning();
			clientId = newClient[0].id;
		}

		// Create visit (follow-up will be scheduled when completed)
		const visit = await (await db())
			.insert(visits)
			.values({
				shopId: data.shopId,
				clientId,
				barberId: data.barberId,
				status: "waiting",
				welcomeSent: false,
			})
			.returning();

		// Send welcome SMS only if client consented AND Twilio is configured
		let smsSent = false;
		if (
			data.smsConsented &&
			shop.smsEnabled &&
			shop.phone
		) {
			const welcomeText = (
				shop.welcomeMessage ?? "Thanks for visiting! Please have a seat."
			)
				.replace("{nombre}", data.name)
				.replace("{name}", data.name)
				.replace("{barberia}", shop.name)
				.replace("{shop}", shop.name);

			const twilio = await getTwilioCreds();
			const smsResult = await sendSMS({
				to: data.phone,
				body: welcomeText,
				twilioSid: twilio.sid,
				twilioToken: twilio.token,
				twilioPhone: twilio.phone,
			});
			smsSent = smsResult.success;
		}

		// Mark welcome as sent
		await (await db())
			.update(visits)
			.set({ welcomeSent: true })
			.where(eq(visits.id, visit[0].id));

		// Calculate queue position
		const waitingAhead = await (await db())
			.select({ count: count() })
			.from(visits)
			.where(
				and(
					eq(visits.barberId, data.barberId),
					eq(visits.status, "waiting"),
					lte(visits.id, visit[0].id),
				),
			);

		// Get barber name
		const barberResult = await (await db())
			.select({ name: barbers.name })
			.from(barbers)
			.where(eq(barbers.id, data.barberId))
			.limit(1)
			.all();

		// Broadcast queue update
		await broadcast({ type: "queue_updated", shopId: data.shopId });

		return {
			visitId: visit[0].id,
			welcomeMessage: shop.welcomeMessage,
			shopName: shop.name,
			smsSent,
			queuePosition: waitingAhead[0].count,
			barberName: barberResult[0]?.name ?? "",
		};
	});

// ============ CLIENT DATABASE ============

export const getShopClients = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const allClients = await (await db())
			.select({
				id: clients.id,
				name: clients.name,
				phone: clients.phone,
				email: clients.email,
				smsConsented: clients.smsConsented,
				lastVisitAt: clients.lastVisitAt,
				createdAt: clients.createdAt,
			})
			.from(clients)
			.where(eq(clients.shopId, data.shopId))
			.orderBy(desc(clients.createdAt))
			.all();

		const visitCounts = await (await db())
			.select({
				clientId: visits.clientId,
				visitCount: count(),
			})
			.from(visits)
			.where(eq(visits.shopId, data.shopId))
			.groupBy(visits.clientId)
			.all();

		const countMap = new Map(
			visitCounts.map((v) => [v.clientId, v.visitCount]),
		);

		return allClients.map((c) => ({
			...c,
			visitCount: countMap.get(c.id) ?? 0,
		}));
	});

// ============ CLIENT MANAGEMENT (Owner only) ============

export const updateClient = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			clientId: number;
			shopId: number;
			name?: string;
			phone?: string;
			email?: string | null;
		}) => input,
	)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const updates: Record<string, unknown> = {};
		if (data.name !== undefined) updates.name = data.name;
		if (data.phone !== undefined) updates.phone = data.phone;
		if (data.email !== undefined) updates.email = data.email;

		if (Object.keys(updates).length === 0) return { success: true };

		await (await db())
			.update(clients)
			.set(updates)
			.where(
				and(eq(clients.id, data.clientId), eq(clients.shopId, data.shopId)),
			);
		return { success: true };
	});

export const deleteClient = createServerFn({ method: "POST" })
	.inputValidator((input: { clientId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		// Delete associated visits first
		await (await db())
			.delete(visits)
			.where(
				and(eq(visits.clientId, data.clientId), eq(visits.shopId, data.shopId)),
			);
		// Delete the client
		await (await db())
			.delete(clients)
			.where(
				and(eq(clients.id, data.clientId), eq(clients.shopId, data.shopId)),
			);
		return { success: true };
	});

export const exportClientsCSV = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id, name: shops.name })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		// Get all clients with their visit counts
		const allClients = await (await db())
			.select({
				id: clients.id,
				name: clients.name,
				phone: clients.phone,
				email: clients.email,
				smsConsented: clients.smsConsented,
				lastVisitAt: clients.lastVisitAt,
				createdAt: clients.createdAt,
			})
			.from(clients)
			.where(eq(clients.shopId, data.shopId))
			.orderBy(desc(clients.createdAt))
			.all();

		// Get visit counts per client
		const visitCounts = await (await db())
			.select({
				clientId: visits.clientId,
				visitCount: count(),
			})
			.from(visits)
			.where(eq(visits.shopId, data.shopId))
			.groupBy(visits.clientId)
			.all();

		const countMap = new Map(
			visitCounts.map((v) => [v.clientId, v.visitCount]),
		);

		return allClients.map((c) => ({
			...c,
			visitCount: countMap.get(c.id) ?? 0,
		}));
	});

// ============ FOLLOW-UP PROCESSOR ============

export const processFollowUps = createServerFn({ method: "POST" }).handler(
	async () => {
		const now = new Date();

		// Find visits where follow-up is due but not yet sent
		const pendingVisits = await (await db())
			.select({
				visitId: visits.id,
				shopId: visits.shopId,
				clientId: visits.clientId,
			})
			.from(visits)
			.where(
				and(
					eq(visits.followUpSent, false),
					eq(visits.welcomeSent, true),
					lte(visits.followUpScheduledAt, now),
				),
			)
			.limit(20)
			.all();

		let sent = 0;
		let errors = 0;

		for (const visit of pendingVisits) {
			try {
				const shopResult = await (await db())
					.select()
					.from(shops)
					.where(eq(shops.id, visit.shopId))
					.limit(1)
					.all();
				const clientResult = await (await db())
					.select()
					.from(clients)
					.where(eq(clients.id, visit.clientId))
					.limit(1)
					.all();

				if (!shopResult[0] || !clientResult[0]) {
					// Mark as sent to avoid retrying bad data
					await (await db())
						.update(visits)
						.set({ followUpSent: true })
						.where(eq(visits.id, visit.visitId));
					continue;
				}

				const shop = shopResult[0];
				const client = clientResult[0];

				// Only send SMS if client has consented
				if (
					client.smsConsented &&
					shop.smsEnabled &&
					shop.twilioSid &&
					shop.twilioToken &&
					shop.twilioPhone
				) {
					// Build follow-up message
					let message = (
						shop.followUpMessage ??
						"Thanks for visiting! We'd love to hear your feedback."
					)
						.replace("{nombre}", client.name)
						.replace("{name}", client.name)
						.replace("{barberia}", shop.name)
						.replace("{shop}", shop.name);

					if (shop.googleReviewLink) {
						message += `\n\n⭐ Leave us a review here: ${shop.googleReviewLink}`;
					}

					const twilioF = await getTwilioCreds();
					const result = await sendSMS({
						twilioSid: twilioF.sid,
						twilioToken: twilioF.token,
						twilioPhone: twilioF.phone,
						to: client.phone,
						body: message,
					});
					if (result.success) sent++;
					else errors++;
				}

				// Mark as sent regardless (to avoid infinite retries)
				await (await db())
					.update(visits)
					.set({ followUpSent: true })
					.where(eq(visits.id, visit.visitId));
			} catch {
				errors++;
				// Mark as sent to prevent stuck records
				await (await db())
					.update(visits)
					.set({ followUpSent: true })
					.where(eq(visits.id, visit.visitId));
			}
		}

		return { processed: pendingVisits.length, sent, errors };
	},
);

// ============ REMINDER PROCESSOR (30-day inactive clients) ============

export const processReminders = createServerFn({ method: "POST" }).handler(
	async () => {
		const now = new Date();
		let totalSent = 0;
		let totalErrors = 0;

		// Get all shops with SMS enabled
		const smsShops = await (await db())
			.select()
			.from(shops)
			.where(eq(shops.smsEnabled, true))
			.all();

		for (const shop of smsShops) {
			if (!shop.phone) continue;

			const reminderDays = shop.reminderDays ?? 30;
			const cutoffDate = new Date(
				now.getTime() - reminderDays * 24 * 60 * 60 * 1000,
			);
			// Don't send more than one reminder per 25 days to avoid spamming
			const reminderCooldown = new Date(
				now.getTime() - 25 * 24 * 60 * 60 * 1000,
			);

			// Find clients who:
			// 1. Belong to this shop
			// 2. Have SMS consent
			// 3. Last visited more than X days ago
			// 4. Haven't received a reminder recently (or ever)
			const inactiveClients = await (await db())
				.select()
				.from(clients)
				.where(
					and(
						eq(clients.shopId, shop.id),
						eq(clients.smsConsented, true),
						lte(clients.lastVisitAt, cutoffDate),
						or(
							isNull(clients.lastReminderSentAt),
							lte(clients.lastReminderSentAt, reminderCooldown),
						),
					),
				)
				.limit(20)
				.all();

			for (const client of inactiveClients) {
				try {
					const message = (
						shop.reminderMessage ??
						"Hey {name}! We miss you at {shop}. It's been a while since your last visit. Come see us soon! 💈"
					)
						.replace("{nombre}", client.name)
						.replace("{name}", client.name)
						.replace("{barberia}", shop.name)
						.replace("{shop}", shop.name);

					const twilioF = await getTwilioCreds();
					const result = await sendSMS({
						twilioSid: twilioF.sid,
						twilioToken: twilioF.token,
						twilioPhone: twilioF.phone,
						to: client.phone,
						body: message,
					});

					if (result.success) {
						totalSent++;
					} else {
						totalErrors++;
					}

					// Mark reminder as sent regardless
					await (await db())
						.update(clients)
						.set({ lastReminderSentAt: now })
						.where(eq(clients.id, client.id));
				} catch {
					totalErrors++;
					// Mark as sent to avoid infinite retries
					await (await db())
						.update(clients)
						.set({ lastReminderSentAt: now })
						.where(eq(clients.id, client.id));
				}
			}
		}

		return { sent: totalSent, errors: totalErrors };
	},
);

// ============ QUEUE FUNCTIONS ============

// Get queue position for a specific visit
export const getQueuePosition = createServerFn({ method: "GET" })
	.inputValidator((input: { visitId: number }) => input)
	.handler(async ({ data }) => {
		const visitResult = await (await db())
			.select()
			.from(visits)
			.where(eq(visits.id, data.visitId))
			.limit(1)
			.all();
		const visit = visitResult[0];
		if (!visit || visit.status !== "waiting") return null;

		const ahead = await (await db())
			.select({ count: count() })
			.from(visits)
			.where(
				and(
					eq(visits.barberId, visit.barberId),
					eq(visits.status, "waiting"),
					lte(visits.id, visit.id),
				),
			);
		return { position: ahead[0].count, status: visit.status };
	});

// Get all queues for a shop (all barbers with their waiting clients)
export const getShopQueues = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const barberList = await (await db())
			.select()
			.from(barbers)
			.where(and(eq(barbers.shopId, data.shopId), eq(barbers.isActive, true)))
			.orderBy(barbers.name)
			.all();

		const queues = await Promise.all(
			barberList.map(async (barber) => {
				const waitingClients = await (await db())
					.select({
						visitId: visits.id,
						clientName: clients.name,
						clientPhone: clients.phone,
						createdAt: visits.createdAt,
					})
					.from(visits)
					.innerJoin(clients, eq(visits.clientId, clients.id))
					.where(
						and(eq(visits.barberId, barber.id), eq(visits.status, "waiting")),
					)
					.orderBy(asc(visits.id))
					.all();

				const currentClient = await (await db())
					.select({
						visitId: visits.id,
						clientName: clients.name,
						clientPhone: clients.phone,
						createdAt: visits.createdAt,
					})
					.from(visits)
					.innerJoin(clients, eq(visits.clientId, clients.id))
					.where(
						and(
							eq(visits.barberId, barber.id),
							eq(visits.status, "in_service"),
						),
					)
					.limit(1)
					.all();

				return {
					barber: {
						id: barber.id,
						name: barber.name,
						specialty: barber.specialty,
					},
					currentClient: currentClient[0] ?? null,
					waitingClients,
					waitingCount: waitingClients.length,
				};
			}),
		);

		return queues;
	});

// Call next client (move from waiting to in_service)
export const callNextClient = createServerFn({ method: "POST" })
	.inputValidator((input: { barberId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		// Verify ownership
		const shop = await (await db())
			.select()
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (!shop[0]) throw new Error("Not authorized");

		// First, complete any current in_service client for this barber
		const delayMs = (shop[0].followUpDelayMinutes ?? 180) * 60 * 1000;
		const followUpTime = new Date(Date.now() + delayMs);

		await (await db())
			.update(visits)
			.set({ status: "completed", followUpScheduledAt: followUpTime })
			.where(
				and(
					eq(visits.barberId, data.barberId),
					eq(visits.status, "in_service"),
				),
			);

		// Get next waiting client (oldest first by ID)
		const nextVisit = await (await db())
			.select()
			.from(visits)
			.where(
				and(eq(visits.barberId, data.barberId), eq(visits.status, "waiting")),
			)
			.orderBy(asc(visits.id))
			.limit(1)
			.all();

		if (!nextVisit[0]) {
			await broadcast({ type: "queue_updated", shopId: data.shopId });
			return { called: false };
		}

		// Move to in_service
		await (await db())
			.update(visits)
			.set({ status: "in_service" })
			.where(eq(visits.id, nextVisit[0].id));

		await broadcast({ type: "queue_updated", shopId: data.shopId });

		// Get client info for SMS
		const client = await (await db())
			.select({ name: clients.name, phone: clients.phone })
			.from(clients)
			.where(eq(clients.id, nextVisit[0].clientId))
			.limit(1)
			.all();

		// Get barber and shop info for SMS
		const barberInfo = await (await db())
			.select({ name: barbers.name })
			.from(barbers)
			.where(eq(barbers.id, nextVisit[0].barberId))
			.limit(1)
			.all();

		const shopInfo = await (await db())
			.select({ name: shops.name })
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();

		// Send SMS to client that their turn is ready
		if (client[0]?.phone) {
			sendSmsSafe(client[0].phone, `💈 ${barberInfo[0]?.name ?? "Your barber"} is ready for you at ${shopInfo[0]?.name ?? "the shop"}. Please come to the chair now!`).catch(() => {});
		}

		return { called: true, clientName: client[0]?.name ?? "" };
	});

// Complete current client
export const completeClient = createServerFn({ method: "POST" })
	.inputValidator((input: { visitId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const shop = await (await db())
			.select()
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (!shop[0]) throw new Error("Not authorized");

		// Schedule follow-up from NOW (after service is done)
		const delayMs = (shop[0].followUpDelayMinutes ?? 180) * 60 * 1000;
		const followUpTime = new Date(Date.now() + delayMs);

		await (await db())
			.update(visits)
			.set({ status: "completed", followUpScheduledAt: followUpTime })
			.where(eq(visits.id, data.visitId));

		await broadcast({ type: "queue_updated", shopId: data.shopId });
		return { success: true };
	});

// Cancel a queue entry
export const cancelQueueEntry = createServerFn({ method: "POST" })
	.inputValidator((input: { visitId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const shop = await (await db())
			.select()
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (!shop[0]) throw new Error("Not authorized");

		await (await db())
			.update(visits)
			.set({ status: "cancelled" })
			.where(eq(visits.id, data.visitId));

		await broadcast({ type: "queue_updated", shopId: data.shopId });
		return { success: true };
	});

// ============ DASHBOARD STATS ============

export const getDashboardStats = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const totalClients = await (await db())
			.select({ count: count() })
			.from(clients)
			.where(eq(clients.shopId, data.shopId));

		const totalVisits = await (await db())
			.select({ count: count() })
			.from(visits)
			.where(eq(visits.shopId, data.shopId));

		const recentVisits = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				barberName: barbers.name,
				status: visits.status,
				welcomeSent: visits.welcomeSent,
				followUpSent: visits.followUpSent,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.innerJoin(barbers, eq(visits.barberId, barbers.id))
			.where(eq(visits.shopId, data.shopId))
			.orderBy(desc(visits.createdAt))
			.limit(50)
			.all();

		return {
			totalClients: totalClients[0].count,
			totalVisits: totalVisits[0].count,
			recentVisits,
		};
	});

// ============ BARBER PORTAL FUNCTIONS ============

// Detect current user's role: owner, barber, or none
export const getMyRole = createServerFn({ method: "GET" }).handler(async () => {
	const userId = await getUserId();
	if (!userId) return { role: "none" as const };

	// Check if owner of any shop
	const ownerShop = await (await db())
		.select()
		.from(shops)
		.where(eq(shops.ownerId, userId))
		.limit(1)
		.all();
	if (ownerShop[0]) {
		return { role: "owner" as const, shop: ownerShop[0] };
	}

	// Check if linked as a barber
	const barberRecord = await (await db())
		.select({
			id: barbers.id,
			name: barbers.name,
			specialty: barbers.specialty,
			photoUrl: barbers.photoUrl,
			shopId: barbers.shopId,
			isActive: barbers.isActive,
			shopName: shops.name,
		})
		.from(barbers)
		.innerJoin(shops, eq(barbers.shopId, shops.id))
		.where(eq(barbers.userId, userId))
		.limit(1)
		.all();
	if (barberRecord[0]) {
		return { role: "barber" as const, barber: barberRecord[0] };
	}

	return { role: "none" as const };
});

// Barber claims their account using an access code
export const claimBarberAccess = createServerFn({ method: "POST" })
	.inputValidator((input: { code: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const code = data.code.trim().toUpperCase();
		const barber = await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.accessCode, code))
			.limit(1)
			.all();
		if (!barber[0]) {
			return { success: false as const, error: "INVALID_CODE" as const };
		}

		// Check if already claimed by someone else
		if (barber[0].userId && barber[0].userId !== userId) {
			return { success: false as const, error: "ALREADY_CLAIMED" as const };
		}

		// Check if this user is already linked to another barber
		const existing = await (await db())
			.select({ id: barbers.id })
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1)
			.all();
		if (existing[0] && existing[0].id !== barber[0].id) {
			return { success: false as const, error: "USER_ALREADY_LINKED" as const };
		}

		// Link the user to this barber
		await (await db())
			.update(barbers)
			.set({ userId, accessCode: null })
			.where(eq(barbers.id, barber[0].id));

		return {
			success: true as const,
			barberName: barber[0].name,
			shopId: barber[0].shopId,
		};
	});

// Get the barber's own queue (only their clients)
export const getMyBarberQueue = createServerFn({ method: "GET" }).handler(
	async () => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const barber = await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1)
			.all();
		if (!barber[0]) throw new Error("Not a barber");

		// Current client being served
		const currentClient = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.where(
				and(eq(visits.barberId, barber[0].id), eq(visits.status, "in_service")),
			)
			.limit(1)
			.all();

		// Waiting clients
		const waitingClients = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.where(
				and(eq(visits.barberId, barber[0].id), eq(visits.status, "waiting")),
			)
			.orderBy(asc(visits.id))
			.all();

		return {
			barberId: barber[0].id,
			barberName: barber[0].name,
			shopId: barber[0].shopId,
			currentClient: currentClient[0] ?? null,
			waitingClients,
			waitingCount: waitingClients.length,
		};
	},
);

// Barber calls next client in their own queue
export const barberCallNext = createServerFn({ method: "POST" }).handler(
	async () => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const barber = await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1)
			.all();
		if (!barber[0]) throw new Error("Not a barber");

		// Get shop for follow-up delay
		const shop = await (await db())
			.select()
			.from(shops)
			.where(eq(shops.id, barber[0].shopId))
			.limit(1)
			.all();
		if (!shop[0]) throw new Error("Shop not found");

		const delayMs = (shop[0].followUpDelayMinutes ?? 180) * 60 * 1000;
		const followUpTime = new Date(Date.now() + delayMs);

		// Complete any current in_service client
		await (await db())
			.update(visits)
			.set({ status: "completed", followUpScheduledAt: followUpTime })
			.where(
				and(eq(visits.barberId, barber[0].id), eq(visits.status, "in_service")),
			);

		// Get next waiting client
		const nextVisit = await (await db())
			.select()
			.from(visits)
			.where(
				and(eq(visits.barberId, barber[0].id), eq(visits.status, "waiting")),
			)
			.orderBy(asc(visits.id))
			.limit(1)
			.all();

		if (!nextVisit[0]) {
			await broadcast({
				type: "queue_updated",
				shopId: barber[0].shopId,
			});
			return { called: false };
		}

		await (await db())
			.update(visits)
			.set({ status: "in_service" })
			.where(eq(visits.id, nextVisit[0].id));

		await broadcast({ type: "queue_updated", shopId: barber[0].shopId });

		// Send SMS to client that their turn is ready
		const clientInfo = await (await db())
			.select({ name: clients.name, phone: clients.phone })
			.from(clients)
			.where(eq(clients.id, nextVisit[0].clientId))
			.limit(1)
			.all();

		const shopInfo2 = await (await db())
			.select({ name: shops.name })
			.from(shops)
			.where(eq(shops.id, barber[0].shopId))
			.limit(1)
			.all();

		if (clientInfo[0]?.phone) {
			sendSmsSafe(clientInfo[0].phone, `💈 ${barber[0].name} is ready for you at ${shopInfo2[0]?.name ?? "the shop"}. Please come to the chair now!`).catch(() => {});
		}

		const client = await (await db())
			.select({ name: clients.name })
			.from(clients)
			.where(eq(clients.id, nextVisit[0].clientId))
			.limit(1)
			.all();

		return { called: true, clientName: client[0]?.name ?? "" };
	},
);

// Barber completes their current client
export const barberCompleteClient = createServerFn({ method: "POST" })
	.inputValidator((input: { visitId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const barber = await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1)
			.all();
		if (!barber[0]) throw new Error("Not a barber");

		// Verify this visit belongs to this barber
		const visit = await (await db())
			.select()
			.from(visits)
			.where(
				and(
					eq(visits.id, data.visitId),
					eq(visits.barberId, barber[0].id),
					eq(visits.status, "in_service"),
				),
			)
			.limit(1)
			.all();
		if (!visit[0]) throw new Error("Visit not found or not yours");

		const shop = await (await db())
			.select()
			.from(shops)
			.where(eq(shops.id, barber[0].shopId))
			.limit(1)
			.all();

		const delayMs = (shop[0]?.followUpDelayMinutes ?? 180) * 60 * 1000;
		const followUpTime = new Date(Date.now() + delayMs);

		await (await db())
			.update(visits)
			.set({ status: "completed", followUpScheduledAt: followUpTime })
			.where(eq(visits.id, data.visitId));

		await broadcast({ type: "queue_updated", shopId: barber[0].shopId });
		return { success: true };
	});

// Owner can regenerate an access code for a barber
export const regenerateBarberCode = createServerFn({ method: "POST" })
	.inputValidator((input: { barberId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		// Verify ownership
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const newCode = generateAccessCode();
		await (await db())
			.update(barbers)
			.set({ accessCode: newCode, userId: null })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { code: newCode };
	});

// Owner can unlink a barber's account
export const unlinkBarber = createServerFn({ method: "POST" })
	.inputValidator((input: { barberId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const newCode = generateAccessCode();
		await (await db())
			.update(barbers)
			.set({ userId: null, accessCode: newCode })
			.where(
				and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)),
			);
		return { success: true, newCode };
	});

// ============ SUPPORT / HELP ============

export const sendSupportEmail = createServerFn({ method: "POST" })
	.inputValidator((input: { subject: string; message: string; shopName: string; userEmail: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		// Get RESEND_API_KEY from env
		const mod = await import("cloudflare:workers");
		const apiKey = (mod.env as Record<string, string>).RESEND_API_KEY;
		if (!apiKey) throw new Error("RESEND_API_KEY not configured");

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: "Goolinext Support <support@goolinext.com>",
				to: ["support@goolinext.com"],
				reply_to: data.userEmail,
				subject: `[Goolinext Support] ${data.subject} - ${data.shopName}`,
				html: `
					<h2>Nuevo mensaje de soporte</h2>
					<p><strong>Negocio:</strong> ${data.shopName}</p>
					<p><strong>Email:</strong> ${data.userEmail}</p>
					<p><strong>Asunto:</strong> ${data.subject}</p>
					<hr/>
					<p><strong>Mensaje:</strong></p>
					<p>${data.message.replace(/\n/g, "<br/>")}</p>
				`,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send email: ${error}`);
		}

		return { success: true };
	});

// ============ STRIPE PAYMENTS ============

async function getStripeKey() {
	const mod = await import("cloudflare:workers");
	const env = mod.env as Record<string, string>;
	return env.STRIPE_SECRET_KEY ?? "";
}

// Create Stripe checkout session
export const createCheckoutSession = createServerFn({ method: "POST" })
	.handler(async () => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		const shop = await (await db())
			.select()
			.from(shops)
			.where(eq(shops.ownerId, user.id))
			.limit(1)
			.all();

		if (!shop[0]) throw new Error("Shop not found");

		const stripeKey = await getStripeKey();
		const origin = "https://goolinext.com";

		const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${stripeKey}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				"mode": "subscription",
				"line_items[0][price]": "price_1TEK9I1NfybwCy3hbYZdnPwL",
				"line_items[0][quantity]": "1",
				"success_url": `${origin}/?payment=success&shopId=${shop[0].id}&session_id={CHECKOUT_SESSION_ID}`,
				"cancel_url": `${origin}/?payment=cancelled`,
				"metadata[shopId]": String(shop[0].id),
				"metadata[userId]": String(user.id),
				"customer_email": user.email,
			}),
		});

		const session = await response.json() as { url?: string; error?: { message: string } };

		if (!response.ok) throw new Error(session.error?.message ?? "Stripe error");

		return { url: session.url };
	});

// Get subscription status
export const getSubscriptionStatus = createServerFn({ method: "GET" })
	.handler(async () => {
		const user = await getSessionUser();
		if (!user) return { status: "none" };

		const shop = await (await db())
			.select({
				subscriptionStatus: shops.subscriptionStatus,
				subscriptionEndsAt: shops.subscriptionEndsAt,
				stripeSubscriptionId: shops.stripeSubscriptionId,
			})
			.from(shops)
			.where(eq(shops.ownerId, user.id))
			.limit(1)
			.all();

		return {
			status: shop[0]?.subscriptionStatus ?? "trial",
			endsAt: shop[0]?.subscriptionEndsAt ?? null,
		};
	});

// Cancel subscription
export const cancelSubscription = createServerFn({ method: "POST" })
	.handler(async () => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		const shop = await (await db())
			.select({ stripeSubscriptionId: shops.stripeSubscriptionId })
			.from(shops)
			.where(eq(shops.ownerId, user.id))
			.limit(1)
			.all();

		if (!shop[0]?.stripeSubscriptionId) throw new Error("No subscription found");

		const stripeKey = await getStripeKey();

		await fetch(`https://api.stripe.com/v1/subscriptions/${shop[0].stripeSubscriptionId}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${stripeKey}` },
		});

		await (await db())
			.update(shops)
			.set({ subscriptionStatus: "canceled" })
			.where(eq(shops.ownerId, user.id));

		return { success: true };
	});

// ============ STRIPE WEBHOOK HANDLER ============
export const handleStripeWebhook = createServerFn({ method: "POST" })
	.inputValidator((input: { body: string; signature: string }) => input)
	.handler(async ({ data }) => {
		const mod = await import("cloudflare:workers");
		const env = mod.env as Record<string, string>;
		const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";

		// Verify signature
		const parts = data.signature.split(",");
		const timestamp = parts.find((p: string) => p.startsWith("t="))?.split("=")[1] ?? "";
		const sigHash = parts.find((p: string) => p.startsWith("v1="))?.split("=")[1] ?? "";
		const signedPayload = `${timestamp}.${data.body}`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
		const expectedSig = Array.from(new Uint8Array(sig)).map((b: number) => b.toString(16).padStart(2, "0")).join("");

		if (expectedSig !== sigHash) throw new Error("Invalid signature");

		const event = JSON.parse(data.body) as { type: string; data: { object: Record<string, unknown> } };

		if (event.type === "checkout.session.completed") {
			const session = event.data.object;
			const shopId = (session.metadata as Record<string, string>)?.shopId;
			const customerId = session.customer as string;
			const subscriptionId = session.subscription as string;
			if (shopId) {
				const endsAt = new Date();
				endsAt.setMonth(endsAt.getMonth() + 1);
				await (await db()).update(shops).set({
					stripeCustomerId: customerId,
					stripeSubscriptionId: subscriptionId,
					subscriptionStatus: "active",
					subscriptionEndsAt: endsAt,
				}).where(eq(shops.id, Number(shopId)));
			}
		}

		if (event.type === "customer.subscription.deleted") {
			const sub = event.data.object;
			await (await db()).update(shops).set({ subscriptionStatus: "canceled" })
				.where(eq(shops.stripeSubscriptionId, sub.id as string));
		}

		if (event.type === "invoice.payment_failed") {
			const inv = event.data.object;
			await (await db()).update(shops).set({ subscriptionStatus: "past_due" })
				.where(eq(shops.stripeSubscriptionId, inv.subscription as string));
		}

		return { received: true };
	});

// Activate subscription after successful Stripe checkout
export const activateSubscription = createServerFn({ method: "POST" })
	.inputValidator((input: { sessionId: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		const stripeKey = await getStripeKey();

		// Get checkout session from Stripe
		const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${data.sessionId}`, {
			headers: { Authorization: `Bearer ${stripeKey}` },
		});

		const session = await response.json() as {
			payment_status: string;
			customer: string;
			subscription: string;
			metadata: { shopId?: string };
		};

		if (session.payment_status !== "paid") throw new Error("Payment not completed");

		const shopId = session.metadata?.shopId;
		if (!shopId) throw new Error("Shop not found");

		const endsAt = new Date();
		endsAt.setMonth(endsAt.getMonth() + 1);

		await (await db()).update(shops).set({
			stripeCustomerId: session.customer,
			stripeSubscriptionId: session.subscription,
			subscriptionStatus: "active",
			subscriptionEndsAt: endsAt,
		}).where(eq(shops.id, Number(shopId)));

		return { success: true };
	});
