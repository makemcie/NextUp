/**
 * Database entry point.
 */

import { createDevClient, getProductionDb } from "./client";

export * from "./schema";

let _devDb: ReturnType<typeof createDevClient> | null = null;

export async function db() {
	if (import.meta.env.DEV) {
		if (!_devDb) _devDb = createDevClient();
		return _devDb;
	}
	// Production: always get fresh D1 reference
	return getProductionDb();
}

export async function broadcast(_message: unknown): Promise<void> {
	// No-op in this deployment
}
