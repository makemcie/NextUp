import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/stripe-webhook")({
	POST: async ({ request }) => {
		try {
			const body = await request.text();
			const signature = request.headers.get("stripe-signature") ?? "";

			const mod = await import("cloudflare:workers");
			const env = mod.env as Record<string, string>;
			const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";

			// Verify webhook signature
			const parts = signature.split(",");
			const timestamp = parts.find((p: string) => p.startsWith("t="))?.split("=")[1] ?? "";
			const sigHash = parts.find((p: string) => p.startsWith("v1="))?.split("=")[1] ?? "";

			const signedPayload = `${timestamp}.${body}`;
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				"raw",
				encoder.encode(webhookSecret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"]
			);
			const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
			const expectedSig = Array.from(new Uint8Array(sig)).map((b: number) => b.toString(16).padStart(2, "0")).join("");

			if (expectedSig !== sigHash) {
				return new Response("Invalid signature", { status: 400 });
			}

			const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
			const { drizzle } = await import("drizzle-orm/d1");
			const { shops } = await import("../../db/schema");
			const { eq } = await import("drizzle-orm");
			const db = drizzle(env.DB as D1Database);

			if (event.type === "checkout.session.completed") {
				const session = event.data.object;
				const shopId = (session.metadata as Record<string, string>)?.shopId;
				const customerId = session.customer as string;
				const subscriptionId = session.subscription as string;
				if (shopId) {
					const endsAt = new Date();
					endsAt.setMonth(endsAt.getMonth() + 1);
					await db.update(shops).set({
						stripeCustomerId: customerId,
						stripeSubscriptionId: subscriptionId,
						subscriptionStatus: "active",
						subscriptionEndsAt: endsAt,
					}).where(eq(shops.id, Number(shopId)));
				}
			}

			if (event.type === "customer.subscription.deleted") {
				const sub = event.data.object;
				await db.update(shops).set({ subscriptionStatus: "canceled" })
					.where(eq(shops.stripeSubscriptionId, sub.id as string));
			}

			if (event.type === "invoice.payment_failed") {
				const inv = event.data.object;
				await db.update(shops).set({ subscriptionStatus: "past_due" })
					.where(eq(shops.stripeSubscriptionId, inv.subscription as string));
			}

			return new Response("OK", { status: 200 });
		} catch {
			return new Response("Error", { status: 500 });
		}
	},
});
