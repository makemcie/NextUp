/**
 * Client-side WebSocket hook for receiving real-time broadcast messages.
 *
 * Connects to the app's /_ws endpoint and auto-reconnects on disconnection.
 * Messages sent via `broadcast()` from server functions are received here.
 *
 * DO NOT MODIFY THIS FILE — it is part of the framework infrastructure.
 */

import { useEffect, useRef, useState } from "react";

interface UseWebSocketOptions {
	/** Called when a message is received from the server. */
	onMessage?: (data: unknown) => void;
}

interface UseWebSocketReturn {
	/** The most recent message received, or null if none yet. */
	lastMessage: unknown | null;
	/** Whether the WebSocket is currently connected. */
	isConnected: boolean;
}

/**
 * Connect to the app's real-time broadcast channel.
 *
 * Messages sent via `broadcast()` from server functions will be received
 * either through the `onMessage` callback or via the `lastMessage` return value.
 *
 * The connection auto-reconnects with exponential backoff on disconnection.
 *
 * @example
 * ```tsx
 * import { useWebSocket } from "@/lib/websocket";
 * import { useQueryClient } from "@tanstack/react-query";
 *
 * function MyComponent() {
 *   const queryClient = useQueryClient();
 *
 *   useWebSocket({
 *     onMessage: (data) => {
 *       // Invalidate queries when server broadcasts an update
 *       queryClient.invalidateQueries({ queryKey: ["items"] });
 *     },
 *   });
 *
 *   // ... rest of component
 * }
 * ```
 */
export function useWebSocket(
	options?: UseWebSocketOptions,
): UseWebSocketReturn {
	const [lastMessage, setLastMessage] = useState<unknown | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const onMessageRef = useRef(options?.onMessage);
	onMessageRef.current = options?.onMessage;

	useEffect(() => {
		let ws: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectDelay = 1000;
		let unmounted = false;

		function connect() {
			if (unmounted) return;

			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const url = `${protocol}//${window.location.host}/_ws`;

			ws = new WebSocket(url);

			ws.onopen = () => {
				setIsConnected(true);
				reconnectDelay = 1000; // Reset backoff on successful connect
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					setLastMessage(data);
					onMessageRef.current?.(data);
				} catch {
					// Non-JSON message — ignore
				}
			};

			ws.onclose = () => {
				setIsConnected(false);
				if (!unmounted) {
					reconnectTimer = setTimeout(() => {
						reconnectDelay = Math.min(reconnectDelay * 2, 30000);
						connect();
					}, reconnectDelay);
				}
			};

			ws.onerror = () => {
				ws?.close();
			};
		}

		connect();

		return () => {
			unmounted = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			ws?.close();
		};
	}, []);

	return { lastMessage, isConnected };
}
