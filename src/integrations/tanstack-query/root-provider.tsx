import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let context: { queryClient: QueryClient } | undefined;

export function getContext() {
	if (context) return context;
	context = { queryClient: new QueryClient() };
	return context;
}

export default function TanStackQueryProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { queryClient } = getContext();
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
