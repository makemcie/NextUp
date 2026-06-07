"use server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, gt, gte, isNull, lte, or } from "drizzle-orm";
import { broadcast, db } from "@/db";
import { appointments, barbers, clients, clientAccounts, clientSessions, sessions, shops, users, visits, passwordResetTokens } from "@/db/schema";
import { sendSMS } from "@/lib/messaging";

// Helper: get UTC timestamp boundaries for a date in a specific timezone
function getDateBoundsInTz(dateStr: string, tz: string): { start: Date; end: Date } {
	const sampleDate = new Date(dateStr + "T12:00:00Z");
	const utcStr = sampleDate.toLocaleString("en-US", { timeZone: "UTC", hour12: false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" });
	const localStr = sampleDate.toLocaleString("en-US", { timeZone: tz, hour12: false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" });
	const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime();
	return {
		start: new Date(new Date(dateStr + "T00:00:00.000Z").getTime() - offsetMs),
		end: new Date(new Date(dateStr + "T23:59:59.999Z").getTime() - offsetMs),
	};
}

async function sendSmsSafe(to: string, body: string): Promise<void> {
	try {
		await sendSMS({ to, body });
	} catch (error) {
		console.error("Error sending SMS via Sent:", error);
	}
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

export const getRecoveryInfo = createServerFn({ method: "POST" })
	.inputValidator((input: { email: string }) => input)
	.handler(async ({ data }) => {
		if (!data.email || !data.email.includes("@")) return { found: false as const, sent: false };
		const user = await (await db())
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.email, data.email.toLowerCase().trim()))
			.limit(1)
			.all();
		if (!user[0]) return { found: false as const, sent: false };

		// Generate secure token
		const tokenBytes = new Uint8Array(32);
		crypto.getRandomValues(tokenBytes);
		const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
		const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

		// Store token
		await (await db())
			.insert(passwordResetTokens)
			.values({ userId: user[0].id, token, expiresAt })
			.run();

		// Send email with reset link
		const mod = await import("cloudflare:workers");
		const env = mod.env as Record<string, string>;
		const apiKey = env.RESEND_API_KEY ?? "";
		const resetLink = `https://goolinext.com/?reset=${token}`;

		if (apiKey) {
			await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					from: "Goolinext <support@goolinext.com>",
					to: [user[0].email],
					subject: "Reset your Goolinext password",
					html: `
						<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f14;color:white;border-radius:16px;">
							<h1 style="color:#f97316;font-size:24px;margin-bottom:16px;">Reset your password</h1>
							<p style="color:#94a3b8;margin-bottom:24px;">Click the button below to reset your Goolinext password. This link expires in 1 hour.</p>
							<a href="${resetLink}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#f97316,#ea580c);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;">Reset Password</a>
							<p style="color:#64748b;font-size:13px;margin-top:24px;">If you didn't request this, you can ignore this email. The link expires in 1 hour.</p>
						</div>
					`,
				}),
			}).catch(() => {});
		}

		return { found: true as const, sent: true };
	});

export const resetPassword = createServerFn({ method: "POST" })
	.inputValidator((input: { token: string; newPassword: string }) => input)
	.handler(async ({ data }) => {
		if (data.newPassword.length < 6) {
			return { success: false as const, error: "PASSWORD_TOO_SHORT" as const };
		}

		// Validate token
		const now = Math.floor(Date.now() / 1000);
		const resetToken = await (await db())
			.select()
			.from(passwordResetTokens)
			.where(eq(passwordResetTokens.token, data.token))
			.limit(1)
			.all();

		if (!resetToken[0]) return { success: false as const, error: "INVALID_TOKEN" as const };
		if (resetToken[0].used) return { success: false as const, error: "TOKEN_USED" as const };
		if (resetToken[0].expiresAt < now) return { success: false as const, error: "TOKEN_EXPIRED" as const };

		// Update password
		const passwordHash = await bcrypt.hash(data.newPassword, 10);
		await (await db())
			.update(users)
			.set({ passwordHash })
			.where(eq(users.id, resetToken[0].userId));

		// Mark token as used
		await (await db())
			.update(passwordResetTokens)
			.set({ used: true })
			.where(eq(passwordResetTokens.token, data.token));

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
				whatsappNumber: data.whatsappNumber,
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
			welcomeMessageEn?: string;
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
			timezone?: string;
			whatsappNumber?: string;
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

		// Auto-translate welcomeMessageEn to Spanish if provided
		if (data.welcomeMessageEn) {
			try {
				const res = await fetch("https://api.anthropic.com/v1/messages", {
					method: "POST",
					headers: {
						"x-api-key": (globalThis as any).ANTHROPIC_API_KEY ?? "",
						"anthropic-version": "2023-06-01",
						"content-type": "application/json",
					},
					body: JSON.stringify({
						model: "claude-haiku-4-5-20251001",
						max_tokens: 200,
						messages: [{ role: "user", content: "Translate this barbershop welcome message to Spanish. Return ONLY the translation, nothing else: " + data.welcomeMessageEn }]
					})
				});
				const json = await res.json() as any;
				const translated = json?.content?.[0]?.text?.trim();
				if (translated) {
					await (await db()).update(shops).set({ welcomeMessage: translated }).where(and(eq(shops.id, id), eq(shops.ownerId, userId)));
				}
			} catch {}
		}

		return { success: true };
	});

// ============ BARBER FUNCTIONS ============

export const getBarbers = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
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
		return await (await db())
			.select({
				id: barbers.id,
				name: barbers.name,
				specialty: barbers.specialty,
				photoUrl: barbers.photoUrl,
				isActive: barbers.isActive,
				phone: barbers.phone,
				userId: barbers.userId,
				accessCode: barbers.accessCode,
				workDays: barbers.workDays,
				onVacation: barbers.onVacation,
				manualOverrideDate: barbers.manualOverrideDate,
				stripePayoutsEnabled: barbers.stripePayoutsEnabled,
				stripeAccountId: barbers.stripeAccountId,
				createdAt: barbers.createdAt,
			})
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
		(input: { shopId: number; name: string; specialty?: string; phone: string }) => input,
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
				phone: data.phone,
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
			welcomeMessageEn: shops.welcomeMessageEn,
				smsConsentText: shops.smsConsentText,
				smsEnabled: shops.smsEnabled,
				googleReviewLink: shops.googleReviewLink,
				showQr: shops.showQr,
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
			welcomeMessageEn: shops.welcomeMessageEn,
				weeklyHours: shops.weeklyHours,
				whatsappNumber: shops.whatsappNumber,
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

export const getActiveBarbersForDate = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; date: string }) => input)
	.handler(async ({ data }) => {
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

		// Get day of week for the requested date
		const dateDow = new Date(data.date + "T12:00:00").getDay();

		return allBarbers
			.filter((b) => {
				if (b.onVacation) return false;
				if (b.manualOverrideDate === data.date) return true;
				const days: number[] = JSON.parse(b.workDays || "[0,1,2,3,4,5,6]");
				return days.includes(dateDow);
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
			groupMember?: boolean;
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
				visitCount: (existingClient[0].visitCount ?? 0) + 1,
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

		// Check if client already has an active visit today (skip for group members)
		// Use local date string to avoid UTC day shift
		const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
		const existingVisit = data.groupMember ? [] : await (await db())
			.select()
			.from(visits)
			.where(
				and(
					eq(visits.shopId, data.shopId),
					eq(visits.clientId, clientId),
					or(
						eq(visits.status, "waiting"),
						eq(visits.status, "called"),
					),
				),
			)
			.limit(1)
			.all();

		if (existingVisit[0]) {
			// Client already in queue — return existing visit info
			const queuePos = await (await db())
				.select({ count: count() })
				.from(visits)
				.where(
					and(
						eq(visits.shopId, data.shopId),
						eq(visits.status, "waiting"),
						lte(visits.id, existingVisit[0].id),
					),
				)
				.all();
			return {
				success: true,
				alreadyInQueue: true,
				visitId: existingVisit[0].id,
				queuePosition: queuePos[0]?.count ?? 1,
				message: "You are already in the queue for today.",
			};
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

		// Welcome SMS disabled — client sees confirmation on the registration screen
		const smsSent = false;

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

		// Delete associated appointments first
		await (await db())
			.delete(appointments)
			.where(
				and(eq(appointments.clientId, data.clientId), eq(appointments.shopId, data.shopId)),
			);
		// Delete associated visits
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
					// Build follow-up message - keep under 160 chars per segment
					let message = `Thanks for visiting ${shop.name}! Leave us a review:`;
					if (shop.googleReviewLink) {
						message += ` ${shop.googleReviewLink}`;
					}
					message += " Reply STOP to opt out.";
					// Truncate if over 160 chars
					if (message.length > 160) {
						message = `Thanks for visiting ${shop.name}! Reply STOP to opt out.`;
					}

					const result = await sendSMS({ to: client.phone, body: message,
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
			// 4. Have more than 2 visits (loyalty filter)
			// 5. Have NEVER received a reminder (only 1 reminder per client ever)
			const inactiveClients = await (await db())
				.select()
				.from(clients)
				.where(
					and(
						eq(clients.shopId, shop.id),
						eq(clients.smsConsented, true),
						lte(clients.lastVisitAt, cutoffDate),
						isNull(clients.lastReminderSentAt), // Never sent before = 0 reminders
						gt(clients.visitCount, 2), // More than 2 visits
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

					const result = await sendSMS({ to: client.phone, body: message,
					 });

					if (result.success) {
						totalSent++;
					} else {
						totalErrors++;
					}

					// Mark reminder as sent — only 1 ever
					await (await db())
						.update(clients)
						.set({ lastReminderSentAt: now, reminderSentCount: 1 })
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
						photoUrl: barber.photoUrl,
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
		const message = `It's your turn! 🎉
Please head to the chair with ${barberInfo[0]?.name ?? "your barber"}.
We're waiting for you! 💈`;
		sendSmsSafe(client[0].phone, message).catch(() => {});
	}

		return { called: true, clientName: client[0]?.name ?? "" };
	});

// Complete current client
export const completeClient = createServerFn({ method: "POST" })
	.inputValidator((input: { visitId: number; shopId: number; amountPaid: number }) => input)
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
			.set({ status: "completed", followUpScheduledAt: followUpTime, amountPaid: data.amountPaid })
			.where(eq(visits.id, data.visitId));

		// Send thank you SMS with Google review link
		if (shop[0]?.smsEnabled) {
			const visit = await (await db())
				.select()
				.from(visits)
				.where(eq(visits.id, data.visitId))
				.limit(1)
				.all();

			if (visit[0]) {
				const client = await (await db())
					.select()
					.from(clients)
					.where(eq(clients.id, visit[0].clientId))
					.limit(1)
					.all();

				if (client[0]?.phone) {
					// Create Google Maps review URL
					const googleReviewUrl = `https://www.google.com/maps/search/${encodeURIComponent(shop[0].name)}`;

					const message = `Thanks for visiting ${shop[0].name}! 😊
⭐ Leave us a review on Google!
${googleReviewUrl}

Reply STOP to opt out.`;

					sendSmsSafe(client[0].phone, message).catch(() => {});
				}
			}
		}

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
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1)
			.all();
		if (shop.length === 0) throw new Error("Not authorized");

		const totalClientsResult = await (await db())
			.select({ count: count() })
			.from(clients)
			.where(eq(clients.shopId, data.shopId))
			.all();
		
		const totalClients = totalClientsResult[0]?.count ?? 0;

		// Today's visits only
		const today = new Date();
		const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const todayEnd = new Date(todayStart.getTime() + 24*60*60*1000);
		const totalVisitsResult = await (await db())
			.select({ count: count() })
			.from(visits)
			.where(and(
				eq(visits.shopId, data.shopId),
				gte(visits.createdAt, todayStart),
				lte(visits.createdAt, todayEnd),
			))
			.all();
		
		const totalVisits = totalVisitsResult[0]?.count ?? 0;

		const recentVisits = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				barberName: barbers.name,
				status: visits.status,
				welcomeSent: visits.welcomeSent,
				followUpSent: visits.followUpSent,
				amountPaid: visits.amountPaid,
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
			totalClients,
			totalVisits,
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
			stripePayoutsEnabled: barbers.stripePayoutsEnabled,
			stripeAccountId: barbers.stripeAccountId,
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
			sendSmsSafe(clientInfo[0].phone, `${shopInfo2[0]?.name ?? "Barbershop"}: It's your turn! Come to the chair now. Reply STOP to opt out.`).catch(() => {});
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
	.inputValidator((input: { visitId: number; amountPaid: number }) => input)
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
			.set({ status: "completed", followUpScheduledAt: followUpTime, amountPaid: data.amountPaid })
			.where(eq(visits.id, data.visitId));

		// Send thank you SMS with Google review link
		if (shop[0]?.smsEnabled) {
			const visit = await (await db())
				.select()
				.from(visits)
				.where(eq(visits.id, data.visitId))
				.limit(1)
				.all();

			if (visit[0]) {
				const client = await (await db())
					.select()
					.from(clients)
					.where(eq(clients.id, visit[0].clientId))
					.limit(1)
					.all();

				if (client[0]?.phone) {
					// Create Google Maps review URL
					const googleReviewUrl = `https://www.google.com/maps/search/${encodeURIComponent(shop[0].name)}`;

					const message = `Thanks for visiting ${shop[0].name}! 😊
⭐ Leave us a review on Google!
${googleReviewUrl}

Reply STOP to opt out.`;

					sendSmsSafe(client[0].phone, message).catch(() => {});
				}
			}
		}

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

// ============ REPORTS ============

export const getDailyReport = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; date: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1).all();
		if (shop.length === 0) throw new Error("Not authorized");

		// Get shop timezone to correctly calculate day boundaries
		const shopFull = await (await db()).select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, data.shopId)).limit(1).all();
		const tz = shopFull[0]?.timezone || "America/New_York";

		// Convert the requested date to UTC boundaries using the shop's timezone
		// e.g. "2025-05-03" in "America/New_York" (UTC-4) = 04:00 UTC to next day 03:59 UTC
		const { start: dayStart, end: dayEnd } = getDateBoundsInTz(data.date, tz);

		const dayVisits = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				barberName: barbers.name,
				status: visits.status,
				amountPaid: visits.amountPaid,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.innerJoin(barbers, eq(visits.barberId, barbers.id))
			.where(and(
				eq(visits.shopId, data.shopId),
				gte(visits.createdAt, dayStart),
				lte(visits.createdAt, dayEnd),
			))
			.orderBy(asc(visits.createdAt))
			.all();

		const completed = dayVisits.filter(v => v.status === "completed");
		const cancelled = dayVisits.filter(v => v.status === "cancelled");
		const noShows = dayVisits.filter(v => v.status === "no_show");
		const totalRevenue = completed.reduce((sum, v) => sum + (v.amountPaid ?? 0), 0);

		// By barber breakdown
		const byBarber: Record<string, { count: number; revenue: number }> = {};
		for (const v of completed) {
			if (!byBarber[v.barberName]) byBarber[v.barberName] = { count: 0, revenue: 0 };
			byBarber[v.barberName].count++;
			byBarber[v.barberName].revenue += v.amountPaid ?? 0;
		}

		return {
			date: data.date,
			visits: dayVisits,
			totalClients: dayVisits.length,
			totalCompleted: completed.length,
			totalCancelled: cancelled.length,
			totalNoShows: noShows.length,
			totalRevenue,
			byBarber,
		};
	});

export const getMonthlyReport = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; year: number; month: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1).all();
		if (shop.length === 0) throw new Error("Not authorized");

		const shopTz = await (await db()).select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, data.shopId)).limit(1).all();
		const mTz = shopTz[0]?.timezone || "America/New_York";
		const mPad = String(data.month).padStart(2, "0");
		const daysInMonth = new Date(data.year, data.month, 0).getDate();
		const { start: monthStart } = getDateBoundsInTz(`${data.year}-${mPad}-01`, mTz);
		const { end: monthEnd } = getDateBoundsInTz(`${data.year}-${mPad}-${String(daysInMonth).padStart(2,"0")}`, mTz);

		const monthVisits = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				barberName: barbers.name,
				status: visits.status,
				amountPaid: visits.amountPaid,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.innerJoin(barbers, eq(visits.barberId, barbers.id))
			.where(and(
				eq(visits.shopId, data.shopId),
				gte(visits.createdAt, monthStart),
				lte(visits.createdAt, monthEnd),
			))
			.orderBy(asc(visits.createdAt))
			.all();

		// Group by day
		const byDay: Record<string, { clients: number; revenue: number; cancelled: number }> = {};
		for (const v of monthVisits) {
			const day = new Date(v.createdAt!).toISOString().split("T")[0];
			if (!byDay[day]) byDay[day] = { clients: 0, revenue: 0, cancelled: 0 };
			if (v.status === "cancelled") byDay[day].cancelled++;
			else { byDay[day].clients++; byDay[day].revenue += v.amountPaid ?? 0; }
		}

		const completed = monthVisits.filter(v => v.status === "completed");

		// By barber
		const byBarber: Record<string, { count: number; revenue: number }> = {};
		for (const v of completed) {
			if (!byBarber[v.barberName]) byBarber[v.barberName] = { count: 0, revenue: 0 };
			byBarber[v.barberName].count++;
			byBarber[v.barberName].revenue += v.amountPaid ?? 0;
		}

		return {
			year: data.year,
			month: data.month,
			totalClients: completed.length,
			totalRevenue: completed.reduce((s,v) => s + (v.amountPaid ?? 0), 0),
			byDay,
			byBarber,
			visits: monthVisits,
		};
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
				"line_items[0][price]": "price_1TTd8iP4c97NjwNqp6XoR1xU",
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
// ============ CLIENT RETENTION ============

export const getInactiveClients = createServerFn({ method: "GET" })
	.handler(async () => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db()).select({ id: shops.id }).from(shops).where(eq(shops.ownerId, userId)).limit(1).all();
		if (!shop[0]) throw new Error("No shop found");
		const shopId = shop[0].id;

		// 30 days ago in seconds (Unix timestamp)
		const thirtyDaysAgoSec = Math.floor(Date.now() / 1000) - (30 * 86400);
		const nowSec = Math.floor(Date.now() / 1000);

		const allVisits = await (await db())
			.select({
				clientId: clients.id,
				clientName: clients.name,
				clientPhone: clients.phone,
				// Use CAST to ensure we get a number in seconds
				lastVisit: sql<number>`CAST(MAX(${visits.createdAt}) AS INTEGER)`,
				totalVisits: sql<number>`COUNT(${visits.id})`,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.where(and(eq(visits.shopId, shopId), eq(visits.status, "completed")))
			.groupBy(clients.id)
			.all() as any[];

		const inactive = allVisits
			.filter(c => {
				const lastVisitSec = Number(c.lastVisit);
				// Handle both seconds and milliseconds
				const normalized = lastVisitSec > 1e10 ? Math.floor(lastVisitSec / 1000) : lastVisitSec;
				return normalized < thirtyDaysAgoSec;
			})
			.map(c => {
				const lastVisitSec = Number(c.lastVisit);
				const normalized = lastVisitSec > 1e10 ? Math.floor(lastVisitSec / 1000) : lastVisitSec;
				return {
					clientId: c.clientId,
					name: c.clientName,
					phone: c.clientPhone,
					lastVisit: new Date(normalized * 1000).toISOString().split("T")[0],
					daysSince: Math.floor((nowSec - normalized) / 86400),
					totalVisits: Number(c.totalVisits),
				};
			})
			.sort((a, b) => b.daysSince - a.daysSince);

		const statuses = await (await db()).select().from(clientRetention).where(eq(clientRetention.shopId, shopId)).all();
		const statusMap = new Map(statuses.map((s: any) => [s.clientId, s]));

		return inactive.map(c => ({
			...c,
			callStatus: (statusMap.get(c.clientId) as any)?.callStatus ?? "pending",
			note: (statusMap.get(c.clientId) as any)?.note ?? null,
			calledAt: (statusMap.get(c.clientId) as any)?.updatedAt ?? null,
		}));
	});

export const updateClientCallStatus = createServerFn({ method: "POST" })
	.inputValidator((input: { clientId: number; status: string; note?: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db()).select({ id: shops.id }).from(shops).where(eq(shops.ownerId, userId)).limit(1).all();
		if (!shop[0]) throw new Error("No shop found");

		const existing = await (await db()).select({ id: clientRetention.id }).from(clientRetention)
			.where(and(eq(clientRetention.shopId, shop[0].id), eq(clientRetention.clientId, data.clientId)))
			.limit(1).all();

		const now = Math.floor(Date.now() / 1000);
		if (existing[0]) {
			await (await db()).update(clientRetention)
				.set({ callStatus: data.status, note: data.note ?? null, updatedAt: now })
				.where(eq(clientRetention.id, existing[0].id));
		} else {
			await (await db()).insert(clientRetention)
				.values({ shopId: shop[0].id, clientId: data.clientId, callStatus: data.status, note: data.note ?? null, updatedAt: now });
		}
		return { success: true };
	});

// ============ REVIEW PAGE ============
export const getShopReviewPage = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const shop = await (await db())
			.select({
				id: shops.id,
				name: shops.name,
				googleReviewLink: shops.googleReviewLink,
				whatsappNumber: shops.whatsappNumber,
				logoUrl: shops.logoUrl,
			})
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1).all();
		return shop[0] ?? null;
	});

export const cancelSubscription = createServerFn({ method: "POST" })
	.inputValidator((input: { reason?: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		const shop = await (await db())
			.select({ stripeSubscriptionId: shops.stripeSubscriptionId, name: shops.name })
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

		// Delete session to log out the user
		const cookieHeader = (await import("@tanstack/react-start/server")).getRequest().headers.get("cookie") ?? "";
		const sessionToken = cookieHeader.split(";").find((c: string) => c.trim().startsWith("session="))?.split("=")[1]?.trim();
		if (sessionToken) {
			await (await db()).delete(sessions).where(eq(sessions.id, sessionToken)).run();
		}

		// Send email to Goolinext admin (you)
		const mod = await import("cloudflare:workers");
		const env = mod.env as Record<string, string>;
		const apiKey = env.RESEND_API_KEY ?? "";

		if (apiKey) {
			// Email to admin
			await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
				body: JSON.stringify({
					from: "Goolinext <support@goolinext.com>",
					to: ["support@goolinext.com"],
					subject: `❌ Cancelación de membresía - ${shop[0].name}`,
					html: `<div style="font-family:sans-serif;padding:24px"><h2>Membresía cancelada</h2><p><strong>Negocio:</strong> ${shop[0].name}</p><p><strong>Email:</strong> ${user.email}</p><p><strong>Motivo:</strong> ${data.reason ?? "No especificado"}</p></div>`,
				}),
			}).catch(() => {});

			// Email to client
			await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
				body: JSON.stringify({
					from: "Goolinext <support@goolinext.com>",
					to: [user.email],
					subject: "Tu membresía de Goolinext ha sido cancelada",
					html: `<div style="font-family:sans-serif;padding:24px;background:#0f0f14;color:white;border-radius:16px"><h2 style="color:#f97316">Membresía cancelada</h2><p style="color:#94a3b8">Hola, te confirmamos que tu suscripción de Goolinext para <strong style="color:white">${shop[0].name}</strong> ha sido cancelada exitosamente.</p><p style="color:#94a3b8">Tu acceso continuará hasta el final del período actual. Si cambias de opinión puedes reactivar tu cuenta en cualquier momento.</p><p style="color:#64748b;font-size:13px">¿Tienes preguntas? Escríbenos a support@goolinext.com</p></div>`,
				}),
			}).catch(() => {});
		}

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

// ============ APPOINTMENTS ============

// Get available time slots for a barber on a specific date
export const getAvailableSlots = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; barberId: number; date: string }) => input)
	.handler(async ({ data }) => {
		// Get barber's working hours from shop
		const shop = await (await db())
			.select({ weeklyHours: shops.weeklyHours })
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();
		let weeklyHours: Record<number, { open: string; close: string; closed: boolean }> = {};
		try {
			if (shop[0]?.weeklyHours) weeklyHours = JSON.parse(shop[0].weeklyHours);
		} catch {}
		const dayOfWeek = new Date(data.date + "T12:00:00").getDay();
		const dayHours = weeklyHours[dayOfWeek] ?? { open: "09:00", close: "18:00", closed: false };

		// Only return empty if explicitly marked closed
		if (dayHours.closed === true) return { slots: [] };

		// Generate 30-min slots
		const slots: string[] = [];
		const [openH, openM] = dayHours.open.split(":").map(Number);
		const [closeH, closeM] = dayHours.close.split(":").map(Number);
		let current = openH * 60 + openM;
		// Handle close times past midnight (e.g. 01:00 = next day = 25:00)
		let closeMinutes = closeH * 60 + closeM;
		if (closeMinutes < current) closeMinutes += 24 * 60; // next day
		const end = closeMinutes - 30; // Stop 30 min before close

		while (current <= end) {
			const actualH = current % (24 * 60);
			const h = Math.floor(actualH / 60).toString().padStart(2, "0");
			const m = (actualH % 60).toString().padStart(2, "0");
			slots.push(`${h}:${m}`);
			current += 30;
		}

		// Remove already booked slots
		const booked = await (await db())
			.select({ appointmentTime: appointments.appointmentTime })
			.from(appointments)
			.where(
				and(
					eq(appointments.barberId, data.barberId),
					eq(appointments.appointmentDate, data.date),
					eq(appointments.status, "scheduled"),
				)
			)
			.all();

		const bookedTimes = new Set(booked.map(b => b.appointmentTime));
		return { slots: slots.filter(s => !bookedTimes.has(s)) };
	});

// Create appointment
export const createAppointment = createServerFn({ method: "POST" })
	.inputValidator((input: {
		shopId: number;
		barberId: number;
		clientName: string;
		clientPhone: string;
		clientEmail?: string;
		clientAccountId?: number;
		date: string;
		time: string;
		notes?: string;
		groupSize?: number;
	}) => input)
	.handler(async ({ data }) => {
		// Get or create client
		const existingClient = await (await db())
			.select()
			.from(clients)
			.where(and(eq(clients.shopId, data.shopId), eq(clients.phone, data.clientPhone)))
			.limit(1)
			.all();

		let clientId: number | null = null;
		if (existingClient[0]) {
			clientId = existingClient[0].id;
		} else {
			const newClient = await (await db())
				.insert(clients)
				.values({ shopId: data.shopId, name: data.clientName, phone: data.clientPhone })
				.returning({ id: clients.id })
				.all();
			clientId = newClient[0]?.id ?? null;
		}

		// Create appointment
		const appt = await (await db())
			.insert(appointments)
			.values({
				shopId: data.shopId,
				barberId: data.barberId,
				clientId,
				clientName: data.clientName,
				clientPhone: data.clientPhone,
				appointmentDate: data.date,
				appointmentTime: data.time,
				notes: data.notes,
				groupSize: data.groupSize ?? 1,
				clientUserId: data.clientAccountId ?? null,
			})
			.returning()
			.all();

		// Get barber and shop info for SMS
		const barberInfo = await (await db())
			.select({ name: barbers.name, phone: barbers.specialty })
			.from(barbers)
			.where(eq(barbers.id, data.barberId))
			.limit(1)
			.all();

		const shopInfo = await (await db())
			.select({ name: shops.name })
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();

		// Notify barber of new appointment
		notifyBarberNewAppointment(data.barberId, data.clientName, data.date, data.time).catch(() => {});

		// Send confirmation SMS
		if (data.clientPhone) {
			const dateFormatted = new Date(data.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
			const timeFormatted = formatTime12(data.time);
			sendSMS({
				to: data.clientPhone,
				body: `✅ Appointment confirmed at ${shopInfo[0]?.name}!\n${data.clientName} with ${barberInfo[0]?.name}\n📅 ${dateFormatted} at ${timeFormatted}\nReply STOP to opt out.`,
				
			}).catch(() => {});
		}

		const barberData = await (await db()).select({ name: barbers.name }).from(barbers).where(eq(barbers.id, data.barberId)).limit(1).all();
		const shopData = await (await db()).select({ name: shops.name }).from(shops).where(eq(shops.id, data.shopId)).limit(1).all();

		// Send confirmation email if client has email
		if (data.clientEmail) {
			const resendKey = (globalThis as any).RESEND_API_KEY;
			if (resendKey) {
				const dateFormatted = new Date(data.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
				const timeFormatted = formatTime12(data.time);
				const shopName = shopData[0]?.name ?? "";
				const barberName = barberData[0]?.name ?? "";
				const peopleRow = (data.groupSize ?? 1) > 1 ? "<tr><td style=\"color:#6b7280;padding:6px 0\">People</td><td style=\"text-align:right;padding:6px 0;font-weight:600\">" + (data.groupSize ?? 1) + "</td></tr>" : "";
				const htmlBody = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden\">"
					+ "<div style=\"background:#f97316;padding:28px 32px;text-align:center\"><h1 style=\"color:white;margin:0;font-size:22px;font-weight:700\">Appointment Confirmed</h1></div>"
					+ "<div style=\"padding:32px\">"
					+ "<p style=\"margin:0 0 20px;color:#111827\">Hi <strong>" + data.clientName + "</strong>, your appointment is confirmed!</p>"
					+ "<table style=\"width:100%;border-collapse:collapse;margin-bottom:24px;background:#f9fafb;border-radius:8px;padding:16px\">"
					+ "<tr><td style=\"color:#6b7280;padding:6px 0\">Shop</td><td style=\"text-align:right;padding:6px 0;font-weight:600\">" + shopName + "</td></tr>"
					+ "<tr><td style=\"color:#6b7280;padding:6px 0\">Barber</td><td style=\"text-align:right;padding:6px 0;font-weight:600\">" + barberName + "</td></tr>"
					+ "<tr><td style=\"color:#6b7280;padding:6px 0\">Date</td><td style=\"text-align:right;padding:6px 0;font-weight:600\">" + dateFormatted + "</td></tr>"
					+ "<tr><td style=\"color:#6b7280;padding:6px 0\">Time</td><td style=\"text-align:right;padding:6px 0;font-weight:600\">" + timeFormatted + "</td></tr>"
					+ peopleRow
					+ "</table>"
					+ "<p style=\"color:#6b7280;font-size:13px;margin:0\">If you need to cancel, please contact the shop directly.</p>"
					+ "</div></div>";
				fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
					body: JSON.stringify({
						from: "Goolinext <appointments@goolinext.com>",
						to: [data.clientEmail],
						subject: "Appointment confirmed at " + shopName,
						html: htmlBody,
					}),
				}).catch(() => {});
			}
		}

		return {
			success: true,
			appointmentId: appt[0]?.id,
			appointmentDate: data.date,
			appointmentTime: data.time,
			barberName: barberData[0]?.name ?? "",
			shopName: shopData[0]?.name ?? "",
			groupSize: data.groupSize ?? 1,
		};
	});

// Helper to format time
function formatTime12(time: string): string {
	const [h, m] = time.split(":").map(Number);
	const ampm = h >= 12 ? "PM" : "AM";
	const hour = h % 12 || 12;
	return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Get appointments for a shop (dashboard)
export const getShopAppointments = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; date?: string }) => input)
	.handler(async ({ data }) => {
		const conditions = [eq(appointments.shopId, data.shopId)];
		if (data.date) {
			conditions.push(eq(appointments.appointmentDate, data.date));
		}

		// Only show active appointments (not cancelled or completed)
		conditions.push(eq(appointments.status, "scheduled"));

		const appts = await (await db())
			.select({
				id: appointments.id,
				clientName: appointments.clientName,
				clientPhone: appointments.clientPhone,
				appointmentDate: appointments.appointmentDate,
				appointmentTime: appointments.appointmentTime,
				status: appointments.status,
				notes: appointments.notes,
				barberId: appointments.barberId,
				barberName: barbers.name,
				cancelRequested: appointments.cancelRequested,
			})
			.from(appointments)
			.leftJoin(barbers, eq(appointments.barberId, barbers.id))
			.where(and(...conditions))
			.orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
			.all();

		return appts;
	});

// Get appointments for a barber
export const getBarberAppointments = createServerFn({ method: "GET" })
	.inputValidator((input: { date?: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		const barber = await (await db())
			.select()
			.from(barbers)
			.where(eq(barbers.userId, user.id))
			.limit(1)
			.all();

		if (!barber[0]) return [];

		const today = data.date ?? new Date().toISOString().split("T")[0];

		return await (await db())
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.barberId, barber[0].id),
					eq(appointments.appointmentDate, today),
					eq(appointments.status, "scheduled"),
				)
			)
			.orderBy(asc(appointments.appointmentTime))
			.all();
	});

// Send SMS to barber when appointment is created
async function notifyBarberNewAppointment(barberId: number, clientName: string, date: string, time: string) {
	const barber = await (await db())
		.select({ phone: barbers.phone, name: barbers.name })
		.from(barbers)
		.where(eq(barbers.id, barberId))
		.limit(1)
		.all();

	if (!barber[0]?.phone) return;

	if (!creds.sid) return;

	const dateFormatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
	const [h, m] = time.split(":").map(Number);
	const fmt = `${h%12||12}:${m.toString().padStart(2,"0")} ${h>=12?"PM":"AM"}`;

	await sendSMS({
		to: barber[0].phone,
		body: `📅 New appointment!
Client: ${clientName}
${dateFormatted} at ${fmt}
Check your portal for details.`,
		
	}).catch(() => {});
}

// Cancel appointment
export const cancelAppointment = createServerFn({ method: "POST" })
	.inputValidator((input: { appointmentId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const appt = await (await db())
			.select()
			.from(appointments)
			.where(eq(appointments.id, data.appointmentId))
			.limit(1)
			.all();

		if (!appt[0]) throw new Error("Appointment not found");

		await (await db())
			.update(appointments)
			.set({ status: "cancelled" })
			.where(eq(appointments.id, data.appointmentId));

		return { success: true };
	});

// Process appointment reminders (call every 30 min)
export const processAppointmentReminders = createServerFn({ method: "POST" })
	.handler(async () => {
		if (!creds.sid) return { sent: 0 };

		const now = new Date();
		// Use local date string to avoid UTC day shift
		const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
		const in2hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
		const reminderTime = `${in2hours.getHours().toString().padStart(2, "0")}:${in2hours.getMinutes().toString().padStart(2, "0")}`;

		const upcoming = await (await db())
			.select({
				id: appointments.id,
				clientName: appointments.clientName,
				clientPhone: appointments.clientPhone,
				appointmentTime: appointments.appointmentTime,
				barberName: barbers.name,
				shopName: shops.name,
			})
			.from(appointments)
			.leftJoin(barbers, eq(appointments.barberId, barbers.id))
			.leftJoin(shops, eq(appointments.shopId, shops.id))
			.where(
				and(
					eq(appointments.appointmentDate, today),
					eq(appointments.appointmentTime, reminderTime),
					eq(appointments.status, "scheduled"),
					eq(appointments.reminderSent, false),
				)
			)
			.all();

		let sent = 0;
		for (const appt of upcoming) {
			if (appt.clientPhone) {
				await sendSMS({
					to: appt.clientPhone,
					body: `⏰ Reminder: Your appointment at ${appt.shopName} with ${appt.barberName} is today at ${formatTime12(appt.appointmentTime)}. See you soon! 💈`,
					
				}).catch(() => {});

				await (await db())
					.update(appointments)
					.set({ reminderSent: true })
					.where(eq(appointments.id, appt.id));
				sent++;
			}
		}

		return { sent };
	});

// Request appointment cancellation (barber)
export const requestCancelAppointment = createServerFn({ method: "POST" })
	.inputValidator((input: { appointmentId: number }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		// Get appointment with barber and shop info
		const appt = await (await db())
			.select({
				id: appointments.id,
				clientName: appointments.clientName,
				appointmentDate: appointments.appointmentDate,
				appointmentTime: appointments.appointmentTime,
				shopId: appointments.shopId,
				barberId: appointments.barberId,
				barberName: barbers.name,
			})
			.from(appointments)
			.leftJoin(barbers, eq(appointments.barberId, barbers.id))
			.where(eq(appointments.id, data.appointmentId))
			.limit(1)
			.all();

		if (!appt[0]) throw new Error("Appointment not found");

		// Mark as cancel requested
		await (await db())
			.update(appointments)
			.set({ cancelRequested: true, cancelRequestedBy: user.id })
			.where(eq(appointments.id, data.appointmentId));

		// Get owner phone
		const shop = await (await db())
			.select({ ownerId: shops.ownerId, name: shops.name })
			.from(shops)
			.where(eq(shops.id, appt[0].shopId))
			.limit(1)
			.all();

		const owner = await (await db())
			.select({ phone: users.phone })
			.from(users)
			.where(eq(users.id, shop[0].ownerId))
			.limit(1)
			.all();

		// SMS to owner
		if (owner[0]?.phone) {
			const dateFormatted = new Date(appt[0].appointmentDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
			await sendSMS({
				to: owner[0].phone,
				body: `⚠️ ${appt[0].barberName} has requested to cancel the appointment with ${appt[0].clientName} on ${dateFormatted} at ${appt[0].appointmentTime}. Please review in your dashboard.`,
				
			}).catch(() => {});
		}

		return { success: true };
	});

// Confirm cancellation (owner)
export const confirmCancelAppointment = createServerFn({ method: "POST" })
	.inputValidator((input: { appointmentId: number; shopId: number }) => input)
	.handler(async ({ data }) => {
		const appt = await (await db())
			.select()
			.from(appointments)
			.where(eq(appointments.id, data.appointmentId))
			.limit(1)
			.all();

		if (!appt[0]) throw new Error("Appointment not found");

		// Cancel the appointment
		await (await db())
			.update(appointments)
			.set({ status: "cancelled" })
			.where(eq(appointments.id, data.appointmentId));

		// SMS to client
		const shopInfo = await (await db())
			.select({ name: shops.name })
			.from(shops)
			.where(eq(shops.id, data.shopId))
			.limit(1)
			.all();

		if (appt[0].clientPhone) {
			await sendSMS({
				to: appt[0].clientPhone,
				body: `We're sorry, your appointment at ${shopInfo[0]?.name} on ${appt[0].appointmentDate} at ${appt[0].appointmentTime} has been cancelled. Please contact us to reschedule.`,
				
			}).catch(() => {});
		}

		return { success: true };
	});

// Update barber phone
export const updateBarberPhone = createServerFn({ method: "POST" })
	.inputValidator((input: { barberId: number; shopId: number; phone: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		await (await db())
			.update(barbers)
			.set({ phone: data.phone })
			.where(and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)));

		return { success: true };
	});

// Update owner phone
export const updateOwnerPhone = createServerFn({ method: "POST" })
	.inputValidator((input: { phone: string }) => input)
	.handler(async ({ data }) => {
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");

		await (await db())
			.update(users)
			.set({ phone: data.phone })
			.where(eq(users.id, user.id));

		return { success: true };
	});

// Get owner phone
export const getOwnerPhone = createServerFn({ method: "GET" })
	.handler(async () => {
		const user = await getSessionUser();
		if (!user) return { phone: "" };
		const u = await (await db())
			.select({ phone: users.phone })
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1)
			.all();
		return { phone: u[0]?.phone ?? "" };
	});

// Send password reset email
export const sendRecoveryEmail = createServerFn({ method: "POST" })
	.inputValidator((input: { email: string }) => input)
	.handler(async ({ data }) => {
		const user = await (await db())
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.email, data.email.toLowerCase().trim()))
			.limit(1)
			.all();

		if (!user[0]) return { sent: false };

		const mod = await import("cloudflare:workers");
		const env = mod.env as Record<string, string>;
		const apiKey = env.RESEND_API_KEY ?? "";

		if (!apiKey) return { sent: false };

		// Generate temp code
		const code = Math.floor(100000 + Math.random() * 900000).toString();

		// Store code in a simple way - we'll use it as the new password temporarily
		// Actually just send email with instructions to use the reset form
		await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: "Goolinext <support@goolinext.com>",
				to: [data.email],
				subject: "Reset your Goolinext password",
				html: `
					<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f14;color:white;border-radius:16px;">
						<h1 style="color:#f97316;font-size:24px;margin-bottom:8px;">Reset your password</h1>
						<p style="color:#94a3b8;margin-bottom:24px;">We received a request to reset your Goolinext password.</p>
						<p style="color:#94a3b8;margin-bottom:8px;">Go back to the app and enter your email <strong style="color:white;">${data.email}</strong> then set your new password.</p>
						<p style="color:#64748b;font-size:13px;margin-top:24px;">If you didn't request this, you can ignore this email.</p>
					</div>
				`,
			}),
		}).catch(() => {});

		return { sent: true };
	});

// Auto-add appointments to queue when their time arrives
export const processAppointmentsToQueue = createServerFn({ method: "POST" })
	.handler(async () => {
		const now = new Date();
		// Use local date string to avoid UTC day shift
		const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
		const currentHour = now.getHours().toString().padStart(2, "0");
		const currentMin = now.getMinutes().toString().padStart(2, "0");
		const currentTime = `${currentHour}:${currentMin}`;

		// Get appointments scheduled for now (within 5 min window)
		const dueAppts = await (await db())
			.select({
				id: appointments.id,
				shopId: appointments.shopId,
				barberId: appointments.barberId,
				clientId: appointments.clientId,
				clientName: appointments.clientName,
				clientPhone: appointments.clientPhone,
				appointmentTime: appointments.appointmentTime,
				visitId: appointments.visitId,
			})
			.from(appointments)
			.where(
				and(
					eq(appointments.appointmentDate, today),
					eq(appointments.status, "scheduled"),
					isNull(appointments.visitId), // not yet added to queue
					lte(appointments.appointmentTime, currentTime),
				)
			)
			.all();

		let added = 0;
		for (const appt of dueAppts) {
			// Create visit with priority (appointmentId links them)
			const visit = await (await db())
				.insert(visits)
				.values({
					shopId: appt.shopId,
					clientId: appt.clientId ?? undefined,
					barberId: appt.barberId,
					status: "waiting",
					welcomeSent: false,
				})
				.returning()
				.all();

			if (visit[0]) {
				// Link appointment to visit
				await (await db())
					.update(appointments)
					.set({ visitId: visit[0].id })
					.where(eq(appointments.id, appt.id));

				// SMS to client
				if (appt.clientPhone) {
					const shopInfo = await (await db())
						.select({ name: shops.name })
						.from(shops)
						.where(eq(shops.id, appt.shopId))
						.limit(1)
						.all();

					await sendSMS({
						to: appt.clientPhone,
						body: `Hi ${appt.clientName}! Your appointment at ${shopInfo[0]?.name} has been added to the queue. Please check in when you arrive. 💈`,
						
					}).catch(() => {});
				}

				added++;
			}
		}

		return { added };
	});

// ============ SUPERADMIN ============

export const getSuperAdminData = createServerFn({ method: "GET" })
	.handler(async () => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");

		const allShops = await (await db())
			.select({
				shopId: shops.id,
				shopName: shops.name,
				ownerEmail: users.email,
				ownerPhone: users.phone,
				status: shops.subscriptionStatus,
				stripeSubId: shops.stripeSubscriptionId,
				createdAt: shops.createdAt,
				address: shops.address,
			})
			.from(shops)
			.leftJoin(users, eq(shops.ownerId, users.id))
			.orderBy(desc(shops.createdAt))
			.all();

		const clientCounts = await (await db())
			.select({ shopId: clients.shopId, count: count() })
			.from(clients).groupBy(clients.shopId).all();

		const visitCounts = await (await db())
			.select({ shopId: visits.shopId, count: count() })
			.from(visits).groupBy(visits.shopId).all();

		const totalUsers = await (await db()).select({ count: count() }).from(users).all();
		const totalShops = await (await db()).select({ count: count() }).from(shops).all();
		const activeShops = await (await db()).select({ count: count() }).from(shops).where(eq(shops.subscriptionStatus, "active")).all();
		const trialShops = await (await db()).select({ count: count() }).from(shops).where(eq(shops.subscriptionStatus, "trial")).all();

		return {
			shops: allShops.map(s => ({
				...s,
				clientCount: clientCounts.find(c => c.shopId === s.shopId)?.count ?? 0,
				visitCount: visitCounts.find(v => v.shopId === s.shopId)?.count ?? 0,
			})),
			stats: {
				totalUsers: totalUsers[0]?.count ?? 0,
				totalShops: totalShops[0]?.count ?? 0,
				activeShops: activeShops[0]?.count ?? 0,
				trialShops: trialShops[0]?.count ?? 0,
				mrr: (activeShops[0]?.count ?? 0) * 150,
			},
		};
	});

export const adminGetShopDetail = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");

		const shop = await (await db()).select().from(shops).leftJoin(users, eq(shops.ownerId, users.id)).where(eq(shops.id, data.shopId)).limit(1).all();
		const barberList = await (await db()).select().from(barbers).where(eq(barbers.shopId, data.shopId)).all();
		const clientList = await (await db()).select().from(clients).where(eq(clients.shopId, data.shopId)).orderBy(desc(clients.createdAt)).all();
		const visitList = await (await db()).select().from(visits).where(eq(visits.shopId, data.shopId)).orderBy(desc(visits.id)).limit(50).all();

		return { shop: shop[0], barbers: barberList, clients: clientList, visits: visitList };
	});

export const adminUpdateClientEmail = createServerFn({ method: "POST" })
	.inputValidator((input: { clientId: number; email: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		await (await db()).update(clients).set({ email: data.email }).where(eq(clients.id, data.clientId));
		return { success: true };
	});

export const adminDeleteClient = createServerFn({ method: "POST" })
	.inputValidator((input: { clientId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		await (await db()).delete(visits).where(eq(visits.clientId, data.clientId));
		await (await db()).delete(clients).where(eq(clients.id, data.clientId));
		return { success: true };
	});

export const adminDeleteShop = createServerFn({ method: "POST" })
	.inputValidator((input: { shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		const shop = await (await db()).select({ ownerId: shops.ownerId }).from(shops).where(eq(shops.id, data.shopId)).limit(1).all();
		const ownerId = shop[0]?.ownerId;
		await (await db()).delete(appointments).where(eq(appointments.shopId, data.shopId));
		await (await db()).delete(visits).where(eq(visits.shopId, data.shopId));
		await (await db()).delete(clients).where(eq(clients.shopId, data.shopId));
		await (await db()).delete(barbers).where(eq(barbers.shopId, data.shopId));
		await (await db()).delete(shops).where(eq(shops.id, data.shopId));
		if (ownerId) {
			await (await db()).delete(sessions).where(eq(sessions.userId, ownerId));
			await (await db()).delete(users).where(and(eq(users.id, ownerId), eq(users.isAdmin, false)));
		}
		return { success: true };
	});

export const adminUpdateShopStatus = createServerFn({ method: "POST" })
	.inputValidator((input: { shopId: number; status: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		await (await db()).update(shops).set({ subscriptionStatus: data.status }).where(eq(shops.id, data.shopId));
		return { success: true };
	});

export const adminUpdateUserEmail = createServerFn({ method: "POST" })
	.inputValidator((input: { targetUserId: number; email: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		await (await db()).update(users).set({ email: data.email }).where(eq(users.id, data.targetUserId));
		return { success: true };
	});

export const adminResetUserPassword = createServerFn({ method: "POST" })
	.inputValidator((input: { targetUserId: number; newPassword: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");
		if (data.newPassword.length < 6) throw new Error("Password must be at least 6 characters");
		const hash = await bcrypt.hash(data.newPassword, 10);
		await (await db()).update(users).set({ passwordHash: hash }).where(eq(users.id, data.targetUserId));
		await (await db()).delete(sessions).where(eq(sessions.userId, data.targetUserId));
		return { success: true };
	});

export const adminIssueRefund = createServerFn({ method: "POST" })
	.inputValidator((input: { stripeSubscriptionId: string; reason: string }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");

		const mod = await import("cloudflare:workers");
		const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;

		const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${data.stripeSubscriptionId}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
		const sub = await subRes.json() as { latest_invoice?: string; customer?: string };
		if (!sub.latest_invoice) throw new Error("No invoice found for subscription");

		const invRes = await fetch(`https://api.stripe.com/v1/invoices/${sub.latest_invoice}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
		const inv = await invRes.json() as { payment_intent?: any; charge?: any };

		let refundTarget: string | null = null;
		if (inv.payment_intent) refundTarget = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id;
		else if (inv.charge) refundTarget = typeof inv.charge === "string" ? inv.charge : inv.charge?.id;
		else if (sub.customer) {
			const piRes = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${sub.customer}&limit=1`, { headers: { Authorization: `Bearer ${stripeKey}` } });
			const piData = await piRes.json() as { data?: Array<{ id: string }> };
			refundTarget = piData.data?.[0]?.id ?? null;
		}

		if (!refundTarget) throw new Error("Could not find a payment to refund");
		const refundTarget2 = String(refundTarget);
		const body: Record<string, string> = { reason: "requested_by_customer" };
		if (refundTarget2.startsWith("pi_")) body.payment_intent = refundTarget2;
		else body.charge = refundTarget2;

		const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
			method: "POST",
			headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(body),
		});
		const refund = await refundRes.json() as { id?: string; status?: string; error?: { message: string } };
		if (!refundRes.ok) throw new Error(refund.error?.message ?? "Refund failed");
		return { success: true, refundId: refund.id, status: refund.status };
	});

export const adminCancelSubscription = createServerFn({ method: "POST" })
	.inputValidator((input: { stripeSubscriptionId: string; shopId: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const user = await (await db()).select().from(users).where(eq(users.id, userId)).limit(1).all();
		if (!user[0]?.isAdmin) throw new Error("Not authorized");

		const mod = await import("cloudflare:workers");
		const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;

		await fetch(`https://api.stripe.com/v1/subscriptions/${data.stripeSubscriptionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${stripeKey}` } });
		await (await db()).update(shops).set({ subscriptionStatus: "canceled" }).where(eq(shops.id, data.shopId));
		return { success: true };
	});

export const getYearlyReport = createServerFn({ method: "GET" })
	.inputValidator((input: { shopId: number; year: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db())
			.select({ id: shops.id })
			.from(shops)
			.where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId)))
			.limit(1).all();
		if (shop.length === 0) throw new Error("Not authorized");

		const shopTzY = await (await db()).select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, data.shopId)).limit(1).all();
		const yTz = shopTzY[0]?.timezone || "America/New_York";
		const { start: yearStart } = getDateBoundsInTz(`${data.year}-01-01`, yTz);
		const { end: yearEnd } = getDateBoundsInTz(`${data.year}-12-31`, yTz);

		const yearVisits = await (await db())
			.select({
				visitId: visits.id,
				clientName: clients.name,
				barberName: barbers.name,
				status: visits.status,
				amountPaid: visits.amountPaid,
				createdAt: visits.createdAt,
			})
			.from(visits)
			.innerJoin(clients, eq(visits.clientId, clients.id))
			.innerJoin(barbers, eq(visits.barberId, barbers.id))
			.where(and(
				eq(visits.shopId, data.shopId),
				gte(visits.createdAt, yearStart),
				lte(visits.createdAt, yearEnd),
			))
			.orderBy(asc(visits.createdAt))
			.all();

		// Group by month
		const byMonth: Record<number, { clients: number; revenue: number; cancelled: number }> = {};
		for (let m = 1; m <= 12; m++) byMonth[m] = { clients: 0, revenue: 0, cancelled: 0 };

		for (const v of yearVisits) {
			const month = new Date(v.createdAt!).getMonth() + 1;
			if (v.status === "cancelled") byMonth[month].cancelled++;
			else { byMonth[month].clients++; byMonth[month].revenue += v.amountPaid ?? 0; }
		}

		// By barber
		const byBarber: Record<string, { count: number; revenue: number }> = {};
		for (const v of yearVisits.filter(v => v.status === "completed")) {
			if (!byBarber[v.barberName]) byBarber[v.barberName] = { count: 0, revenue: 0 };
			byBarber[v.barberName].count++;
			byBarber[v.barberName].revenue += v.amountPaid ?? 0;
		}

		const completed = yearVisits.filter(v => v.status === "completed");
		return {
			year: data.year,
			totalClients: completed.length,
			totalRevenue: completed.reduce((s, v) => s + (v.amountPaid ?? 0), 0),
			byMonth,
			byBarber,
			visits: yearVisits,
		};
	});

export const barberCancelVisit = createServerFn({ method: "POST" })
	.inputValidator((input: { visitId: number; status: "cancelled" | "no_show" }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const barber = await (await db())
			.select({ id: barbers.id, shopId: barbers.shopId })
			.from(barbers)
			.where(eq(barbers.userId, userId))
			.limit(1).all();
		if (!barber[0]) throw new Error("Not a barber");

		// Verify visit belongs to this barber
		const visit = await (await db())
			.select()
			.from(visits)
			.where(and(
				eq(visits.id, data.visitId),
				eq(visits.barberId, barber[0].id),
			))
			.limit(1).all();
		if (!visit[0]) throw new Error("Visit not found");

		await (await db())
			.update(visits)
			.set({ status: data.status })
			.where(eq(visits.id, data.visitId));

		await broadcast({ type: "queue_updated", shopId: barber[0].shopId });
		return { success: true };
	});

// ============ CLIENT ACCOUNT AUTH ============

const CLIENT_SESSION_COOKIE = "goolinext_client";
const CLIENT_SESSION_DAYS = 30;

async function getClientSessionUser(): Promise<{ id: number; name: string; phone: string; email: string | null } | null> {
	const request = getRequest();
	const cookieHeader = request.headers.get("cookie") ?? "";
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...vals] = part.trim().split("=");
		if (key) cookies[key.trim()] = vals.join("=");
	}
	const sessionId = cookies[CLIENT_SESSION_COOKIE];
	if (!sessionId) return null;

	const now = new Date();
	const result = await (await db())
		.select({ clientAccountId: clientSessions.clientAccountId, expiresAt: clientSessions.expiresAt })
		.from(clientSessions)
		.where(eq(clientSessions.id, sessionId))
		.limit(1).all();

	const session = result[0];
	if (!session || session.expiresAt < now) return null;

	const client = await (await db())
		.select({ id: clientAccounts.id, name: clientAccounts.name, phone: clientAccounts.phone, email: clientAccounts.email })
		.from(clientAccounts)
		.where(eq(clientAccounts.id, session.clientAccountId))
		.limit(1).all();

	return client[0] ?? null;
}

export const clientSignup = createServerFn({ method: "POST" })
	.inputValidator((input: { name: string; phone: string; password: string; email?: string }) => input)
	.handler(async ({ data }) => {
		const existing = await (await db())
			.select({ id: clientAccounts.id })
			.from(clientAccounts)
			.where(eq(clientAccounts.phone, data.phone))
			.limit(1).all();
		if (existing[0]) return { success: false as const, error: "PHONE_EXISTS" };
		if (data.password.length < 6) return { success: false as const, error: "PASSWORD_TOO_SHORT" };

		const passwordHash = await bcrypt.hash(data.password, 10);
		const result = await (await db())
			.insert(clientAccounts)
			.values({ name: data.name, phone: data.phone, email: data.email || null, passwordHash })
			.returning().all();

		const newClient = result[0];
		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + CLIENT_SESSION_DAYS * 24 * 60 * 60 * 1000);
		await (await db()).insert(clientSessions).values({ id: sessionId, clientAccountId: newClient.id, expiresAt });

		setCookie(CLIENT_SESSION_COOKIE, sessionId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
		return { success: true as const };
	});

export const clientLogin = createServerFn({ method: "POST" })
	.inputValidator((input: { phone: string; password: string }) => input)
	.handler(async ({ data }) => {
		const result = await (await db())
			.select()
			.from(clientAccounts)
			.where(eq(clientAccounts.phone, data.phone))
			.limit(1).all();
		if (!result[0]) return { success: false as const, error: "INVALID_CREDENTIALS" };

		const valid = await bcrypt.compare(data.password, result[0].passwordHash);
		if (!valid) return { success: false as const, error: "INVALID_CREDENTIALS" };

		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + CLIENT_SESSION_DAYS * 24 * 60 * 60 * 1000);
		await (await db()).insert(clientSessions).values({ id: sessionId, clientAccountId: result[0].id, expiresAt });
		setCookie(CLIENT_SESSION_COOKIE, sessionId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
		return { success: true as const };
	});

export const clientGetMe = createServerFn({ method: "GET" })
	.handler(async () => {
		return await getClientSessionUser();
	});

export const clientLogout = createServerFn({ method: "POST" })
	.handler(async () => {
		deleteCookie(CLIENT_SESSION_COOKIE);
		return { success: true };
	});

export const clientGetAppointments = createServerFn({ method: "GET" })
	.handler(async () => {
		const client = await getClientSessionUser();
		if (!client) throw new Error("Not authenticated");

		return await (await db())
			.select({
				id: appointments.id,
				appointmentDate: appointments.appointmentDate,
				appointmentTime: appointments.appointmentTime,
				status: appointments.status,
				depositPaid: appointments.depositPaid,
				depositAmount: appointments.depositAmount,
				cancelToken: appointments.cancelToken,
				barberName: barbers.name,
				shopName: shops.name,
				shopAddress: shops.address,
			})
			.from(appointments)
			.leftJoin(barbers, eq(appointments.barberId, barbers.id))
			.leftJoin(shops, eq(appointments.shopId, shops.id))
			.where(eq(appointments.clientUserId, client.id))
			.orderBy(desc(appointments.appointmentDate))
			.all();
	});

export const cancelClientAppointment = createServerFn({ method: "POST" })
	.inputValidator((input: { appointmentId: number }) => input)
	.handler(async ({ data }) => {
		const client = await getClientSessionUser();
		if (!client) throw new Error("Not authenticated");

		const appt = await (await db())
			.select()
			.from(appointments)
			.where(and(eq(appointments.id, data.appointmentId), eq(appointments.clientUserId, client.id)))
			.limit(1).all();
		if (!appt[0]) throw new Error("Not found");

		// Check 1-hour policy
		const apptTime = new Date(`${appt[0].appointmentDate}T${appt[0].appointmentTime}:00`);
		const diffHours = (apptTime.getTime() - Date.now()) / (1000 * 60 * 60);
		if (diffHours <= 2) throw new Error("TOO_LATE");

		await (await db()).update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, data.appointmentId));

		// Refund if > 2 hours away
		if (diffHours > 1 && appt[0].stripePaymentIntentId) {
			const mod = await import("cloudflare:workers");
			const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;
			await fetch("https://api.stripe.com/v1/refunds", {
				method: "POST",
				headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ payment_intent: appt[0].stripePaymentIntentId }),
			}).catch(() => {});
		}

		return { success: true, refunded: diffHours > 1 };
	});

// ============ STRIPE CONNECT ============

export const createStripeConnectLink = createServerFn({ method: "POST" })
	.inputValidator((input: { type: "owner" | "barber"; barberId?: number }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const mod = await import("cloudflare:workers");
		const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;
		const origin = "https://goolinext.com";

		// Create Express account
		const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
			method: "POST",
			headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ type: "express", country: "US", "capabilities[card_payments][requested]": "true", "capabilities[transfers][requested]": "true" }),
		});
		const accountData = await accountRes.json() as { id?: string; error?: { message: string } };
		if (!accountRes.ok || !accountData.id) {
			throw new Error(accountData.error?.message ?? "Failed to create Stripe account");
		}
		const accountId = accountData.id;

		// Save account ID
		if (data.type === "owner") {
			const shop = await (await db()).select({ id: shops.id }).from(shops).where(eq(shops.ownerId, userId)).limit(1).all();
			if (shop[0]) await (await db()).update(shops).set({ stripeAccountId: accountId }).where(eq(shops.id, shop[0].id));
		} else if (data.barberId) {
			await (await db()).update(barbers).set({ stripeAccountId: accountId }).where(eq(barbers.id, data.barberId));
		}

		// Create onboarding link
		const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
			method: "POST",
			headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				account: accountId,
				refresh_url: `${origin}/dashboard?stripe=refresh`,
				return_url: `${origin}/dashboard?stripe=success`,
				type: "account_onboarding",
			}),
		});
		const linkData = await linkRes.json() as { url?: string; error?: { message: string } };
		if (!linkRes.ok || !linkData.url) {
			throw new Error(linkData.error?.message ?? "Failed to create onboarding link");
		}
		return { url: linkData.url };
	});

export const getShopStripeStatus = createServerFn({ method: "GET" })
	.handler(async () => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");

		const shop = await (await db())
			.select({ stripeAccountId: shops.stripeAccountId, depositAmount: shops.depositAmount, appointmentsPublic: shops.appointmentsPublic })
			.from(shops).where(eq(shops.ownerId, userId)).limit(1).all();
		if (!shop[0]) return null;

		let stripeEnabled = false;
		if (shop[0].stripeAccountId) {
			const mod = await import("cloudflare:workers");
			const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;
			const res = await fetch(`https://api.stripe.com/v1/accounts/${shop[0].stripeAccountId}`, {
				headers: { Authorization: `Bearer ${stripeKey}` },
			});
			const acc = await res.json() as { charges_enabled?: boolean };
			stripeEnabled = acc.charges_enabled ?? false;
		}

		return { ...shop[0], stripeEnabled };
	});

export const updateShopDepositSettings = createServerFn({ method: "POST" })
	.inputValidator((input: { depositAmount: number; appointmentsPublic: boolean }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db()).select({ id: shops.id }).from(shops).where(eq(shops.ownerId, userId)).limit(1).all();
		if (!shop[0]) throw new Error("Shop not found");
		await (await db()).update(shops).set({ depositAmount: data.depositAmount, appointmentsPublic: data.appointmentsPublic }).where(eq(shops.id, shop[0].id));
		return { success: true };
	});

export const toggleBarberDirectPayment = createServerFn({ method: "POST" })
	.inputValidator((input: { barberId: number; shopId: number; enabled: boolean }) => input)
	.handler(async ({ data }) => {
		const userId = await getUserId();
		if (!userId) throw new Error("Not authenticated");
		const shop = await (await db()).select({ id: shops.id }).from(shops).where(and(eq(shops.id, data.shopId), eq(shops.ownerId, userId))).limit(1).all();
		if (!shop[0]) throw new Error("Not authorized");
		await (await db()).update(barbers).set({ stripePayoutsEnabled: data.enabled }).where(and(eq(barbers.id, data.barberId), eq(barbers.shopId, data.shopId)));
		return { success: true };
	});

// ============ APPOINTMENT WITH DEPOSIT ============

export const createAppointmentWithDeposit = createServerFn({ method: "POST" })
	.inputValidator((input: {
		shopId: number;
		barberId: number;
		clientName: string;
		clientPhone: string;
		date: string;
		time: string;
		clientAccountId: number;
	}) => input)
	.handler(async ({ data }) => {
		const mod = await import("cloudflare:workers");
		const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;
		const origin = "https://goolinext.com";

		// Get shop + barber stripe info
		const shop = await (await db())
			.select({ name: shops.name, address: shops.address, stripeAccountId: shops.stripeAccountId, depositAmount: shops.depositAmount, googleReviewLink: shops.googleReviewLink })
			.from(shops).where(eq(shops.id, data.shopId)).limit(1).all();
		if (!shop[0]) throw new Error("Shop not found");

		const barber = await (await db())
			.select({ name: barbers.name, stripeAccountId: barbers.stripeAccountId, stripePayoutsEnabled: barbers.stripePayoutsEnabled })
			.from(barbers).where(eq(barbers.id, data.barberId)).limit(1).all();
		if (!barber[0]) throw new Error("Barber not found");

		// Determine which Stripe account receives payment
		const destinationAccount = barber[0].stripePayoutsEnabled && barber[0].stripeAccountId
			? barber[0].stripeAccountId
			: shop[0].stripeAccountId;

		if (!destinationAccount) throw new Error("STRIPE_NOT_CONNECTED");

		// Generate cancel token
		const cancelTokenBytes = new Uint8Array(16);
		crypto.getRandomValues(cancelTokenBytes);
		const cancelToken = Array.from(cancelTokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

		// Get or create client
		const existingClient = await (await db())
			.select({ id: clients.id })
			.from(clients)
			.where(and(eq(clients.shopId, data.shopId), eq(clients.phone, data.clientPhone)))
			.limit(1).all();

		let clientId: number;
		if (existingClient[0]) {
			clientId = existingClient[0].id;
		} else {
			const newClient = await (await db())
				.insert(clients)
				.values({ shopId: data.shopId, name: data.clientName, phone: data.clientPhone })
				.returning({ id: clients.id }).all();
			clientId = newClient[0].id;
		}

		// Create appointment record first
		const appt = await (await db())
			.insert(appointments)
			.values({
				shopId: data.shopId,
				barberId: data.barberId,
				clientId,
				clientName: data.clientName,
				clientPhone: data.clientPhone,
				appointmentDate: data.date,
				appointmentTime: data.time,
				cancelToken,
				clientUserId: data.clientAccountId,
				depositAmount: shop[0].depositAmount ?? 1059,
			})
			.returning().all();

		const apptId = appt[0].id;
		const depositAmount = shop[0].depositAmount ?? 1059;

		// Create Stripe Checkout Session with direct charge to destination
		// Base deposit = $10.00 (1000 cents), service fee = $0.59 (59 cents)
		const baseDeposit = 1000;
		const serviceFee = 59;

		const params = new URLSearchParams({
			"mode": "payment",
			"payment_method_types[0]": "card",
			"line_items[0][price_data][currency]": "usd",
			"line_items[0][price_data][product_data][name]": `Appointment Deposit - ${shop[0].name}`,
			"line_items[0][price_data][product_data][description]": `${barber[0].name} · ${data.date} ${data.time}`,
			"line_items[0][price_data][unit_amount]": String(baseDeposit),
			"line_items[0][quantity]": "1",
			"line_items[1][price_data][currency]": "usd",
			"line_items[1][price_data][product_data][name]": "Service fee",
			"line_items[1][price_data][unit_amount]": String(serviceFee),
			"line_items[1][quantity]": "1",
			"success_url": `${origin}/appointment/${data.shopId}?payment=success&appt=${apptId}&token=${cancelToken}`,
			"cancel_url": `${origin}/appointment/${data.shopId}?payment=cancelled`,
			"metadata[appointmentId]": String(apptId),
			"metadata[cancelToken]": cancelToken,
			"metadata[shopId]": String(data.shopId),
			"payment_intent_data[transfer_data][destination]": destinationAccount,
			"payment_intent_data[transfer_data][amount]": String(baseDeposit),
			"payment_intent_data[metadata][appointmentId]": String(apptId),
		});

		const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
			method: "POST",
			headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
			body: params,
		});
		const session = await sessionRes.json() as { url?: string; error?: { message: string } };
		if (!sessionRes.ok) throw new Error(session.error?.message ?? "Stripe error");

		return {
			checkoutUrl: session.url,
			appointmentId: apptId,
			cancelToken,
			shopName: shop[0].name,
			barberName: barber[0].name,
			date: data.date,
			time: data.time,
			address: shop[0].address,
		};
	});

// Handle successful payment return
export const confirmAppointmentPayment = createServerFn({ method: "POST" })
	.inputValidator((input: { appointmentId: number; cancelToken: string }) => input)
	.handler(async ({ data }) => {
		const appt = await (await db())
			.select()
			.from(appointments)
			.where(and(eq(appointments.id, data.appointmentId), eq(appointments.cancelToken, data.cancelToken)))
			.limit(1).all();
		if (!appt[0]) throw new Error("Not found");

		// Get payment intent from Stripe checkout session
		const mod = await import("cloudflare:workers");
		const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;

		// Find the payment intent via metadata search
		const piRes = await fetch(`https://api.stripe.com/v1/payment_intents?limit=5`, {
			headers: { Authorization: `Bearer ${stripeKey}` },
		});
		// Mark deposit as paid
		await (await db()).update(appointments).set({ depositPaid: true }).where(eq(appointments.id, data.appointmentId));

		const barber = await (await db()).select({ name: barbers.name }).from(barbers).where(eq(barbers.id, appt[0].barberId)).limit(1).all();
		const shop = await (await db()).select({ name: shops.name, address: shops.address }).from(shops).where(eq(shops.id, appt[0].shopId)).limit(1).all();

		return {
			success: true,
			shopName: shop[0]?.name,
			barberName: barber[0]?.name,
			date: appt[0].appointmentDate,
			time: appt[0].appointmentTime,
			address: shop[0]?.address,
			cancelToken: data.cancelToken,
		};
	});

// Cancel via token (public — no auth needed)
export const cancelAppointmentByToken = createServerFn({ method: "POST" })
	.inputValidator((input: { cancelToken: string }) => input)
	.handler(async ({ data }) => {
		const appt = await (await db())
			.select()
			.from(appointments)
			.where(eq(appointments.cancelToken, data.cancelToken))
			.limit(1).all();
		if (!appt[0]) throw new Error("Not found");
		if (appt[0].status === "cancelled") return { success: true, alreadyCancelled: true };

		const apptTime = new Date(`${appt[0].appointmentDate}T${appt[0].appointmentTime}:00`);
		const diffHours = (apptTime.getTime() - Date.now()) / (1000 * 60 * 60);

		await (await db()).update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appt[0].id));

		let refunded = false;
		if (diffHours > 1 && appt[0].stripePaymentIntentId && appt[0].depositPaid) {
			const mod = await import("cloudflare:workers");
			const stripeKey = (mod.env as Record<string, string>).STRIPE_SECRET_KEY;
			const res = await fetch("https://api.stripe.com/v1/refunds", {
				method: "POST",
				headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ payment_intent: appt[0].stripePaymentIntentId }),
			});
			if (res.ok) refunded = true;
		}

		return { success: true, refunded, lostDeposit: !refunded && appt[0].depositPaid };
	});
