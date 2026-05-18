"use client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { getActiveBarbers, getShopPublicFull, getShopLogo } from "@/lib/server-fns";

export const Route = createFileRoute("/biz/$shopId")({ component: BizPage });

function t12(s: string) {
	const [h, m] = s.split(":").map(Number);
	return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const DAYS_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function isOpen(wh: any, today: number) {
	const h = wh?.[today];
	if (!h || h.closed) return false;
	try {
		const now = new Date();
		const nowM = now.getHours() * 60 + now.getMinutes();
		const [oH, oM] = (h.open || "09:00").split(":").map(Number);
		const [cH, cM] = (h.close || "18:00").split(":").map(Number);
		const openM = oH * 60 + oM;
		let closeM = cH * 60 + cM;
		if (closeM < openM) closeM += 1440;
		return nowM >= openM && nowM < closeM;
	} catch { return false; }
}

export default function BizPage() {
	const { shopId } = Route.useParams();
	const id = Number(shopId);
	const [lang, setLang] = useState<"en" | "es">("en");
	const [scrollY, setScrollY] = useState(0);
	const [activeBarber, setActiveBarber] = useState(0);
	const [imgError, setImgError] = useState<Record<number, boolean>>({});
	const [reviewMode, setReviewMode] = useState(false);
	const [voted, setVoted] = useState<"complaint"|"review"|null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("review") === "1") setReviewMode(true);
	}, []);
	const heroRef = useRef<HTMLDivElement>(null);

	const { data: shop, isLoading } = useQuery({ queryKey: ["spf", id], queryFn: () => getShopPublicFull({ data: { shopId: id } }) });
	const { data: logo } = useQuery({ queryKey: ["logo", id], queryFn: () => getShopLogo({ data: { shopId: id } }), enabled: !!shop });
	const { data: barbers } = useQuery({ queryKey: ["ab", id], queryFn: () => getActiveBarbers({ data: { shopId: id } }), enabled: !!shop });

	useEffect(() => {
		const onScroll = () => setScrollY(window.scrollY);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const wh = shop?.weeklyHours ? JSON.parse(shop.weeklyHours) : null;
	const [translatedMsg, setTranslatedMsg] = useState<string>("");

	// Translate welcome message when shop loads or lang changes to ES
	useEffect(() => {
		const msgEn = shop?.welcomeMessageEn;
		if (!msgEn || lang !== "es") return;
		setTranslatedMsg("..."); // show loading
		fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(msgEn) + "&langpair=en%7Ces")
			.then(r => r.json())
			.then((d: any) => {
				const t = d?.responseData?.translatedText;
				setTranslatedMsg(t && t.length > 3 ? t : msgEn);
			})
			.catch(() => setTranslatedMsg(msgEn));
	}, [lang, shop?.welcomeMessageEn]);
	const today = new Date().getDay();
	const open = isOpen(wh, today);
	const todayH = wh?.[today];
	const navSolid = scrollY > 50;
	const currentBarber = barbers?.[activeBarber];

	if (reviewMode && shop) {
		const waNum = (shop as any).whatsappNumber;
		const waUrl = waNum ? "https://wa.me/" + waNum.replace(/[^0-9]/g,"") + "?text=" + encodeURIComponent(lang === "es" ? "Hola, tengo un comentario sobre " + shop.name : "Hello, I have a comment about " + shop.name) : null;
		const R = lang === "es" ? {
			title:"¿Cómo fue tu experiencia?",sub:"Tu opinión nos importa",
			c1:"Tengo una queja",c1s:"Hablar con el propietario por WhatsApp",
			c2:"¡Estoy complacido! Dejar reseña",c2s:"Compartir en Google Reviews",
			t1:"Gracias por hacérnoslo saber",m1:"El propietario te contactará pronto.",
			t2:"¡Muchas gracias!",m2:"Tu reseña nos ayuda a crecer.",
		} : {
			title:"How was your experience?",sub:"Your opinion matters to us",
			c1:"I have a complaint",c1s:"Talk to the owner on WhatsApp",
			c2:"I'm happy! Leave a review",c2s:"Share on Google Reviews",
			t1:"Thank you for letting us know",m1:"The owner will contact you shortly.",
			t2:"Thank you so much!",m2:"Your review helps us grow.",
		};
		return (
			<div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f8faff,#fff,#f0f7ff)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 16px",fontFamily:"system-ui,sans-serif"}}>
				<style>{`.rv-btn{transition:all 0.2s;cursor:pointer;border:none;background:transparent;width:100%;text-align:left}.rv-btn:hover{transform:translateY(-2px)}`}</style>
				<div style={{position:"fixed",top:16,right:16,display:"flex",gap:6,zIndex:100}}>
					{(["en","es"] as const).map(l=><button key={l} type="button" onClick={()=>setLang(l)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:lang===l?"#4285F4":"rgba(0,0,0,0.06)",color:lang===l?"white":"#5f6368"}}>{l.toUpperCase()}</button>)}
				</div>
				<div style={{width:"100%",maxWidth:400}}>
					<div style={{background:"white",borderRadius:24,boxShadow:"0 4px 24px rgba(0,0,0,0.08)",padding:"28px 24px",marginBottom:16,textAlign:"center"}}>
						<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
							<svg width="26" height="26" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.1 34.8 29.5 38 24 38c-7.7 0-14-6.3-14-14s6.3-14 14-14c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 11.3 1 1 11.3 1 24s10.3 23 23 23c12.9 0 22-9.1 22-23 0-1.5-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.2 16 19.3 13 24 13c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 16.3 1 9.7 5.6 6.3 14.7z"/><path fill="#FBBC05" d="M24 47c5.7 0 10.9-1.9 14.9-5.1l-6.9-5.7C29.8 38 27 39 24 39c-5.5 0-10.2-3.3-12.2-8L5 36.2C8.5 43 15.7 47 24 47z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.5-2.6 4.6-4.8 6l6.9 5.7C42.3 36.7 45 30.8 45 24c0-1.5-.2-2.7-.5-4z"/></svg>
							<span style={{fontSize:16,fontWeight:600,color:"#3c4043"}}>Google Reviews</span>
						</div>
						{logo && <img src={logo} alt={shop.name} style={{width:52,height:52,borderRadius:13,objectFit:"cover",margin:"0 auto 10px",display:"block",border:"2px solid #f1f3f4"}}/>}
						<h1 style={{fontSize:19,fontWeight:700,color:"#202124",marginBottom:4}}>{shop.name}</h1>
						<p style={{fontSize:13,color:"#5f6368"}}>{R.sub}</p>
						<div style={{display:"flex",justifyContent:"center",gap:3,marginTop:10}}>{[1,2,3,4,5].map(s=><span key={s} style={{fontSize:20,color:"#FBBC05"}}>★</span>)}</div>
					</div>
					<h2 style={{textAlign:"center",fontSize:16,fontWeight:600,color:"#202124",marginBottom:14}}>{R.title}</h2>
					{voted === null ? (
						<div style={{display:"flex",flexDirection:"column",gap:12}}>
							{waUrl && <button type="button" className="rv-btn" onClick={()=>{setVoted("complaint");setTimeout(()=>window.open(waUrl,"_blank"),300);}}>
								<div style={{background:"white",borderRadius:18,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",padding:"16px 20px",display:"flex",alignItems:"center",gap:14,border:"2px solid transparent"}} onMouseEnter={e=>(e.currentTarget.style.borderColor="#25D366")} onMouseLeave={e=>(e.currentTarget.style.borderColor="transparent")}>
									<div style={{width:46,height:46,borderRadius:13,background:"linear-gradient(135deg,#25D366,#128C7E)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
										<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.845L.057 23.887a.5.5 0 0 0 .616.616l6.04-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.888 9.888 0 0 1-5.035-1.375l-.361-.214-3.733.907.923-3.635-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.532 6.532 2.1 12 2.1S21.9 6.532 21.9 12 17.468 21.9 12 21.9z"/></svg>
									</div>
									<div><p style={{fontSize:15,fontWeight:700,color:"#202124",marginBottom:2}}>{R.c1}</p><p style={{fontSize:12,color:"#5f6368"}}>{R.c1s}</p></div>
									<span style={{marginLeft:"auto",color:"#bdc1c6",fontSize:18}}>›</span>
								</div>
							</button>}
							{shop.googleReviewLink && <button type="button" className="rv-btn" onClick={()=>{setVoted("review");setTimeout(()=>window.open(shop.googleReviewLink!,"_blank"),300);}}>
								<div style={{background:"white",borderRadius:18,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",padding:"16px 20px",display:"flex",alignItems:"center",gap:14,border:"2px solid transparent"}} onMouseEnter={e=>(e.currentTarget.style.borderColor="#4285F4")} onMouseLeave={e=>(e.currentTarget.style.borderColor="transparent")}>
									<div style={{width:46,height:46,borderRadius:13,background:"white",border:"2px solid #e8eaed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
										<svg width="22" height="22" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.1 34.8 29.5 38 24 38c-7.7 0-14-6.3-14-14s6.3-14 14-14c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 11.3 1 1 11.3 1 24s10.3 23 23 23c12.9 0 22-9.1 22-23 0-1.5-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.2 16 19.3 13 24 13c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 16.3 1 9.7 5.6 6.3 14.7z"/><path fill="#FBBC05" d="M24 47c5.7 0 10.9-1.9 14.9-5.1l-6.9-5.7C29.8 38 27 39 24 39c-5.5 0-10.2-3.3-12.2-8L5 36.2C8.5 43 15.7 47 24 47z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.5-2.6 4.6-4.8 6l6.9 5.7C42.3 36.7 45 30.8 45 24c0-1.5-.2-2.7-.5-4z"/></svg>
									</div>
									<div><p style={{fontSize:15,fontWeight:700,color:"#202124",marginBottom:2}}>{R.c2}</p><p style={{fontSize:12,color:"#5f6368"}}>{R.c2s}</p></div>
									<span style={{marginLeft:"auto",color:"#bdc1c6",fontSize:18}}>›</span>
								</div>
							</button>}
						</div>
					) : (
						<div style={{background:"white",borderRadius:24,boxShadow:"0 4px 24px rgba(0,0,0,0.08)",padding:"36px 24px",textAlign:"center"}}>
							<div style={{width:54,height:54,borderRadius:"50%",background:voted==="review"?"#E8F5E9":"#E3F2FD",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
								<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={voted==="review"?"#22c55e":"#4285F4"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
							</div>
							<h2 style={{fontSize:19,fontWeight:700,color:"#202124",marginBottom:8}}>{voted==="review"?R.t2:R.t1}</h2>
							<p style={{fontSize:14,color:"#5f6368",lineHeight:1.6}}>{voted==="review"?R.m2:R.m1}</p>
						</div>
					)}
					<p style={{textAlign:"center",fontSize:11,color:"#bdc1c6",marginTop:20}}>Powered by Goolinext</p>
				</div>
			</div>
		);
	}

	if (isLoading) return (
		<div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
			<div style={{ width: 40, height: 40, border: "2px solid rgba(255,255,255,0.05)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
			<style>{`@keyframes spin{to{transform:rotate(360deg)}}
				`}</style>
		</div>
	);
	if (!shop) return null;

	return (
		<div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", fontFamily: "'Inter',system-ui,sans-serif", overflowX: "hidden" }}>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
				*{box-sizing:border-box;margin:0;padding:0}
				html{scroll-behavior:smooth}
				::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0a0a0a}::-webkit-scrollbar-thumb{background:#333}
				@keyframes spin{to{transform:rotate(360deg)}}
				
				@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
				@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
				@keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6px)}}
				@keyframes slideRight{from{width:0}to{width:100%}}
				.a1{animation:fadeUp 0.7s ease 0.1s both}
				.a2{animation:fadeUp 0.7s ease 0.2s both}
				.a3{animation:fadeUp 0.7s ease 0.35s both}
				.a4{animation:fadeUp 0.7s ease 0.5s both}
				.a5{animation:fadeUp 0.7s ease 0.65s both}
				.barber-tab{transition:all 0.25s ease;cursor:pointer;border:none;background:transparent;text-align:left;width:100%}
				.barber-tab:hover .tab-name{color:white!important}
				.cta1{display:inline-block;transition:all 0.3s ease;text-decoration:none}
				.cta1:hover{transform:scale(1.03)}
				.cta2{transition:all 0.3s ease;cursor:pointer}
				.cta2:hover{background:rgba(255,255,255,0.1)!important;border-color:rgba(255,255,255,0.3)!important}
				.stat-card{transition:all 0.3s ease}
				.stat-card:hover{background:rgba(255,255,255,0.06)!important;border-color:rgba(255,255,255,0.15)!important}
				.day-item{transition:background 0.2s ease}
				.day-item:hover{background:rgba(255,255,255,0.03)!important}
				@media(max-width:768px){
					.two-col{grid-template-columns:1fr!important}
					.hero-title{font-size:clamp(3rem,15vw,5rem)!important}
					.stats-grid{grid-template-columns:repeat(2,1fr)!important}
				}
			`}</style>

			{/* NAV */}
			<nav style={{
				position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
				display: "flex", alignItems: "center", justifyContent: "space-between",
				padding: "0 clamp(20px,5vw,64px)", height: 64,
				background: navSolid ? "rgba(10,10,10,0.92)" : "transparent",
				backdropFilter: navSolid ? "blur(20px)" : "none",
				borderBottom: navSolid ? "1px solid rgba(255,255,255,0.06)" : "none",
				transition: "all 0.3s ease",
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					{logo
						? <img src={logo} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} alt="" />
						: <div style={{ width: 32, height: 32, borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0a0a", fontWeight: 800, fontSize: 14 }}>{shop.name[0]}</div>
					}
					<span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>{shop.name}</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{open && (
						<div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
							<div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s ease infinite" }} />
							<span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{lang === "en" ? "Open" : "Abierto"}</span>
						</div>
					)}
					<button onClick={() => setLang(l => l === "en" ? "es" : "en")} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#a8997a", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>
						{lang === "en" ? "ES" : "EN"}
					</button>
				</div>
			</nav>

			{/* ── HERO ── */}
			<section ref={heroRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 clamp(20px,5vw,64px) 80px", position: "relative", overflow: "hidden" }}>
				{/* Background texture */}
				<div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(255,255,255,0.03) 0%, transparent 70%)" }} />
				<div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "48px 48px", opacity: 0.5 }} />
				{/* Big background number */}
				<div style={{ position: "absolute", right: "5%", top: "50%", transform: "translateY(-50%)", fontSize: "clamp(200px,40vw,500px)", fontWeight: 900, color: "rgba(255,255,255,0.02)", lineHeight: 1, userSelect: "none", letterSpacing: "-0.05em" }}>01</div>

				<div style={{ position: "relative", zIndex: 2, maxWidth: 1000 }}>
					{/* Top label */}
					<div className="a1" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
						<div style={{ width: 32, height: 1, background: "#8a9bb5" }} />
						<span style={{ fontSize: 11, fontWeight: 600, color: "#a8997a", letterSpacing: 3, textTransform: "uppercase" }}>
							{barbers?.length || 0} {lang === "en" ? "specialists" : "especialistas"}
						</span>
					</div>

					{/* Title */}
					<h1 className="a2 hero-title" style={{ fontSize: "clamp(4rem,12vw,9rem)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 32, textTransform: "uppercase" }}>
						{shop.name}
					</h1>

					{/* Tagline row */}
					<div className="a3" style={{ display: "flex", alignItems: "flex-start", gap: 40, flexWrap: "wrap", marginBottom: 48 }}>
						<div style={{ width: 1, height: 60, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
						<p style={{ fontSize: "clamp(14px,2vw,17px)", fontWeight: 300, color: "#a8997a", maxWidth: 380, lineHeight: 1.7 }}>
							{(() => { const msg = lang === "en" ? (shop.welcomeMessageEn || "Where precision meets passion. The finest cuts, the best experience.") : (translatedMsg || shop.welcomeMessage || shop.welcomeMessageEn || "Donde la precisión se une a la pasión. Los mejores cortes, la mejor experiencia."); return msg; })()}
						</p>
					</div>

					{/* CTA row */}
					<div className="a4" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
						{shop.googleReviewLink && (
							<a href={shop.googleReviewLink} target="_blank" rel="noopener noreferrer" className="cta1"
								style={{ padding: "14px 32px", background: "white", color: "#0a0a0a", fontWeight: 700, fontSize: 13, borderRadius: 8, letterSpacing: "-0.01em" }}>
								★ {lang === "en" ? "Leave a Review" : "Dejar Reseña"}
							</a>
						)}
						<button onClick={() => document.getElementById("team-sec")?.scrollIntoView({ behavior: "smooth" })}
							className="cta2"
							style={{ padding: "14px 32px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", fontWeight: 500, fontSize: 13, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
							{lang === "en" ? "Meet the team" : "Conocer el equipo"} ↓
						</button>
					</div>
				</div>

				{/* Scroll indicator */}
				<div className="a5" style={{ position: "absolute", right: "clamp(20px,5vw,64px)", bottom: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "float 2s ease infinite" }}>
					<div style={{ width: 1, height: 48, background: "linear-gradient(to bottom,white,transparent)", opacity: 0.2 }} />
				</div>
			</section>

			{/* ── STATS BAR ── */}
			<section style={{ padding: "0 clamp(20px,5vw,64px)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
				<div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", maxWidth: 1100, margin: "0 auto" }}>
					{[
						{ n: barbers?.length || 0, label: lang === "en" ? "Specialists" : "Especialistas" },
						{ n: "7", label: lang === "en" ? "Days a week" : "Días a la semana" },
						{ n: "★★★★★", label: lang === "en" ? "Rated" : "Calificado", isStars: true },
						{ n: open ? "●" : "○", label: open ? (lang === "en" ? "Open now" : "Abierto ahora") : (lang === "en" ? "Currently closed" : "Cerrado ahora"), isDot: true, open },
					].map((s, i) => (
						<div key={i} className="stat-card" style={{ padding: "28px 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", display: "flex", flexDirection: "column", gap: 6, background: "transparent" }}>
							<p style={{ fontSize: s.isStars ? 18 : 32, fontWeight: s.isStars ? 400 : 800, letterSpacing: s.isStars ? "0.1em" : "-0.04em", color: s.isDot ? (s.open ? "#22c55e" : "#8a9bb5") : "white", lineHeight: 1 }}>{s.n}</p>
							<p style={{ fontSize: 11, fontWeight: 500, color: "#8a9bb5", letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</p>
						</div>
					))}
				</div>
			</section>

			{/* ── TEAM ── */}
			{barbers && barbers.length > 0 && (
				<section id="team-sec" style={{ padding: "100px clamp(20px,5vw,64px)", position: "relative" }}>
					<div style={{ maxWidth: 1100, margin: "0 auto" }}>
						<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 56, flexWrap: "wrap", gap: 16 }}>
							<h2 style={{ fontSize: "clamp(2rem,5vw,4rem)", fontWeight: 800, letterSpacing: "-0.04em", textTransform: "uppercase" }}>
								{lang === "en" ? "The Team" : "El Equipo"}
							</h2>
							<p style={{ fontSize: 12, color: "#8a9bb5", fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>
								{lang === "en" ? "Select a specialist" : "Selecciona un especialista"}
							</p>
						</div>

						<div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
							{/* Photo panel */}
							<div style={{ position: "sticky", top: 80 }}>
								<div style={{ aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", position: "relative", background: "#111" }}>
									{currentBarber?.photoUrl && !imgError[activeBarber]
										? <img
												src={currentBarber.photoUrl}
												alt={currentBarber.name}
												onError={() => setImgError(p => ({ ...p, [activeBarber]: true }))}
												style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", imageRendering: "auto" }}
												loading="eager"
											/>
										: <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#111,#1a1a1a)" }}>
												<div style={{ textAlign: "center" }}>
													<div style={{ fontSize: 64, marginBottom: 12, opacity: 0.15 }}>✂</div>
													<p style={{ fontSize: 14, fontWeight: 600, color: "#6b7a8d", textTransform: "uppercase", letterSpacing: 2 }}>{currentBarber?.name}</p>
												</div>
											</div>
									}
									<div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(10,10,10,0.98) 0%,rgba(10,10,10,0.4) 35%,transparent 60%)" }} />
									<div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px" }}>
										<p style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 1 }}>{currentBarber?.name}</p>
										{currentBarber?.specialty && <p style={{ fontSize: 11, color: "#a8997a", letterSpacing: 2, textTransform: "uppercase", marginTop: 8, fontWeight: 500 }}>{currentBarber.specialty}</p>}
									</div>
									{/* Top-right number */}
									<div style={{ position: "absolute", top: 16, right: 20, fontSize: 13, fontWeight: 700, color: "#7a8ba0", letterSpacing: 1 }}>
										{String(activeBarber + 1).padStart(2, "0")} / {String(barbers.length).padStart(2, "0")}
									</div>
								</div>
							</div>

							{/* List panel */}
							<div style={{ display: "flex", flexDirection: "column" }}>
								{barbers.map((b: any, i: number) => (
									<button key={b.id} type="button" className="barber-tab"
										onClick={() => setActiveBarber(i)}
										style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: i === activeBarber ? "rgba(255,255,255,0.04)" : "transparent" }}>
										{/* Index number */}
										<span style={{ fontSize: 11, fontWeight: 700, color: i === activeBarber ? "white" : "#6b7a8d", letterSpacing: 1, minWidth: 24 }}>
											{String(i + 1).padStart(2, "0")}
										</span>
										{/* Photo */}
										<div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: i === activeBarber ? "2px solid white" : "2px solid rgba(255,255,255,0.1)" }}>
											{b.photoUrl && !imgError[i]
												? <img src={b.photoUrl} onError={() => setImgError(p => ({ ...p, [i]: true }))} loading="eager" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", imageRendering: "auto" }} alt={b.name} />
												: <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#6b7a8d" }}>{b.name[0]}</div>
											}
										</div>
										{/* Info */}
										<div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
											<p className="tab-name" style={{ fontWeight: 700, fontSize: 15, color: i === activeBarber ? "white" : "#a8997a", textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>{b.name}</p>
											{b.specialty && <p style={{ fontSize: 10, fontWeight: 500, color: "#7a8ba0", letterSpacing: 2, textTransform: "uppercase" }}>{b.specialty}</p>}
										</div>
										{/* Arrow */}
										<span style={{ fontSize: 14, color: i === activeBarber ? "white" : "rgba(255,255,255,0.2)", transition: "all 0.3s", transform: i === activeBarber ? "translateX(4px)" : "none" }}>→</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</section>
			)}

			{/* ── HOURS + MAP ── */}
			<section style={{ padding: "80px clamp(20px,5vw,64px) 100px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
				<div style={{ maxWidth: 1100, margin: "0 auto" }}>
					<div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>

						{/* Hours */}
						{wh && (
							<div>
								<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 36 }}>
									<h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 800, letterSpacing: "-0.04em", textTransform: "uppercase" }}>
										{lang === "en" ? "Hours" : "Horarios"}
									</h2>
									<span style={{ fontSize: 11, fontWeight: 600, color: open ? "#22c55e" : "#7a8ba0", letterSpacing: 1, textTransform: "uppercase" }}>
										{open ? (lang === "en" ? "● Open now" : "● Abierto") : (lang === "en" ? "○ Closed" : "○ Cerrado")}
									</span>
								</div>
								<div>
									{(lang === "en" ? DAYS_EN : DAYS_ES).map((day, i) => {
										const h = wh[i]; const isToday = i === today;
										return (
											<div key={i} className="day-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: isToday ? "rgba(255,255,255,0.03)" : "transparent" }}>
												<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
													{isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />}
													<span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "white" : "#a8997a", marginLeft: isToday ? 0 : 14 }}>{day}</span>
												</div>
												<span style={{ fontSize: 12, fontWeight: isToday ? 600 : 400, color: h?.closed ? "rgba(255,255,255,0.18)" : isToday ? "white" : "#a8997a" }}>
													{h?.closed ? (lang === "en" ? "Closed" : "Cerrado") : `${t12(h?.open || "09:00")} – ${t12(h?.close || "18:00")}`}
												</span>
											</div>
										);
									})}
								</div>
								{todayH && !todayH.closed && (
									<div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10 }}>
										<p style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
											{lang === "en" ? `Today: ${t12(todayH.open)} – ${t12(todayH.close)}` : `Hoy: ${t12(todayH.open)} – ${t12(todayH.close)}`}
										</p>
									</div>
								)}
							</div>
						)}

						{/* Location */}
						<div>
							<h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 800, letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: 36 }}>
								{lang === "en" ? "Location" : "Ubicación"}
							</h2>
							{shop.address && (
								<>
									<p style={{ fontSize: 15, fontWeight: 400, color: "#a8997a", lineHeight: 1.8, marginBottom: 8 }}>{shop.address}</p>
									{shop.phone && <p style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 24 }}>{shop.phone}</p>}
									<div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
										<iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(shop.address)}&output=embed&z=15`}
											width="100%" height="220" style={{ border: "none", display: "block", filter: "grayscale(100%) contrast(90%) brightness(0.8)" }} loading="lazy" title="map" />
									</div>
								</>
							)}
							{shop.googleReviewLink && (
								<a href={shop.googleReviewLink} target="_blank" rel="noopener noreferrer"
									style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textDecoration: "none", transition: "all 0.3s ease", background: "rgba(255,255,255,0.03)" }}
									className="cta2">
									★ {lang === "en" ? "Google Reviews" : "Reseñas Google"}
								</a>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* ── FOOTER ── */}
			<footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px clamp(20px,5vw,64px)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					{logo
						? <img src={logo} style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover", opacity: 0.5 }} alt="" />
						: <div style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#8a9bb5" }}>{shop.name[0]}</div>
					}
					<span style={{ fontSize: 11, fontWeight: 600, color: "#6b7a8d", letterSpacing: 2, textTransform: "uppercase" }}>{shop.name}</span>
				</div>
				<p style={{ fontSize: 10, color: "#4a5568", letterSpacing: 2, textTransform: "uppercase" }}>Powered by Goolinext</p>
			</footer>
		</div>
	);
}
