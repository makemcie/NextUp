/**
 * Database Client - Cloudflare D1
 */

import { drizzle } from "drizzle-orm/d1";
import { drizzle as drizzleDev } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export type DrizzleD1Client = ReturnType<typeof drizzle>;
export type DrizzleDevClient = ReturnType<typeof drizzleDev>;

export async function getProductionDb(): Promise<DrizzleD1Client> {
	const mod = await import("cloudflare:workers");
	const d1 = (mod.env as { DB: D1Database }).DB;
	if (!d1) throw new Error("D1 binding 'DB' not found");
	return drizzle(d1, { schema });
}

function serializeParams(params: unknown[]): unknown[] {
	return params.map((p) => {
		if (p instanceof Uint8Array || p instanceof ArrayBuffer) {
			const bytes = p instanceof Uint8Array ? p : new Uint8Array(p);
			return { __type: "blob", data: Array.from(bytes) };
		}
		return p;
	});
}

export function createDevClient(): DrizzleDevClient {
	return drizzleDev(
		async (sql, params, method) => {
			const res = await fetch("http://localhost:8799/local-db", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sql,
					params: serializeParams(params as unknown[]),
					method,
				}),
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				throw new Error(body.error ?? `Local DB request failed: ${res.status}`);
			}
			return (await res.json()) as { rows: unknown[][] };
		},
		{ schema },
	);
}
