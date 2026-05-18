import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { cancelAppointmentByToken } from "@/lib/server-fns";
import { Check, X, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/cancel/$token")({
	component: CancelPage,
});

function CancelPage() {
	const { token } = Route.useParams();
	const [status, setStatus] = useState<"loading" | "success" | "refunded" | "lost" | "error" | "already">("loading");

	useEffect(() => {
		cancelAppointmentByToken({ data: { cancelToken: token } })
			.then((r: any) => {
				if (r.alreadyCancelled) setStatus("already");
				else if (r.refunded) setStatus("refunded");
				else if (r.lostDeposit) setStatus("lost");
				else setStatus("success");
			})
			.catch(() => setStatus("error"));
	}, [token]);

	return (
		<div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
			<div className="max-w-sm w-full text-center space-y-6">
				{status === "loading" && (
					<div className="w-16 h-16 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
				)}
				{status === "refunded" && (
					<>
						<div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
							<Check className="w-10 h-10 text-green-400" />
						</div>
						<h1 className="text-2xl font-bold text-white">Cita cancelada</h1>
						<p className="text-gray-400">Tu depósito de $10 ha sido reembolsado. Aparecerá en tu cuenta en 3-5 días hábiles.</p>
					</>
				)}
				{status === "lost" && (
					<>
						<div className="w-20 h-20 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
							<AlertTriangle className="w-10 h-10 text-red-400" />
						</div>
						<h1 className="text-2xl font-bold text-white">Cita cancelada</h1>
						<p className="text-gray-400">La cita fue cancelada con menos de 1 hora de anticipación. El depósito de $10 no es reembolsable.</p>
					</>
				)}
				{(status === "success" || status === "already") && (
					<>
						<div className="w-20 h-20 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center mx-auto">
							<X className="w-10 h-10 text-gray-400" />
						</div>
						<h1 className="text-2xl font-bold text-white">Cita cancelada</h1>
						<p className="text-gray-400">Tu cita ha sido cancelada exitosamente.</p>
					</>
				)}
				{status === "error" && (
					<>
						<div className="w-20 h-20 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
							<X className="w-10 h-10 text-red-400" />
						</div>
						<h1 className="text-2xl font-bold text-white">Error</h1>
						<p className="text-gray-400">No se pudo cancelar la cita. El link puede haber expirado.</p>
					</>
				)}
				<a href="/" className="block mt-4 text-amber-400 text-sm hover:underline">Volver al inicio</a>
			</div>
		</div>
	);
}
