declare module "cloudflare:workers" {
	interface DbBinding {
		execAll(sql: string, params: unknown[]): Promise<unknown[]>;
		execOne(sql: string, params: unknown[]): Promise<unknown | null>;
		execRun(
			sql: string,
			params: unknown[],
		): Promise<{ rowsWritten: number; rowsRead: number }>;
		broadcast(payload: string): Promise<void>;
	}

	const env: Record<string, unknown> & {
		DB: DbBinding;
	};
}
