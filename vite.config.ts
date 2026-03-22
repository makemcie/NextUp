import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		host: "0.0.0.0",
		port: 7001,
		allowedHosts: [
			"agent.api.whop.com",
			"localhost",
			"127.0.0.1",
			".whop.com",
			".whop.dev",
			".whop.page",
		],
		proxy: {
			"/_ws": {
				target: "ws://localhost:8799",
				ws: true,
				rewriteWsOrigin: true,
				rewrite: (path) => path.replace("/_ws", "/ws"),
			},
		},
	},
	environments: {
		ssr: {
			resolve: {
				noExternal: true,
			},
			build: {
				rollupOptions: {
					output: {
						inlineDynamicImports: true,
					},
				},
			},
		},
	},
	plugins: [
		cloudflare({
			viteEnvironment: { name: "ssr" },
			config: {
				dev: {
					host: "0.0.0.0",
					port: 7001,
					ip: "0.0.0.0",
					inspector_ip: undefined,
					inspector_port: undefined,
					local_protocol: "http",
					upstream_protocol: "http",
					container_engine: undefined,
					enable_containers: false,
					generate_types: false,
				},
			},
		}),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});
