import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/opt-in")({
	component: OptInPage,
});

function OptInPage() {
	return (
		<div style={{ minHeight:"100vh", background:"#060608", color:"white", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", padding:"40px 24px" }}>
			<style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

			<div style={{ maxWidth:600, margin:"0 auto" }}>
				{/* Logo */}
				<div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:40 }}>
					<div style={{ width:36, height:36, background:"linear-gradient(135deg,#f97316,#c2410c)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
						<span style={{ fontWeight:800, fontSize:19, color:"white" }}>G</span>
					</div>
					<span style={{ fontWeight:800, fontSize:19, color:"white" }}>Goolinext</span>
				</div>

				<h1 style={{ fontSize:28, fontWeight:800, color:"white", marginBottom:8 }}>SMS Opt-In Consent Form</h1>
				<p style={{ color:"#64748b", fontSize:14, marginBottom:32 }}>
					This page shows how Goolinext collects SMS consent from end-users on behalf of barbershops and beauty salons using our platform.
				</p>

				{/* Sample form */}
				<div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:28, marginBottom:28 }}>
					<p style={{ fontSize:12, fontWeight:700, color:"#f97316", letterSpacing:"0.1em", marginBottom:16 }}>SAMPLE REGISTRATION FORM — POWERED BY GOOLINEXT</p>

					<div style={{ display:"flex", flexDirection:"column", gap:14 }}>
						<div>
							<label style={{ display:"block", fontSize:13, color:"#94a3b8", marginBottom:6 }}>Full Name *</label>
							<div style={{ padding:"12px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#475569", fontSize:14 }}>John Smith</div>
						</div>
						<div>
							<label style={{ display:"block", fontSize:13, color:"#94a3b8", marginBottom:6 }}>Phone Number *</label>
							<div style={{ padding:"12px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#475569", fontSize:14 }}>+1 (555) 123-4567</div>
						</div>
						<div>
							<label style={{ display:"block", fontSize:13, color:"#94a3b8", marginBottom:6 }}>Email *</label>
							<div style={{ padding:"12px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#475569", fontSize:14 }}>john@email.com</div>
						</div>

						{/* SMS CONSENT CHECKBOX — THE KEY ELEMENT */}
						<div style={{ background:"rgba(249,115,22,0.06)", border:"2px solid rgba(249,115,22,0.3)", borderRadius:12, padding:16, marginTop:4 }}>
							<div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
								<div style={{ width:20, height:20, background:"#f97316", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
										<path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								</div>
								<p style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.7 }}>
									By checking this box, I agree to receive SMS text messages from <strong style={{ color:"white" }}>[Business Name]</strong> powered by Goolinext about my place in line, appointment confirmations, appointment reminders, and re-engagement messages. Message frequency varies (typically 1–5 messages per visit/appointment). Msg &amp; data rates may apply. Reply <strong style={{ color:"white" }}>STOP</strong> to opt out at any time. Reply <strong style={{ color:"white" }}>HELP</strong> for assistance. Consent is not a condition of purchase. View our <a href="https://goolinext.com/privacy" style={{ color:"#f97316" }}>Privacy Policy</a> and <a href="https://goolinext.com/terms" style={{ color:"#f97316" }}>Terms &amp; Conditions</a>.
								</p>
							</div>
						</div>

						<div style={{ padding:"13px", background:"linear-gradient(135deg,#f97316,#ea580c)", borderRadius:12, textAlign:"center", fontWeight:700, fontSize:15, color:"white", cursor:"pointer" }}>
							Join Queue
						</div>
					</div>
				</div>

				{/* How consent works */}
				<div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:24, marginBottom:24 }}>
					<h2 style={{ fontSize:16, fontWeight:700, color:"white", marginBottom:16 }}>How SMS Consent Works on Goolinext</h2>
					<div style={{ display:"flex", flexDirection:"column", gap:12 }}>
						{[
							["1. Client visits a business using Goolinext", "The client scans a QR code or visits the business public page at goolinext.com/biz/[businessId]"],
							["2. Client fills out the registration form", "The form collects name, phone number, and email. The SMS consent checkbox is unchecked by default and must be actively checked by the client."],
							["3. Explicit opt-in required", "The client must actively check the box to consent. No messages are sent if the box is left unchecked. Consent is collected at the point of service registration."],
							["4. Transactional messages only", "After opting in, clients receive: queue position notifications, appointment confirmations, appointment reminders (2 hours before), post-visit thank you with Google review link, and a single re-engagement message after 30 days of inactivity."],
							["5. Easy opt-out", "Clients can reply STOP at any time to unsubscribe. They receive one confirmation message and no further messages are sent."],
						].map(([title, desc], i) => (
							<div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
								<div style={{ width:24, height:24, background:"rgba(249,115,22,0.15)", border:"1px solid rgba(249,115,22,0.3)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:11, fontWeight:700, color:"#f97316" }}>{i+1}</div>
								<div>
									<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:3 }}>{title}</p>
									<p style={{ fontSize:12, color:"#64748b", lineHeight:1.6 }}>{desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Message types */}
				<div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:24, marginBottom:24 }}>
					<h2 style={{ fontSize:16, fontWeight:700, color:"white", marginBottom:16 }}>Message Types Sent</h2>
					<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
						{[
							["Queue Turn Alert", `[Business Name]: It's your turn! Please come to the chair now. Reply STOP to opt out. Msg&data rates may apply.`],
							["Post-Visit Thank You", `[Business Name]: Thanks for your visit! Leave us a review: [Google Review Link] Reply STOP to opt out. Msg&data rates may apply.`],
							["Appointment Confirmation", `[Business Name]: Your appointment on [Date] at [Time] with [Staff] is confirmed. Reply STOP to opt out. Msg&data rates may apply.`],
							["Appointment Reminder", `[Business Name]: Reminder: Your appointment today at [Time] with [Staff]. See you soon! Reply STOP to opt out. Msg&data rates may apply.`],
							["Re-engagement (30 days)", `[Business Name]: We miss you! It's been 30 days since your last visit. Come see us soon! Reply STOP to opt out. Msg&data rates may apply.`],
						].map(([type, msg], i) => (
							<div key={i} style={{ padding:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 }}>
								<p style={{ fontSize:11, fontWeight:700, color:"#f97316", marginBottom:6, letterSpacing:"0.05em" }}>{type.toUpperCase()}</p>
								<p style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6, fontFamily:"monospace" }}>{msg}</p>
							</div>
						))}
					</div>
				</div>

				{/* Links */}
				<div style={{ textAlign:"center", padding:"20px 0", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
					<p style={{ fontSize:13, color:"#475569" }}>
						<a href="https://goolinext.com/privacy" style={{ color:"#f97316", textDecoration:"none" }}>Privacy Policy</a>
						{" · "}
						<a href="https://goolinext.com/terms" style={{ color:"#f97316", textDecoration:"none" }}>Terms &amp; Conditions</a>
						{" · "}
						<a href="https://goolinext.com" style={{ color:"#f97316", textDecoration:"none" }}>goolinext.com</a>
					</p>
					<p style={{ fontSize:12, color:"#334155", marginTop:8 }}>© 2026 Makemcie LLC · Goolinext · support@goolinext.com</p>
				</div>
			</div>
		</div>
	);
}
