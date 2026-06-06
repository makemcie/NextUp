// ============================================================
// lib/messaging-sent.ts
// Envía SMS via Sent API (reemplaza Twilio)
// ============================================================

/**
 * Envía un SMS via Sent API
 * @param to - Número telefónico (ej: +16465154329)
 * @param code - Código de verificación o mensaje personalizado
 */
export async function sendSMSViaeSent(to: string, code: string): Promise<boolean> {
	try {
		// Obtener API Key de Cloudflare env
		const mod = await import("cloudflare:workers");
		const env = mod.env as Record<string, string>;
		const apiKey = env.SENTDM_API_KEY ?? "";

		if (!apiKey) {
			console.error("❌ SENTDM_API_KEY no configurada en Cloudflare");
			return false;
		}

		// Template ID de Sent
		const templateId = "0d309e5f-95f3-4634-b7c9-d4c8be382e24";

		// Request a Sent API
		const response = await fetch("https://api.sent.dm/v3/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
				"x-api-key": apiKey,
				"Idempotency-Key": `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			},
			body: JSON.stringify({
				to: [to],
				channel: ["sent"],
				template: {
					id: templateId,
					parameters: {
						var_1: code, // Parámetro del template (el código)
					},
				},
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			console.error("❌ Error Sent API:", response.status, error);
			return false;
		}

		const result = await response.json();
		console.log("✅ SMS enviado via Sent:", result);
		return true;
	} catch (error) {
		console.error("❌ Error enviando SMS via Sent:", error);
		return false;
	}
}

/**
 * Wrapper para compatibilidad con código existente
 * Reemplaza la anterior función sendSMS de Twilio
 */
export async function sendSMS({ to, body }: { to: string; body: string }): Promise<void> {
	// Si el body es un código (números), enviarlo como código
	// Si es un mensaje, enviarlo como mensaje personalizado
	const code = body.match(/\d{4,8}/) ? body.match(/\d{4,8}/)![0] : body;
	await sendSMSViaeSent(to, code);
}
