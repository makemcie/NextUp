import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" style={{ background: "#070709" }}>
			<head>
				<HeadContent />
			</head>
			<body style={{ background: "#070709", margin: 0, padding: 0, overflowX: "hidden" }}>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
			{ name: "theme-color", content: "#070709" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
			{ name: "mobile-web-app-capable", content: "yes" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
});

function RootComponent() {
	return (
		<TanStackQueryProvider>
			<Outlet />
		</TanStackQueryProvider>
	);
}
