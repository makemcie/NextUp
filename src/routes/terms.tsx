import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/terms")({
	component: TermsOfService,
});

function TermsOfService() {
	const [lang, setLang] = useState<"en" | "es">("en");

	const sections = {
		en: [
			{ title: "1. Acceptance of Terms", content: "By using Goolinext, you agree to these Terms and Conditions. Goolinext is a barbershop queue management platform operated by Makemcie LLC." },
			{ title: "2. Description of Service", content: "Goolinext provides barbershop queue management services including digital queue registration, appointment scheduling, and SMS notifications. The platform is available at goolinext.com." },
			{ title: "3. SMS Messaging Program", content: "Program name: Goolinext Notifications. Message types: Queue position updates, appointment confirmations, appointment reminders, and re-engagement messages. Message frequency: Varies based on barbershop activity, typically 1-5 messages per visit. Message & data rates may apply." },
			{ title: "4. Opt-Out Instructions", content: "You can cancel SMS notifications at any time. Reply STOP to any message to unsubscribe. After opting out, you will receive one confirmation message. To re-enable notifications, reply START. For help, reply HELP to any message." },
			{ title: "5. Help Instructions", content: "For help with SMS notifications, reply HELP to any message or contact us at support@goolinext.com." },
			{ title: "6. Support Contact", content: "Email: support@goolinext.com. Website: goolinext.com. Phone: +1 (646) 515-4329." },
			{ title: "7. Subscription Terms & Refund Policy", content: "Goolinext is offered as a monthly subscription service at $150/month per barbershop. Subscriptions renew automatically on the same day each month. You may cancel at any time from your account settings. Upon cancellation, your access continues until the end of the current billing period.\n\n7-Day Money-Back Guarantee: We offer a 7-day money-back guarantee from the date of your first payment. If you are not satisfied with Goolinext for any reason within the first 7 days of your subscription, you may request a full refund. To request a refund, contact us at support@goolinext.com or via WhatsApp at +1 (646) 515-4329 within 7 days of your initial payment. Refunds are processed within 5-10 business days to the original payment method. After 7 days, all payments are non-refundable. This guarantee applies only to first-time subscribers." },
			{ title: "8. Limitation of Liability", content: "Makemcie LLC is not liable for any indirect, incidental, or consequential damages arising from the use of Goolinext services." },
			{ title: "9. Changes to Terms", content: "We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of the updated terms." },
		],
		es: [
			{ title: "1. Aceptación de los Términos", content: "Al usar Goolinext, aceptas estos Términos y Condiciones. Goolinext es una plataforma de gestión de colas para barberías operada por Makemcie LLC." },
			{ title: "2. Descripción del Servicio", content: "Goolinext provee servicios de gestión de colas para barberías, incluyendo registro digital en cola, programación de citas y notificaciones por SMS. La plataforma está disponible en goolinext.com." },
			{ title: "3. Programa de Mensajes SMS", content: "Nombre del programa: Goolinext Notificaciones. Tipos de mensajes: Actualizaciones de posición en cola, confirmaciones de citas, recordatorios de citas y mensajes de re-enganche. Frecuencia de mensajes: Varía según la actividad de la barbería, típicamente 1-5 mensajes por visita. Pueden aplicarse cargos por mensajes y datos." },
			{ title: "4. Instrucciones para Cancelar SMS", content: "Puedes cancelar las notificaciones SMS en cualquier momento. Responde STOP a cualquier mensaje para darte de baja. Después de darte de baja, recibirás un mensaje de confirmación. Para reactivar las notificaciones, responde START. Para obtener ayuda, responde HELP a cualquier mensaje." },
			{ title: "5. Instrucciones de Ayuda", content: "Para ayuda con las notificaciones SMS, responde HELP a cualquier mensaje o contáctanos en support@goolinext.com." },
			{ title: "6. Contacto de Soporte", content: "Email: support@goolinext.com. Sitio web: goolinext.com. Teléfono: +1 (646) 515-4329." },
			{ title: "7. Términos de Suscripción y Política de Reembolso", content: "Goolinext se ofrece como servicio de suscripción mensual a $150/mes por barbería. Las suscripciones se renuevan automáticamente el mismo día de cada mes. Puedes cancelar en cualquier momento desde la configuración de tu cuenta. Al cancelar, tu acceso continúa hasta el final del período de facturación actual.\n\nGarantía de devolución de 7 días: Ofrecemos una garantía de devolución de dinero de 7 días desde la fecha de tu primer pago. Si no estás satisfecho con Goolinext por cualquier razón dentro de los primeros 7 días de tu suscripción, puedes solicitar un reembolso completo. Para solicitar un reembolso, contáctanos en support@goolinext.com o por WhatsApp al +1 (646) 515-4329 dentro de los 7 días de tu pago inicial. Los reembolsos se procesan en 5-10 días hábiles al método de pago original. Después de 7 días, todos los pagos son no reembolsables. Esta garantía aplica solo a suscriptores por primera vez." },
			{ title: "8. Limitación de Responsabilidad", content: "Makemcie LLC no es responsable de ningún daño indirecto, incidental o consecuente que surja del uso de los servicios de Goolinext." },
			{ title: "9. Cambios en los Términos", content: "Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuo del servicio constituye la aceptación de los términos actualizados." },
		],
	};

	return (
		<div style={{ minHeight: "100vh", background: "#070709", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", padding: "60px 24px" }}>
			<div style={{ maxWidth: 800, margin: "0 auto" }}>
				{/* Header */}
				<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
					<div>
						<a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 20 }}>
							<div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#f97316,#c2410c)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
								<span style={{ fontWeight: 800, fontSize: 16, color: "white" }}>G</span>
							</div>
							<span style={{ fontWeight: 800, fontSize: 17, color: "white" }}>Goolinext</span>
						</a>
						<h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#f97316", marginBottom: 8, letterSpacing: "-1px" }}>
							{lang === "en" ? "Terms & Conditions" : "Términos y Condiciones"}
						</h1>
						<p style={{ color: "#64748b", fontSize: 14 }}>
							{lang === "en" ? "Last updated: March 23, 2026" : "Última actualización: 23 de marzo de 2026"}
						</p>
					</div>
					{/* Language Toggle */}
					<div style={{ display: "flex", gap: 6 }}>
						<button type="button" onClick={() => setLang("en")} style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: lang === "en" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang === "en" ? "white" : "#64748b" }}>EN</button>
						<button type="button" onClick={() => setLang("es")} style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: lang === "es" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang === "es" ? "white" : "#64748b" }}>ES</button>
					</div>
				</div>

				{/* Guarantee Banner */}
				<div style={{ marginBottom: 32, padding: "16px 20px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
					<span style={{ fontSize: 24 }}>🛡️</span>
					<p style={{ color: "#4ade80", fontSize: 14, fontWeight: 600, margin: 0 }}>
						{lang === "en" ? "7-Day Money-Back Guarantee — If you're not satisfied within the first 7 days, we'll give you a full refund. No questions asked." : "Garantía de devolución de 7 días — Si no estás satisfecho dentro de los primeros 7 días, te devolvemos tu dinero completo. Sin preguntas."}
					</p>
				</div>

				{sections[lang].map((section, i) => (
					<div key={i} style={{ marginBottom: 20, padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
						<h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fb923c", marginBottom: 12 }}>{section.title}</h2>
						<p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: 15, whiteSpace: "pre-line", margin: 0 }}
							dangerouslySetInnerHTML={{ __html: section.content
								.replace(/\bSTOP\b/g, '<strong style="color:white">STOP</strong>')
								.replace(/\bHELP\b/g, '<strong style="color:white">HELP</strong>')
								.replace(/\bSTART\b/g, '<strong style="color:white">START</strong>')
							}}
						/>
					</div>
				))}

				<div style={{ marginTop: 32, padding: "20px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 16, textAlign: "center" }}>
					<p style={{ color: "#64748b", fontSize: 13 }}>© 2026 Makemcie LLC · Goolinext · <a href="https://goolinext.com" style={{ color: "#f97316" }}>goolinext.com</a> · support@goolinext.com</p>
				</div>
			</div>
		</div>
	);
}
