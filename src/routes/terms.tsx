import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
	component: TermsOfService,
});

function TermsOfService() {
	return (
		<div style={{ minHeight: "100vh", background: "#070709", color: "white", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "60px 24px" }}>
			<div style={{ maxWidth: 800, margin: "0 auto" }}>
				<div style={{ marginBottom: 40 }}>
					<h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", fontWeight: 900, color: "#f97316", marginBottom: 8 }}>Terms & Conditions</h1>
					<p style={{ color: "#64748b", fontSize: 14 }}>Last updated: March 23, 2026</p>
				</div>

				{[
					{ title: "1. Acceptance of Terms", content: "By using Goolinext, you agree to these Terms and Conditions. Goolinext is a barbershop queue management platform operated by Makemcie LLC." },
					{ title: "2. Description of Service", content: "Goolinext provides barbershop queue management services including digital queue registration, appointment scheduling, and SMS notifications. The platform is available at goolinext.com." },
					{ title: "3. SMS Messaging Program", content: "Program name: Goolinext Notifications. Message types: Queue position updates, appointment confirmations, appointment reminders, and re-engagement messages. Message frequency: Varies based on barbershop activity, typically 1-5 messages per visit. Message & data rates may apply." },
					{ title: "4. Opt-Out Instructions", content: "You can cancel SMS notifications at any time. Reply STOP to any message to unsubscribe. After opting out, you will receive one confirmation message. To re-enable notifications, reply START." },
					{ title: "5. Help Instructions", content: "For help with SMS notifications, reply HELP to any message or contact us at support@goolinext.com." },
					{ title: "6. Support Contact", content: "Email: support@goolinext.com. Website: goolinext.com. Phone: +1 (646) 515-4329." },
					{ title: "7. Subscription Terms", content: "Goolinext is offered as a monthly subscription service at $49.99/month per barbershop. Subscriptions renew automatically. You may cancel at any time from your account settings." },
					{ title: "8. Limitation of Liability", content: "Makemcie LLC is not liable for any indirect, incidental, or consequential damages arising from the use of Goolinext services." },
					{ title: "9. Changes to Terms", content: "We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of the updated terms." },
				].map((section, i) => (
					<div key={i} style={{ marginBottom: 32, padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
						<h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fb923c", marginBottom: 12 }}>{section.title}</h2>
						<p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: 15 }}>{section.content}</p>
					</div>
				))}

				<div style={{ marginTop: 40, padding: "20px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 16, textAlign: "center" }}>
					<p style={{ color: "#64748b", fontSize: 13 }}>© 2026 Makemcie LLC · Goolinext · <a href="https://goolinext.com" style={{ color: "#f97316" }}>goolinext.com</a> · support@goolinext.com</p>
				</div>
			</div>
		</div>
	);
}
