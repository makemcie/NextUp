// Privacy Policy page for Goolinext
// This will be added as a new route: src/routes/privacy.tsx

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
	component: PrivacyPolicy,
});

function PrivacyPolicy() {
	return (
		<div style={{ minHeight: "100vh", background: "#070709", color: "white", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "60px 24px" }}>
			<div style={{ maxWidth: 800, margin: "0 auto" }}>
				<div style={{ marginBottom: 40 }}>
					<h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", fontWeight: 900, color: "#f97316", marginBottom: 8 }}>Privacy Policy</h1>
					<p style={{ color: "#64748b", fontSize: 14 }}>Last updated: March 23, 2026</p>
				</div>

				{[
					{ title: "1. Information We Collect", content: "We collect information you provide directly to us, including name, email address, phone number, and business information when you register for Goolinext. We also collect information about your use of our services, including queue activity, appointment data, and client interactions." },
					{ title: "2. How We Use Your Information", content: "We use the information we collect to provide, maintain, and improve our services, send transactional SMS notifications on behalf of barbershops using our platform (including queue position updates, appointment confirmations, appointment reminders, and re-engagement messages), communicate with you about your account, and comply with legal obligations." },
					{ title: "3. SMS Notifications", content: "By registering through a barbershop's queue registration form powered by Goolinext, you consent to receive SMS notifications including queue position updates, appointment reminders, and follow-up messages. Standard message and data rates may apply. You can opt out at any time by replying STOP to any message." },
					{ title: "4. Information Sharing", content: "We do not sell, trade, or rent your personal information to third parties. We do not share your information for marketing purposes. We may share information with service providers who assist in our operations (such as SMS delivery services), but only to the extent necessary to provide our services." },
					{ title: "5. Data Security", content: "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction." },
					{ title: "6. Data Retention", content: "We retain your personal information for as long as necessary to provide our services and comply with legal obligations. You may request deletion of your data by contacting us." },
					{ title: "7. Your Rights", content: "You have the right to access, correct, or delete your personal information. You may also opt out of SMS communications at any time by replying STOP to any message or contacting us at support@goolinext.com." },
					{ title: "8. Contact Us", content: "If you have any questions about this Privacy Policy, please contact us at support@goolinext.com or visit goolinext.com." },
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
