import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, User, Users } from "lucide-react";
import { getShopPublic, getShopQueues } from "@/lib/server-fns";
import { useWebSocket } from "@/lib/websocket";

export const Route = createFileRoute("/queue/$shopId")({
	component: QueueDisplayPage,
});

// GoolinextIcon - Componente para reemplazar Scissors
const GoolinextIcon = ({ className = "" }: { className?: string }) => {
  const sizeMap: Record<string, number> = {
    "w-4 h-4": 16,
    "w-5 h-5": 20,
    "w-6 h-6": 24,
    "w-8 h-8": 32,
    "w-10 h-10": 40,
    "w-12 h-12": 48,
    "w-16 h-16": 64,
  };
  
  let size = 32;
  for (const [key, value] of Object.entries(sizeMap)) {
    if (className.includes(key)) {
      size = value;
      break;
    }
  }
  
  const color = className.includes("text-white") ? "white" 
              : className.includes("text-green-400") ? "#4ade80"
              : className.includes("text-amber-400") ? "#fbbf24"
              : className.includes("text-gray-600") ? "#4b5563"
              : className.includes("text-gray-700") ? "#374151"
              : "currentColor";
  
  return (
    <span 
      className={className}
      style={{
        fontFamily: "Plus Jakarta Sans, sans-serif",
        fontWeight: 800,
        fontSize: `${size * 0.75}px`,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
      }}
    >
      G
    </span>
  );
};

function getAvatarUrl(name: string): string {
	const initials = name
		.split(" ")
		.slice(0, 2)
		.map(n => n[0])
		.join("")
		.toUpperCase();
	
	return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=f59e0b&color=fff&bold=true&size=128`;
}

interface Notification {
	id: string;
	barberName: string;
	clientName: string;
	language: string;
}

function playNotificationSound(clientName: string, barberName: string, language: string, soundEnabled: boolean) {
	if (!soundEnabled || !("speechSynthesis" in window)) return;

	window.speechSynthesis.cancel();

	const isSpanish = language === "es";
	const text = isSpanish
		? `¡Turno para ${clientName}! Pasa con ${barberName}`
		: `Turn for ${clientName}! Go with ${barberName}`;

	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = isSpanish ? "es-ES" : "en-US";
	utterance.rate = 0.8;
	utterance.pitch = 1;
	utterance.volume = 1;

	// Seleccionar voz más natural disponible
	const voices = window.speechSynthesis.getVoices();
	if (voices.length > 0) {
		// Buscar voz de Google si está disponible
		const googleVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft"));
		if (googleVoice) {
			utterance.voice = googleVoice;
		} else {
			utterance.voice = voices[0];
		}
	}

	window.speechSynthesis.speak(utterance);
}

function NotificationBanner({ notification, onComplete, soundEnabled }: { notification: Notification; onComplete: () => void; soundEnabled: boolean }) {
	useEffect(() => {
		playNotificationSound(notification.clientName, notification.barberName, notification.language, soundEnabled);

		const timer = setTimeout(() => onComplete(), 5000);
		return () => {
			clearTimeout(timer);
			window.speechSynthesis.cancel();
		};
	}, [notification, onComplete]);

	const isSpanish = notification.language === "es";

	return (
		<div className="fixed top-20 inset-x-0 z-50 flex items-center justify-center px-6">
			<div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-2xl px-8 py-6 max-w-2xl animate-pulse border-2 border-green-400">
				<div className="text-center">
					<p className="text-white text-xl font-bold mb-2">
						{isSpanish ? "🎉 ¡TURNO!" : "🎉 YOUR TURN!"}
					</p>
					<p className="text-white text-3xl font-black">{notification.clientName}</p>
					<p className="text-green-100 text-lg mt-3">
						{isSpanish ? "Pasa con" : "Go with"} {notification.barberName}
					</p>
					<p className="text-green-200 text-xs mt-4">🔊 {isSpanish ? "Escuchando..." : "Playing audio..."}</p>
				</div>
			</div>
		</div>
	);
}

function QRComponent({ shopId, showQr }: { shopId: number; showQr: boolean }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;

	if (!showQr) return null;

	const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
		`${window.location.origin}/register/${shopId}`
	)}`;

	return (
		<div className="fixed bottom-20 right-6 bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden w-48 z-50">
			<div className="px-5 py-4 border-b border-gray-800 text-center">
				<p className="text-xs text-amber-400 font-bold uppercase tracking-wider">SCAN TO JOIN</p>
			</div>
			<div className="p-4 flex flex-col items-center gap-3">
				<img src={qrUrl} alt="QR Register" className="w-28 h-28 bg-white rounded-lg p-1" />
				<p className="text-xs text-gray-400 text-center text-nowrap">Register & choose</p>
			</div>
		</div>
	);
}

function QueueDisplayPage() {
	const { shopId } = Route.useParams();
	const shopIdNum = Number(shopId);
	const queryClient = useQueryClient();
	const [notificationQueue, setNotificationQueue] = useState<Notification[]>([]);
	const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
	const [previousClients, setPreviousClients] = useState<Map<number, string>>(new Map());
	const [soundEnabled, setSoundEnabled] = useState(true);

	const { data: shop, isLoading: shopLoading } = useQuery({
		queryKey: ["shopPublic", shopIdNum],
		queryFn: () => getShopPublic({ data: { shopId: shopIdNum } }),
	});

	const { data: queuesData, isLoading: queuesLoading } = useQuery({
		queryKey: ["shopQueues", shopIdNum],
		queryFn: () => getShopQueues({ data: { shopId: shopIdNum } }),
		refetchInterval: 15000,
	});
	const queues = queuesData?.queues ?? [];
	const announceTurnEnabled = queuesData?.announceTurnEnabled ?? true;

	useEffect(() => {
		if (!queues || !shop) return;

		const newNotifications: Notification[] = [];

		queues.forEach((queue) => {
			const barberId = queue.barber.id;
			const currentClientName = queue.currentClient?.clientName;
			const previousClientName = previousClients.get(barberId);

			if (currentClientName && currentClientName !== previousClientName) {
				newNotifications.push({
					id: `${barberId}-${currentClientName}-${Date.now()}`,
					barberName: queue.barber.name,
					clientName: currentClientName,
					language: shop.language || "en",
				});
			}

			if (currentClientName) {
				setPreviousClients(new Map(previousClients).set(barberId, currentClientName));
			}
		});

		if (newNotifications.length > 0) {
			setNotificationQueue(prev => [...prev, ...newNotifications]);
		}
	}, [queues, shop]);

	useEffect(() => {
		if (currentNotification === null && notificationQueue.length > 0) {
			setCurrentNotification(notificationQueue[0]);
			setNotificationQueue(prev => prev.slice(1));
		}
	}, [currentNotification, notificationQueue]);

	useWebSocket({
		onMessage: (msg) => {
			const data = msg as { type: string; shopId?: number };
			if (data.type === "queue_updated" && data.shopId === shopIdNum) {
				queryClient.invalidateQueries({
					queryKey: ["shopQueues", shopIdNum],
				});
			}
		},
	});

	if (shopLoading || queuesLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="w-12 h-12 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
					<p className="text-gray-400 text-sm">Loading queue...</p>
				</div>
			</div>
		);
	}

	if (!shop) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
				<div className="text-center">
					<GoolinextIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
					<h2 className="text-xl font-bold text-white">No encontrada</h2>
				</div>
			</div>
		);
	}

	const totalWaiting = queues?.reduce((sum, q) => sum + q.waitingCount, 0) ?? 0;

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
			{currentNotification && (
				<NotificationBanner 
					notification={currentNotification}
					onComplete={() => setCurrentNotification(null)}
				/>
			)}

			{notificationQueue.length > 0 && (
				<div className="fixed top-6 right-6 bg-amber-500 rounded-full w-10 h-10 flex items-center justify-center z-40">
					<span className="text-white font-bold text-sm">{notificationQueue.length}</span>
				</div>
			)}

			<div className="bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 px-6 py-5">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
							<GoolinextIcon className="w-6 h-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-white">{shop.name}</h1>
							<p className="text-sm text-gray-500">Live Queue</p>
						</div>
					</div>
					<div className="flex items-center gap-6">
						<div className="text-right">
							<p className="text-3xl font-black text-amber-400">
								{totalWaiting}
							</p>
							<p className="text-xs text-gray-500">waiting</p>
						</div>
						<CurrentTime />
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-6 py-6">
				{queues && queues.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
						{queues.map((q) => (
							<BarberQueueCard key={q.barber.id} queue={q} />
						))}
					</div>
				) : (
					<div className="text-center py-20">
						<GoolinextIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
						<p className="text-gray-500 text-lg">No active barbers</p>
					</div>
				)}
			</div>

			<QRComponent shopId={shopIdNum} showQr={shop?.showQr ?? true} />

			<div className="fixed bottom-0 inset-x-0 border-t border-gray-800/50 bg-gray-950/80 backdrop-blur-xl py-3">
				<p className="text-center text-xs text-gray-600">
					Scan the QR code to join the line · Powered by{" "}
					<span className="text-amber-600 font-semibold">Goolinext</span>
				</p>
			</div>
		</div>
	);
}

function BarberQueueCard({
	queue,
}: {
	queue: {
		barber: { id: number; name: string; specialty: string | null; photoUrl: string | null };
		currentClient: {
			visitId: number;
			clientName: string;
			createdAt: Date | null;
		} | null;
		waitingClients: {
			visitId: number;
			clientName: string;
			createdAt: Date | null;
		}[];
		waitingCount: number;
	};
}) {
	const isServing = queue.currentClient !== null;
	const avatarUrl = queue.barber.photoUrl || getAvatarUrl(queue.barber.name);

	return (
		<div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
			<div
				className={`px-5 py-4 border-b ${isServing ? "border-green-500/30 bg-green-500/5" : "border-gray-800"}`}
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<img 
							src={avatarUrl}
							alt={queue.barber.name}
							className="w-11 h-11 rounded-full flex-shrink-0 object-cover"
						/>

						<div className="min-w-0 flex-1">
							<p className="text-white font-semibold text-sm whitespace-nowrap overflow-x-auto">
								{queue.barber.name}
							</p>
							{queue.barber.specialty && (
								<p className="text-xs text-gray-500 truncate">
									{queue.barber.specialty}
								</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full flex-shrink-0">
						<Users className="w-3.5 h-3.5 text-amber-400" />
						<span className="text-amber-400 font-bold text-sm">
							{queue.waitingCount}
						</span>
					</div>
				</div>
			</div>

			{queue.currentClient && (
				<div className="px-5 py-3 bg-green-500/5 border-b border-green-500/20">
					<p className="text-xs text-green-500 font-medium uppercase tracking-wider mb-1">
						Now serving
					</p>
					<div className="flex items-center gap-2">
						<User className="w-4 h-4 text-green-400" />
						<p className="text-green-300 font-semibold">
							{queue.currentClient.clientName}
						</p>
					</div>
				</div>
			)}

			<div className="divide-y divide-gray-800/50">
				{queue.waitingClients.length > 0 ? (
					queue.waitingClients.map((client, index) => (
						<div
							key={client.visitId}
							className="px-5 py-3 flex items-center justify-between"
						>
							<div className="flex items-center gap-3">
								<span
									className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-500"}`}
								>
									{index + 1}
								</span>
								<p
									className={`font-medium ${index === 0 ? "text-white" : "text-gray-400"}`}
								>
									{client.clientName}
								</p>
							</div>
							{client.createdAt && (
								<p className="text-xs text-gray-600">
									{formatWaitTime(client.createdAt)}
								</p>
							)}
						</div>
					))
				) : (
					<div className="px-5 py-6 text-center">
						<p className="text-gray-600 text-sm">No wait</p>
					</div>
				)}
			</div>
		</div>
	);
}

function CurrentTime() {
	const { data: time } = useQuery({
		queryKey: ["currentTime"],
		queryFn: () =>
			new Date().toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
			}),
		refetchInterval: 30000,
	});

	return (
		<div className="flex items-center gap-2 text-gray-500">
			<Clock className="w-4 h-4" />
			<span className="text-sm font-mono">{time ?? ""}</span>
		</div>
	);
}

function formatWaitTime(createdAt: Date): string {
	const now = Date.now();
	const created = new Date(createdAt).getTime();
	const diffMin = Math.floor((now - created) / 60000);
	if (diffMin < 1) return "now";
	if (diffMin < 60) return `${diffMin}m`;
	const hours = Math.floor(diffMin / 60);
	const mins = diffMin % 60;
	return `${hours}h ${mins}m`;
}
