import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Scissors, User, Users } from "lucide-react";
import { getShopPublic, getShopQueues } from "@/lib/server-fns";
import { useWebSocket } from "@/lib/websocket";

export const Route = createFileRoute("/queue/$shopId")({
	component: QueueDisplayPage,
});

function QueueDisplayPage() {
	const { shopId } = Route.useParams();
	const shopIdNum = Number(shopId);
	const queryClient = useQueryClient();

	const { data: shop, isLoading: shopLoading } = useQuery({
		queryKey: ["shopPublic", shopIdNum],
		queryFn: () => getShopPublic({ data: { shopId: shopIdNum } }),
	});

	const { data: queues, isLoading: queuesLoading } = useQuery({
		queryKey: ["shopQueues", shopIdNum],
		queryFn: () => getShopQueues({ data: { shopId: shopIdNum } }),
		refetchInterval: 15000,
	});

	// Real-time updates via WebSocket
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
					<Scissors className="w-12 h-12 text-gray-600 mx-auto mb-4" />
					<h2 className="text-xl font-bold text-white">No encontrada</h2>
				</div>
			</div>
		);
	}

	const totalWaiting = queues?.reduce((sum, q) => sum + q.waitingCount, 0) ?? 0;

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
			{/* Header */}
			<div className="bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 px-6 py-5">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
							<Scissors className="w-6 h-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-white">{shop.name}</h1>
							<p className="text-sm text-gray-500">Cola en tiempo real</p>
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

			{/* Barber Queues Grid */}
			<div className="max-w-7xl mx-auto px-6 py-6">
				{queues && queues.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
						{queues.map((q) => (
							<BarberQueueCard key={q.barber.id} queue={q} />
						))}
					</div>
				) : (
					<div className="text-center py-20">
						<Scissors className="w-16 h-16 text-gray-700 mx-auto mb-4" />
						<p className="text-gray-500 text-lg">No active barbers</p>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="fixed bottom-0 inset-x-0 border-t border-gray-800/50 bg-gray-950/80 backdrop-blur-xl py-3">
				<p className="text-center text-xs text-gray-600">
					Scan the QR code to join the line · Powered by{" "}
					<span className="text-amber-600 font-semibold">NextUp</span>
				</p>
			</div>
		</div>
	);
}

function BarberQueueCard({
	queue,
}: {
	queue: {
		barber: { id: number; name: string; specialty: string | null };
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

	return (
		<div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
			{/* Barber Header */}
			<div
				className={`px-5 py-4 border-b ${isServing ? "border-green-500/30 bg-green-500/5" : "border-gray-800"}`}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={`w-11 h-11 rounded-full flex items-center justify-center ${isServing ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-amber-500/30 to-orange-600/30"}`}
						>
							<Scissors
								className={`w-5 h-5 ${isServing ? "text-white" : "text-amber-400"}`}
							/>
						</div>
						<div>
							<p className="text-white font-semibold text-lg">
								{queue.barber.name}
							</p>
							{queue.barber.specialty && (
								<p className="text-xs text-gray-500">
									{queue.barber.specialty}
								</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full">
						<Users className="w-3.5 h-3.5 text-amber-400" />
						<span className="text-amber-400 font-bold text-sm">
							{queue.waitingCount}
						</span>
					</div>
				</div>
			</div>

			{/* Current Client */}
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

			{/* Waiting List */}
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
