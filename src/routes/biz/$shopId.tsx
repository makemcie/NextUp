"use client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getActiveBarbers, getShopPublicFull, getShopLogo } from "@/lib/server-fns";

export const Route = createFileRoute("/biz/$shopId")({
	component: BusinessPage,
});

const DAY_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function fmt12(t: string) {
	const [h, m] = t.split(":").map(Number);
	const ampm = h >= 12 ? "PM" : "AM";
	const hour = h % 12 || 12;
	return `${hour}:${m.toString().padStart(2,"0")} ${ampm}`;
}

function BusinessPage() {
	const { shopId } = Route.useParams();
	const id = Number(shopId);
	const [lang, setLang] = useState<"en"|"es">("en");

	const { data: shop, isLoading } = useQuery({
		queryKey: ["shopPublicFull", id],
		queryFn: () => getShopPublicFull({ data: { shopId: id } }),
	});

	const { data: logoUrl } = useQuery({
		queryKey: ["shopLogo", id],
		queryFn: () => getShopLogo({ data: { shopId: id } }),
		enabled: !!shop,
	});

	const { data: barberList } = useQuery({
		queryKey: ["activeBarbers", id],
		queryFn: () => getActiveBarbers({ data: { shopId: id } }),
		enabled: !!shop,
	});

	const T = {
		en: { tagline: "Professional Style", sub: "Where every detail of your image reflects who you are and the level you belong to", call: "Call Now", reviews: "Reviews", findUs: "FIND US", team: "OUR TEAM", today: "TODAY", address: "ADDRESS", phone: "PHONE", googleReviews: "GOOGLE REVIEWS", leaveReview: "Leave us a review ⭐", available: "Available Today", off: "Not Today", hours: "HOURS", open: "Open", closed: "Closed", barbers: "barbers available", barber: "barber available", poweredBy: "Powered by", poweredSub: "Queue management for modern barbershops", openNow: "Open Now", closedNow: "Closed Now" },
		es: { tagline: "Estilo Profesional", sub: "Donde cada detalle de tu imagen refleja quién eres y el nivel al que perteneces", call: "Llamar", reviews: "Reseñas", findUs: "ENCUÉNTRANOS", team: "NUESTRO EQUIPO", today: "HOY", address: "DIRECCIÓN", phone: "TELÉFONO", googleReviews: "RESEÑAS DE GOOGLE", leaveReview: "Déjanos una reseña ⭐", available: "Disponible Hoy", off: "No Disponible", hours: "HORARIO", open: "Abierto", closed: "Cerrado", barbers: "barberos disponibles", barber: "barbero disponible", poweredBy: "Con tecnología de", poweredSub: "Gestión de turnos para barberías modernas", openNow: "Abierto Ahora", closedNow: "Cerrado Ahora" },
	}[lang];

	const DAY = lang === "es" ? DAY_ES : DAY_EN;

	if (isLoading) return (
		<div style={{ minHeight:"100vh", background:"#070709", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,sans-serif" }}>
			<div style={{ textAlign:"center" }}>
				<div style={{ width:44,height:44,border:"2px solid #f97316",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 16px",animation:"spin 0.8s linear infinite" }} />
				<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
				<p style={{ color:"#64748b",fontSize:13 }}>Loading...</p>
			</div>
		</div>
	);

	if (!shop) return (
		<div style={{ minHeight:"100vh", background:"#070709", display:"flex", alignItems:"center", justifyContent:"center" }}>
			<p style={{ color:"#475569", fontFamily:"system-ui" }}>Business not found.</p>
		</div>
	);

	const todayIdx = new Date().getDay();
	const allBarbers = barberList ?? [];
	const todayBarbers = allBarbers.filter(b => {
		const days = JSON.parse(b.workDays ?? "[0,1,2,3,4,5,6]") as number[];
		return days.includes(todayIdx) && !b.onVacation;
	});

	type DayHours = { open: string; close: string; closed: boolean };
	const weeklyHours: Record<number, DayHours> = shop.weeklyHours
		? JSON.parse(shop.weeklyHours)
		: {};
	const todayHours: DayHours = weeklyHours[todayIdx] ?? { open: "09:00", close: "19:00", closed: false };
	const now = new Date();
	const nowMins = now.getHours()*60 + now.getMinutes();
	const openMins = parseInt(todayHours.open.split(":")[0])*60 + parseInt(todayHours.open.split(":")[1]);
	const closeMins = parseInt(todayHours.close.split(":")[0])*60 + parseInt(todayHours.close.split(":")[1]);
	const isOpenNow = !todayHours.closed && nowMins >= openMins && nowMins < closeMins && todayBarbers.length > 0;

	return (
		<div style={{ minHeight:"100vh", background:"#070709", color:"white", fontFamily:"'DM Sans',system-ui,sans-serif", overflowX:"hidden" }}>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap');
				*{box-sizing:border-box;margin:0;padding:0}
				@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
				@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
				.fi{animation:fadeUp 0.6s ease forwards;opacity:0}
				.fi-1{animation-delay:0.05s}.fi-2{animation-delay:0.15s}.fi-3{animation-delay:0.25s}.fi-4{animation-delay:0.35s}.fi-5{animation-delay:0.45s}
				.card{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;text-decoration:none;color:white;transition:border-color 0.2s,transform 0.2s}
				.card:hover{border-color:rgba(249,115,22,0.35);transform:translateY(-1px)}
				.icon-box{width:44px;height:44px;border-radius:12px;background:rgba(249,115,22,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0}
				.divider{display:flex;align-items:center;gap:10px;margin:32px 0 20px}
				.divider span{font-size:10px;font-weight:800;letter-spacing:0.22em;color:#f97316;white-space:nowrap}
				.divider div{flex:1;height:1px;background:rgba(249,115,22,0.2)}
				.barber-card{padding:20px 14px;border-radius:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center;transition:border-color 0.2s,transform 0.2s}
				.barber-card:hover{border-color:rgba(249,115,22,0.3);transform:translateY(-2px)}
				.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-weight:700;font-size:14px;text-decoration:none;border:none;cursor:pointer;box-shadow:0 8px 28px rgba(249,115,22,0.3);transition:all 0.2s}
				.btn-primary:hover{box-shadow:0 12px 40px rgba(249,115,22,0.45);transform:translateY(-1px)}
				.btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:14px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);color:#fb923c;font-weight:600;font-size:14px;text-decoration:none;cursor:pointer;transition:all 0.2s}
				.btn-secondary:hover{background:rgba(249,115,22,0.18)}
				.lang-btn{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;border:none;cursor:pointer;transition:all 0.2s}
			`}</style>

			{/* Language toggle */}
			<div style={{ position:"fixed",top:16,right:16,zIndex:100,display:"flex",gap:6 }}>
				<button className="lang-btn" onClick={() => setLang("en")} style={{ background: lang==="en" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang==="en" ? "white" : "#64748b" }}>EN</button>
				<button className="lang-btn" onClick={() => setLang("es")} style={{ background: lang==="es" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang==="es" ? "white" : "#64748b" }}>ES</button>
			</div>

			{/* HERO */}
			<div style={{ position:"relative",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 24px 60px",textAlign:"center",overflow:"hidden" }}>
				<div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 55% at 50% 0%,rgba(249,115,22,0.12) 0%,transparent 70%)",pointerEvents:"none" }} />
				<div style={{ position:"absolute",inset:0,opacity:0.025,backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none" }} />
				<div style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:1,height:100,background:"linear-gradient(to bottom,rgba(249,115,22,0.6),transparent)" }} />

				{/* Logo */}
				<div className="fi fi-1" style={{ position:"relative",marginBottom:28 }}>
					<div style={{ width:96,height:96,borderRadius:26,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",border:"2px solid rgba(249,115,22,0.3)",boxShadow:"0 0 70px rgba(249,115,22,0.25)" }}>
						{logoUrl ? (
							<img src={logoUrl} alt={shop.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
						) : (
							<div style={{ width:"100%",height:"100%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40 }}>
								✂️
							</div>
						)}
					</div>
					<div style={{ position:"absolute",bottom:-4,right:-4,background:isOpenNow?"#10b981":"#ef4444",borderRadius:20,padding:"3px 10px",fontSize:9,fontWeight:800,color:"white",border:"2px solid #070709",display:"flex",alignItems:"center",gap:4 }}>
						<div style={{ width:5,height:5,borderRadius:"50%",background:"white",animation:"pulse 1.5s ease-in-out infinite" }} />
						{isOpenNow ? T.openNow.toUpperCase() : T.closedNow.toUpperCase()}
					</div>
				</div>

				<div className="fi fi-2">
					<p style={{ fontSize:10,fontWeight:800,letterSpacing:"0.25em",color:"#f97316",marginBottom:10 }}>✦ {T.tagline.toUpperCase()} ✦</p>
					<h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:"clamp(2.4rem,9vw,4.5rem)",fontWeight:900,lineHeight:1.05,marginBottom:14,background:"linear-gradient(135deg,#fff 0%,#e2e8f0 60%,#94a3b8 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>
						{shop.name}
					</h1>
					<p style={{ fontSize:14,color:"#64748b",maxWidth:380,margin:"0 auto 36px",lineHeight:1.65 }}>{T.sub}</p>
				</div>

				<div className="fi fi-3" style={{ display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center" }}>
					{shop.phone && (
						<a href={`tel:${shop.phone}`} className="btn-primary">📞 {T.call}</a>
					)}
					{shop.googleReviewLink && (
						<a href={shop.googleReviewLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">⭐ {T.reviews}</a>
					)}
				</div>

				<div style={{ position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,opacity:0.3 }}>
					<p style={{ fontSize:10,letterSpacing:"0.15em",color:"#64748b" }}>SCROLL</p>
					<div style={{ width:1,height:36,background:"linear-gradient(to bottom,#64748b,transparent)" }} />
				</div>
			</div>

			{/* CONTENT */}
			<div style={{ maxWidth:680,margin:"0 auto",padding:"40px 20px 60px" }}>

				{/* FIND US */}
				<div className="divider fi fi-1"><div /><span>{T.findUs}</span><div /></div>

				{shop.address && (
					<a href={`https://maps.google.com/?q=${encodeURIComponent(shop.address)}`} target="_blank" rel="noopener noreferrer" className="card">
						<div className="icon-box" style={{ fontSize:18 }}>📍</div>
						<div style={{ flex:1,minWidth:0 }}>
							<p style={{ fontSize:10,color:"#475569",letterSpacing:"0.12em",marginBottom:3 }}>{T.address}</p>
							<p style={{ fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shop.address}</p>
						</div>
						<span style={{ fontSize:13,color:"#334155" }}>↗</span>
					</a>
				)}

				{shop.phone && (
					<a href={`tel:${shop.phone}`} className="card">
						<div className="icon-box" style={{ fontSize:18 }}>📞</div>
						<div style={{ flex:1 }}>
							<p style={{ fontSize:10,color:"#475569",letterSpacing:"0.12em",marginBottom:3 }}>{T.phone}</p>
							<p style={{ fontSize:15,fontWeight:600 }}>{shop.phone}</p>
						</div>
						<span style={{ fontSize:13,color:"#334155" }}>↗</span>
					</a>
				)}

				{shop.googleReviewLink && (
					<a href={shop.googleReviewLink} target="_blank" rel="noopener noreferrer" className="card" style={{ borderColor:"rgba(251,191,36,0.12)" }}>
						<div className="icon-box" style={{ background:"rgba(251,191,36,0.12)",fontSize:18 }}>⭐</div>
						<div style={{ flex:1 }}>
							<p style={{ fontSize:10,color:"#475569",letterSpacing:"0.12em",marginBottom:3 }}>{T.googleReviews}</p>
							<p style={{ fontSize:15,fontWeight:600 }}>{T.leaveReview}</p>
						</div>
						<span style={{ fontSize:13,color:"#334155" }}>↗</span>
					</a>
				)}

				{/* HOURS */}
				{/* HOURS */}
				{Object.keys(weeklyHours).length > 0 && (
					<>
						<div className="divider fi fi-2"><div /><span>{T.hours}</span><div /></div>
						{/* Today highlight */}
						<div style={{ display:"flex",alignItems:"center",gap:14,padding:"20px",borderRadius:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",marginBottom:10 }}>
							<div className="icon-box" style={{ fontSize:18 }}>🕐</div>
							<div style={{ flex:1 }}>
								<p style={{ fontSize:10,color:"#475569",letterSpacing:"0.12em",marginBottom:4 }}>{DAY[todayIdx].toUpperCase()}</p>
								{todayHours.closed ? (
									<p style={{ fontSize:15,fontWeight:700,color:"#475569" }}>{T.closed}</p>
								) : (
									<>
										<p style={{ fontSize:15,fontWeight:700,marginBottom:4 }}>
											{fmt12(todayHours.open)} – {fmt12(todayHours.close)}
										</p>
										<div style={{ display:"inline-flex",alignItems:"center",gap:5,background:isOpenNow?"rgba(16,185,129,0.12)":"rgba(71,85,105,0.2)",border:`1px solid ${isOpenNow?"rgba(16,185,129,0.3)":"rgba(71,85,105,0.3)"}`,borderRadius:20,padding:"3px 10px" }}>
											<div style={{ width:5,height:5,borderRadius:"50%",background:isOpenNow?"#10b981":"#475569",animation:isOpenNow?"pulse 1.5s ease-in-out infinite":"none" }} />
											<span style={{ fontSize:10,fontWeight:700,color:isOpenNow?"#10b981":"#475569" }}>{isOpenNow ? T.openNow : T.closedNow}</span>
										</div>
									</>
								)}
							</div>
						</div>
						{/* Full week */}
						<div style={{ borderRadius:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden" }}>
							{[0,1,2,3,4,5,6].map(d => {
								const h: DayHours = weeklyHours[d] ?? { open:"09:00",close:"19:00",closed:false };
								const isToday = d === todayIdx;
								return (
									<div key={d} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 18px",borderBottom:d<6?"1px solid rgba(255,255,255,0.04)":"none",background:isToday?"rgba(249,115,22,0.06)":"transparent" }}>
										<span style={{ fontSize:13,fontWeight:isToday?700:400,color:isToday?"#fb923c":"#94a3b8",width:90 }}>{DAY[d]}</span>
										<span style={{ fontSize:13,color:h.closed?"#475569":"white",fontWeight:isToday?600:400 }}>
											{h.closed ? T.closed : `${fmt12(h.open)} – ${fmt12(h.close)}`}
										</span>
									</div>
								);
							})}
						</div>
					</>
				)}

				{/* TODAY's BARBERS */}
				{todayBarbers.length > 0 && (
					<div style={{ padding:"20px",borderRadius:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)" }}>
						<p style={{ fontSize:10,color:"#475569",letterSpacing:"0.12em",marginBottom:8 }}>TODAY</p>
						<p style={{ fontSize:15,fontWeight:700,marginBottom:4 }}>
							{todayBarbers.length} {todayBarbers.length !== 1 ? T.barbers : T.barber}
						</p>
						<p style={{ fontSize:13,color:"#64748b" }}>{todayBarbers.map(b => b.name).join(", ")}</p>
					</div>
				)}

				{/* TEAM */}
				{allBarbers.length > 0 && (
					<>
						<div className="divider fi fi-3"><div /><span>{T.team}</span><div /></div>
						<div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12 }}>
							{allBarbers.map(barber => {
								const workDays = JSON.parse(barber.workDays ?? "[0,1,2,3,4,5,6]") as number[];
								const availToday = workDays.includes(todayIdx) && !barber.onVacation;
								return (
									<div key={barber.id} className="barber-card">
										{/* Photo */}
										{barber.photoUrl ? (
											<img src={barber.photoUrl} alt={barber.name} style={{ width:68,height:68,borderRadius:"50%",objectFit:"cover",margin:"0 auto 12px",border:"2px solid rgba(249,115,22,0.3)",display:"block" }} />
										) : (
											<div style={{ width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,rgba(249,115,22,0.2),rgba(234,88,12,0.15))",border:"2px solid rgba(249,115,22,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26 }}>
												✂️
											</div>
										)}
										<p style={{ fontSize:14,fontWeight:700,marginBottom:4 }}>{barber.name}</p>
										{barber.specialty && <p style={{ fontSize:11,color:"#64748b",marginBottom:10 }}>{barber.specialty}</p>}
										<div style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:availToday?"rgba(16,185,129,0.12)":"rgba(71,85,105,0.2)",color:availToday?"#10b981":"#475569",border:`1px solid ${availToday?"rgba(16,185,129,0.3)":"rgba(71,85,105,0.3)"}` }}>
											<div style={{ width:4,height:4,borderRadius:"50%",background:availToday?"#10b981":"#475569" }} />
											{availToday ? T.available : T.off}
										</div>
										{/* Work days */}
										<div style={{ display:"flex",gap:3,justifyContent:"center",marginTop:10,flexWrap:"wrap" }}>
											{DAY.map((d,i) => (
												<span key={i} style={{ width:22,height:22,borderRadius:6,fontSize:8,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",background:workDays.includes(i)?"rgba(249,115,22,0.2)":"rgba(255,255,255,0.03)",color:workDays.includes(i)?"#f97316":"#334155",border:`1px solid ${workDays.includes(i)?"rgba(249,115,22,0.3)":"transparent"}` }}>
													{d[0]}
												</span>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</>
				)}

				{/* FOOTER */}
				<div style={{ borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:28,textAlign:"center",marginTop:48 }}>
					<div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:6 }}>
						<div style={{ width:20,height:20,borderRadius:6,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10 }}>✂️</div>
						<span style={{ fontSize:12,color:"#64748b" }}>{T.poweredBy} <span style={{ color:"#f97316",fontWeight:700 }}>NextUp</span></span>
					</div>
					<p style={{ fontSize:11,color:"#334155" }}>{T.poweredSub}</p>
				</div>
			</div>
		</div>
	);
}
