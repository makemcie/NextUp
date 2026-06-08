import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	BarChart2,
	Bell,
	CalendarCheck,
	Camera,
	Check,
	ChevronRight,
	Clock,
	Copy,
	Database,
	Download,
	Globe,
	KeyRound,
	List,
	Lock,
	Mail,
	Palmtree,
	Pencil,
	Plus,
	QrCode,
	RefreshCw,
	
	Search,
	Settings,
	Shield,
	Star,
	Store,
	Trash2,
	User,
	UserCheck,
	Users,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, bp, dash, type Lang } from "@/lib/i18n";
import {
	barberCallNext,
	barberCancelVisit,
	barberCompleteClient,
	callNextClient,
	cancelQueueEntry,
	checkAuth,
	claimBarberAccess,
	completeClient,
	createBarber,
	createShop,
	deleteBarber,
	deleteClient,
	exportClientsCSV,
	getBarbers,
	getDashboardStats,
	getMyBarberQueue,
	getMyRole,
	getMyShop,
	getRecoveryInfo,
	getShopClients,
	getShopQueues,
	login,
	logout,
	processFollowUps,
	processReminders,
	regenerateBarberCode,
	resetPassword,
	setBarberOverride,
	signup,
	toggleBarberVacation,
	unlinkBarber,
	updateBarberPhoto,
	updateBarberSchedule,
	updateClient,
	updateMyBarberPhoto,
	updateShop,
	sendSupportEmail,
	createCheckoutSession,
	getSubscriptionStatus,
	cancelSubscription,
	getAvailableSlots,
	updateOwnerPhone,
	getOwnerPhone,
	getDailyReport,
	getInactiveClients,
	updateClientCallStatus,
	updateShop as updateShopFn,
	getMonthlyReport,
	updateBarberPhone,
	toggleBarberDirectPayment,
	createStripeConnectLink,
	getShopStripeStatus,
	updateShopDepositSettings,
	getYearlyReport,
} from "@/lib/server-fns";
import { useWebSocket } from "@/lib/websocket";

export const Route = createFileRoute("/")({ component: AdminDashboard });

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


// ============ LANGUAGE TOGGLE ============

function getSavedLang(): Lang {
	if (typeof window === "undefined") return "en";
	const saved = localStorage.getItem("nextup_lang");
	if (saved === "es" || saved === "en") return saved;
	return "en";
}

function LangToggle({
	lang,
	setLang,
}: {
	lang: Lang;
	setLang: (l: Lang) => void;
}) {
	const toggle = () => {
		const next = lang === "es" ? "en" : "es";
		localStorage.setItem("nextup_lang", next);
		setLang(next);
	};
	return (
		<button
			type="button"
			onClick={toggle}
			className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
			title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
		>
			<Globe className="w-4 h-4" />
			<span className="uppercase font-medium">{lang}</span>
		</button>
	);
}

// ============ AUTH SCREEN ============

function AuthScreen({
	lang,
	setLang,
}: {
	lang: Lang;
	setLang: (l: Lang) => void;
}) {
	const t = auth[lang];
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<"signup" | "login" | "recovery">("signup");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [error, setError] = useState("");
	const [resetDone, setResetDone] = useState(false);

	const [recoveryEmail, setRecoveryEmail] = useState("");
	const [recoverySent, setRecoverySent] = useState(false);
	const [recoveryLoading, setRecoveryLoading] = useState(false);
	const [recoveryNotFound, setRecoveryNotFound] = useState(false);
	const [resetToken, setResetToken] = useState("");

	// Check for reset token in URL
	useEffect(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const token = params.get("reset");
			if (token) {
				setResetToken(token);
				setMode("recovery");
				window.history.replaceState({}, "", "/");
			}
		}
	}, []);

	const handleSendRecovery = async () => {
		if (!recoveryEmail.includes("@")) return;
		setRecoveryLoading(true);
		setRecoveryNotFound(false);
		try {
			const result = await getRecoveryInfo({ data: { email: recoveryEmail } });
			if (result?.found) {
				setRecoverySent(true);
			} else {
				setRecoveryNotFound(true);
			}
		} catch {} finally {
			setRecoveryLoading(false);
		}
	};

	const signupMutation = useMutation({
		mutationFn: () => signup({ data: { email, password } }),
		onSuccess: (result) => {
			if (!result.success) {
				setError(
					result.error === "EMAIL_EXISTS" ? t.emailExists : t.genericError,
				);
				return;
			}
			queryClient.invalidateQueries({ queryKey: ["checkAuth"] });
		},
		onError: () => setError(t.genericError),
	});

	const loginMutation = useMutation({
		mutationFn: () => login({ data: { email, password } }),
		onSuccess: (result) => {
			if (!result.success) {
				const errorMap: Record<string, string> = {
					INVALID_CREDENTIALS: t.invalidCredentials,
					ALREADY_LINKED: t.alreadyLinkedError,
				};
				setError(errorMap[result.error] || t.genericError);
				return;
			}
			queryClient.invalidateQueries({ queryKey: ["checkAuth"] });
		},
		onError: () => setError(t.genericError),
	});

	const resetMutation = useMutation({
		mutationFn: () => resetPassword({ data: { token: resetToken, newPassword } }),
		onSuccess: (result) => {
			if (!result.success) {
				setError(t.passwordTooShort);
				return;
			}
			setResetDone(true);
			setError("");
		},
		onError: () => setError(t.genericError),
	});

	const handleSubmit = () => {
		setError("");
		if (!email.trim() || !password) {
			setError(t.fillAll);
			return;
		}
		if (mode === "signup") {
			if (password !== confirmPassword) {
				setError(t.passwordMismatch);
				return;
			}
			if (password.length < 6) {
				setError(t.passwordTooShort);
				return;
			}
			signupMutation.mutate();
		} else {
			loginMutation.mutate();
		}
	};

	const handleReset = () => {
		setError("");
		if (!newPassword || !confirmNewPassword) {
			setError(t.fillAll);
			return;
		}
		if (newPassword !== confirmNewPassword) {
			setError(t.passwordMismatch);
			return;
		}
		if (newPassword.length < 6) {
			setError(t.passwordTooShort);
			return;
		}
		resetMutation.mutate();
	};

	const isPending = signupMutation.isPending || loginMutation.isPending;

	// ---- Recovery mode ----
	if (mode === "recovery") {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
				<div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
					<div className="flex justify-end mb-4">
						<LangToggle lang={lang} setLang={setLang} />
					</div>
					<div className="text-center mb-6">
						<div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
							<KeyRound className="w-8 h-8 text-white" />
						</div>
						<h1 className="text-2xl font-bold text-white">{t.recoveryTitle}</h1>
					</div>

					{resetToken && !resetDone ? (
						<div className="space-y-4">
							<p className="text-gray-400 text-sm text-center">{lang === "es" ? "Ingresa tu nueva contraseña" : "Enter your new password"}</p>
							<input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.newPasswordPlaceholder} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }} />
							<input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder={t.confirmNewPasswordPlaceholder} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }} />
							{error && <p className="text-red-400 text-sm text-center">{error}</p>}
							<button type="button" onClick={handleReset} disabled={resetMutation.isPending} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50">
								{resetMutation.isPending ? t.resetting : t.resetPassword}
							</button>
						</div>
					) : recoverySent ? (
						<div className="space-y-4 text-center">
							<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
								<Mail className="w-6 h-6 text-green-400" />
							</div>
							<p className="text-green-400 font-semibold">{lang === "es" ? "¡Email enviado!" : "Email sent!"}</p>
							<p className="text-gray-400 text-sm">{lang === "es" ? `Revisa tu correo ${recoveryEmail} y haz click en el link para restablecer tu contraseña.` : `Check your email ${recoveryEmail} and click the link to reset your password.`}</p>
							<button type="button" onClick={() => { setMode("login"); setRecoverySent(false); setRecoveryEmail(""); }} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 text-sm">
								<ArrowLeft className="w-4 h-4" />{t.backToLogin}
							</button>
						</div>
					) : resetDone ? (
						<div className="space-y-4 text-center">
							<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
								<Check className="w-6 h-6 text-green-400" />
							</div>
							<p className="text-green-400 text-sm">{t.resetSuccess}</p>
							<button type="button" onClick={() => { setMode("login"); setResetDone(false); setResetToken(""); setNewPassword(""); setConfirmNewPassword(""); setError(""); }} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all">
								{t.backToLogin}
							</button>
						</div>
					) : (
						<div className="space-y-4">
							<p className="text-gray-400 text-sm text-center">
								{lang === "es" ? "Ingresa tu correo y te enviaremos un link para restablecer tu contraseña" : "Enter your email and we will send you a link to reset your password"}
							</p>
							<input type="email" value={recoveryEmail} onChange={(e) => { setRecoveryEmail(e.target.value); setRecoveryNotFound(false); }} placeholder={t.emailPlaceholder} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" onKeyDown={(e) => { if (e.key === "Enter") handleSendRecovery(); }} />
							{recoveryNotFound && <p className="text-red-400 text-sm text-center">{lang === "es" ? "No encontramos una cuenta con ese correo" : "No account found with that email"}</p>}
							<button type="button" onClick={handleSendRecovery} disabled={!recoveryEmail.includes("@") || recoveryLoading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all">
								{recoveryLoading ? (lang === "es" ? "Enviando..." : "Sending...") : (lang === "es" ? "Enviar link de recuperación" : "Send reset link")}
							</button>
							<button type="button" onClick={() => { setMode("login"); setError(""); setRecoveryEmail(""); setRecoveryNotFound(false); }} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 text-sm">
								<ArrowLeft className="w-4 h-4" />{t.backToLogin}
							</button>
						</div>
					)}
				</div>
			</div>
		);
	}


	// ---- Signup / Login mode ----
	return (
		<div style={{ background:"#050507", fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif", position:"relative", overflowX:"hidden", minHeight:"100dvh" }}>
			<style>{`
				/* Responsive */
				@media(max-width:768px){
					.lhero{padding:56px 20px 48px!important}
					.a4{flex-direction:column!important;align-items:stretch!important}
					.a4 button{width:100%!important;text-align:center!important}
					.lstats{gap:28px!important}
					.lfeat-grid{grid-template-columns:1fr!important}
					.lfeat-card{flex-direction:column!important;gap:14px!important}
					.lsteps{grid-template-columns:1fr 1fr!important}
					.lprice-grid{grid-template-columns:1fr!important}
					.lprice-box{padding:32px 20px!important}
					.lauth-box{padding:28px 20px!important}
				}
				@media(max-width:480px){
					.lsteps{grid-template-columns:1fr!important}
					.lstats{gap:20px!important;justify-content:center!important}
				}
				*{box-sizing:border-box}
				@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.5)}}
				@keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
				.a1{animation:fade-up 0.5s ease both}
				.a2{animation:fade-up 0.5s 0.07s ease both}
				.a3{animation:fade-up 0.5s 0.14s ease both}
				.a4{animation:fade-up 0.5s 0.21s ease both}
				.a5{animation:fade-up 0.5s 0.28s ease both}
				.lfc{transition:transform 0.25s,border-color 0.25s}
				.lfc:hover{transform:translateY(-4px);border-color:rgba(249,115,22,0.3)!important}
				.lgb{transition:box-shadow 0.2s,transform 0.15s;cursor:pointer}
				.lgb:hover{box-shadow:0 0 40px rgba(249,115,22,0.4)!important;transform:translateY(-1px)}
				input:-webkit-autofill{-webkit-box-shadow:0 0 0 30px #0a0a10 inset!important;-webkit-text-fill-color:white!important}
			`}</style>

			{/* Background grid */}
			<div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(249,115,22,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,0.035) 1px,transparent 1px)", backgroundSize:"54px 54px", pointerEvents:"none", zIndex:0 }} />
			<div style={{ position:"fixed", top:0, left:0, right:0, height:650, background:"radial-gradient(ellipse 100% 60% at 50% -10%,rgba(249,115,22,0.1) 0%,transparent 70%)", pointerEvents:"none", zIndex:0 }} />

			{/* NAV */}
			<nav style={{ position:"sticky", top:0, zIndex:50, borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(5,5,7,0.88)", backdropFilter:"blur(18px)" }}>
				<div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px", height:62, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
					<div style={{ display:"flex", alignItems:"center", gap:10 }}>
						<div style={{ width:36, height:36, background:"linear-gradient(135deg,#f97316,#c2410c)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(249,115,22,0.3)" }}>
							<span style={{ fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif", fontWeight:800, fontSize:19, color:"white" }}>G</span>
						</div>
						<span style={{ fontWeight:800, fontSize:19, color:"white", letterSpacing:"-0.5px" }}>Goolinext</span>
					</div>
					<div style={{ display:"flex", gap:10, alignItems:"center" }}>
						<LangToggle lang={lang} setLang={setLang} />
						<button type="button" onClick={() => { setMode("login"); setError(""); document.getElementById("goolinext-auth")?.scrollIntoView({behavior:"smooth"}); }} style={{ padding:"7px 18px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, color:"#94a3b8", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
							{lang === "es" ? "Iniciar sesión" : "Sign in"}
						</button>
						<button type="button" className="lgb" onClick={() => { setMode("signup"); setError(""); document.getElementById("goolinext-auth")?.scrollIntoView({behavior:"smooth"}); }} style={{ padding:"7px 18px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:9, color:"white", fontSize:13, fontWeight:700, boxShadow:"0 4px 14px rgba(249,115,22,0.25)", fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif" }}>
							{lang === "es" ? "Empezar" : "Get started"}
						</button>
					</div>
				</div>
			</nav>

			{/* HERO */}
			<section style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"96px 24px 80px", textAlign:"center" }}>
				<div className="a1" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 16px", background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.2)", borderRadius:100, marginBottom:28 }}>
					<div style={{ width:6, height:6, borderRadius:"50%", background:"#f97316", animation:"pulse-dot 1.8s ease infinite" }} />
					<span style={{ color:"#f97316", fontSize:11, fontWeight:700, letterSpacing:"0.1em" }}>{lang === "es" ? "La Nueva Forma de Controlar tu Negocio" : "THE #1 BARBERSHOP MANAGEMENT PLATFORM"}</span>
				</div>
				<h1 className="a2" style={{ fontSize:"clamp(44px,7vw,82px)", fontWeight:800, color:"white", lineHeight:1.02, letterSpacing:"-3px", margin:"0 0 22px" }}>
					{lang === "es" ? "Todo tu Negocio en" : "Your Entire Business"}<br/>
					<span style={{ background:"linear-gradient(135deg,#f97316 20%,#fbbf24 80%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
						{lang === "es" ? "un Solo Sistema." : "in One System."}
					</span>
				</h1>
				<p className="a3" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:"clamp(15px,2vw,18px)", color:"#64748b", maxWidth:600, margin:"0 auto 48px", lineHeight:1.8, fontWeight:300 }}>
					{lang === "es"
						? "Para barberías y negocios de belleza: organiza la fila de clientes en tiempo real, guarda contactos automáticamente, crea tu página web profesional, controla los ingresos de tu negocio y recupera ingresos perdidos sin complicaciones."
						: "For barbershops and beauty businesses: organize your client queue in real time, save contacts automatically, create your professional website, control your business income and recover lost revenue without the hassle."}
				</p>
				<div className="a4 lbtn-row" style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:60 }}>
					<button type="button" className="lgb" onClick={() => { setMode("signup"); setError(""); document.getElementById("goolinext-auth")?.scrollIntoView({behavior:"smooth"}); }} style={{ padding:"16px 40px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:12, color:"white", fontSize:16, fontWeight:700, boxShadow:"0 8px 28px rgba(249,115,22,0.3)", fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif" }}>
						{lang === "es" ? "Empieza ya — $89/mes" : "Start now — $89/mo"}
					</button>
					<button type="button" onClick={() => { setMode("login"); setError(""); document.getElementById("goolinext-auth")?.scrollIntoView({behavior:"smooth"}); }} style={{ padding:"16px 40px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"#94a3b8", fontSize:16, fontWeight:600, cursor:"pointer", fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif" }}>
						{lang === "es" ? "Ya tengo cuenta" : "I already have an account"}
					</button>
				</div>
				<div className="a5 lstats" style={{ display:"flex", gap:52, justifyContent:"center", flexWrap:"wrap" }}>
					{[["100%", lang === "es" ? "Automatizado" : "Automated"],["24/7", lang === "es" ? "En línea" : "Online"],["∞", lang === "es" ? "Clientes" : "Clients"],["$0", lang === "es" ? "Sin setup" : "Setup fee"]].map(([n,l],i) => (
						<div key={i} style={{ textAlign:"center" }}>
							<p style={{ fontSize:30, fontWeight:800, color:"white", lineHeight:1 }}>{n}</p>
							<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:12, color:"#475569", marginTop:6 }}>{l}</p>
						</div>
					))}
				</div>
			</section>

			{/* FEATURES 2x3 */}
			<section style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"72px 24px" }}>
				<div style={{ textAlign:"center", marginBottom:56 }}>
					<h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:800, color:"white", letterSpacing:"-2px", margin:"0 0 14px" }}>
						{lang === "es" ? "Un sistema. Control total." : "One system. Total control."}
					</h2>
					<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#475569", fontSize:16, maxWidth:480, margin:"0 auto" }}>
						{lang === "es" ? "Todo lo que necesitas para organizar tu negocio, atender más clientes y recuperar ventas perdidas — sin complicaciones." : "Every tool you need to run a modern barbershop — without the complexity."}
					</p>
				</div>
				<div className="lfeat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))", gap:20 }}>
					{[
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
							tag: lang === "es" ? "SIN CONFUSIÓN EN LA ESPERA" : "ZERO WAIT CONFUSION",
							title: lang === "es" ? "Cola Virtual Inteligente" : "Smart Virtual Queue",
							desc: lang === "es" ? "Los clientes escanean tu QR, entran a la fila desde su teléfono y siguen su turno en vivo. Atiende más rápido, sin desorden ni clientes esperando sin saber." : "Clients scan your QR, join from their phone, see wait time live and get an SMS when it's their turn. No crowded waiting rooms or missed calls.",
						},
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
							tag: lang === "es" ? "RECUPERA INGRESOS PERDIDOS" : "RECOVER LOST REVENUE",
							title: lang === "es" ? "Control Total de Ingresos" : "Full Revenue Control",
							desc: lang === "es" ? "Cada cliente que no vuelve es dinero perdido. Con Goolinext mantienes orden, guardas sus datos y conviertes más visitas en ingresos reales." : "Every client who doesn't return is lost money. With Goolinext you stay organized, save their data and turn more visits into real revenue.",
						},
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
							tag: lang === "es" ? "SIEMPRE A TU LADO" : "ALWAYS BY YOUR SIDE",
							title: lang === "es" ? "Soporte por WhatsApp" : "WhatsApp Support",
							desc: lang === "es" ? "Te ayudamos por WhatsApp en cualquier momento para configurar, resolver dudas y mantener tu negocio funcionando sin problemas." : "We help you on WhatsApp anytime to set up, solve questions and keep your business running smoothly.",
						},
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
							tag: lang === "es" ? "TU TIENDA DIGITAL" : "YOUR DIGITAL STOREFRONT",
							title: lang === "es" ? "Página Pública Profesional" : "Professional Public Page",
							desc: lang === "es" ? "Página premium con tu equipo, horarios, ubicación y botón de reserva. Compártela en Google Business, Instagram o WhatsApp. Los clientes te encuentran y reservan sin llamarte." : "Premium page with your team, hours, location and booking button. Share on Google Business, Instagram or WhatsApp. Clients find you and book without calling.",
						},
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
							tag: lang === "es" ? "VISIBILIDAD TOTAL DEL DUEÑO" : "FULL OWNER VISIBILITY",
							title: lang === "es" ? "Portal de Empleados" : "Team Management Portal",
							desc: lang === "es" ? "Cada empleado tiene su propio login y ve solo su cola. Tú ves todo — cada empleado, cada cliente, cada servicio. Transparencia total sin micromanagement." : "Each barber logs in and sees only their queue. You see everything — every staff member, every client, every service. Total transparency, zero micromanagement.",
						},
						{
							svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
							tag: lang === "es" ? "TU ACTIVO MÁS VALIOSO" : "YOUR MOST VALUABLE ASSET",
							title: lang === "es" ? "Base de Datos de Clientes" : "Client Database",
							desc: lang === "es" ? "Cada cliente guardado automáticamente con nombre, teléfono e historial. Exporta a CSV en cualquier momento. Sabe quiénes son tus mejores clientes y haz crecer tu negocio." : "Every client auto-saved with name, phone and visit history. Export to CSV anytime. Know your best clients and grow your business intelligently.",
						},
					].map((f, i) => (
						<div key={i} className="lfc lfeat-card" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:20, padding:"30px 28px", display:"flex", gap:20, alignItems:"flex-start" }}>
							<div style={{ width:52, height:52, minWidth:52, background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center" }}>{f.svg}</div>
							<div>
								<span style={{ display:"inline-block", padding:"2px 10px", background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:100, marginBottom:8 }}>
									<span style={{ color:"#f97316", fontSize:10, fontWeight:700, letterSpacing:"0.06em" }}>{f.tag}</span>
								</span>
								<h3 style={{ fontSize:18, fontWeight:800, color:"white", margin:"0 0 8px", letterSpacing:"-0.4px" }}>{f.title}</h3>
								<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#475569", lineHeight:1.75, margin:0 }}>{f.desc}</p>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* HOW IT WORKS */}
			<section style={{ position:"relative", zIndex:1, background:"rgba(249,115,22,0.025)", borderTop:"1px solid rgba(249,115,22,0.07)", borderBottom:"1px solid rgba(249,115,22,0.07)", padding:"72px 24px" }}>
				<div style={{ maxWidth:1100, margin:"0 auto" }}>
					<div style={{ textAlign:"center", marginBottom:56 }}>
						<h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:800, color:"white", letterSpacing:"-2px", margin:"0 0 12px" }}>
							{lang === "es" ? "Funcionando en minutos." : "Up and running in minutes."}
						</h2>
						<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#475569", fontSize:16 }}>
							{lang === "es" ? "Sin conocimientos técnicos. Sin configuraciones complicadas. Solo resultados." : "No technical knowledge needed. No complicated setup. Just results."}
						</p>
					</div>
					<div className="lsteps" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))", gap:28 }}>
						{[
							["01", lang === "es" ? "Crea tu cuenta" : "Create your account", lang === "es" ? "Regístrate con tu email en 2 minutos. Agrega el nombre, dirección y horarios de tu barbería." : "Sign up with your email in 2 minutes. Add your barbershop name, address and hours."],
							["02", lang === "es" ? "Configura tu equipo" : "Set up your team", lang === "es" ? "Agrega cada empleado con su nombre, teléfono y código de acceso único." : "Add each staff member with their name, phone and unique login code."],
							["03", lang === "es" ? "Sal en vivo al instante" : "Go live instantly", lang === "es" ? "Tu página pública y código QR están listos. Comparte el link — los clientes reservan de inmediato." : "Your public page and QR code are ready. Share the link — clients book immediately."],
							["04", lang === "es" ? "Goolinext hace el resto" : "Goolinext does the rest", lang === "es" ? "El sistema maneja la cola, las citas, los recordatorios y el seguimiento automáticamente." : "The system handles the queue, appointments, reminders and follow-ups automatically."],
						].map(([step,title,desc],i) => (
							<div key={i}>
								<div style={{ fontSize:52, fontWeight:800, color:"rgba(249,115,22,0.12)", lineHeight:1, marginBottom:8, letterSpacing:"-2px" }}>{step}</div>
								<h3 style={{ fontSize:16, fontWeight:700, color:"white", margin:"0 0 8px" }}>{title}</h3>
								<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#475569", lineHeight:1.7 }}>{desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* PRICING */}
			<section style={{ position:"relative", zIndex:1, maxWidth:680, margin:"0 auto", padding:"80px 24px", textAlign:"center" }}>
				<h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:800, color:"white", letterSpacing:"-2px", margin:"0 0 12px" }}>
					{lang === "es" ? "Un plan. Todo incluido." : "One plan. Everything included."}
				</h2>
				<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#475569", fontSize:16, marginBottom:44 }}>
					{lang === "es" ? "Sin costos ocultos. Sin límites. Sin compromisos a largo plazo." : "No hidden fees. No feature limits. No long-term commitment."}
				</p>
				<div className="lprice-box" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(249,115,22,0.18)", borderRadius:24, padding:"48px 40px", position:"relative", overflow:"hidden" }}>
					<div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% -20%,rgba(249,115,22,0.07) 0%,transparent 60%)" }} />
					<div style={{ position:"relative" }}>
						<div style={{ display:"inline-block", padding:"4px 14px", background:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.2)", borderRadius:100, marginBottom:20 }}>
							<span style={{ color:"#f97316", fontSize:11, fontWeight:700, letterSpacing:"0.1em" }}>GOOLINEXT PRO</span>
						</div>
						<div style={{ marginBottom:32 }}>
							<span style={{ fontSize:68, fontWeight:800, color:"white", letterSpacing:"-3px", lineHeight:1 }}>$89</span>
							<span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:17, color:"#475569" }}>{lang === "es" ? " / mes" : " / month"}</span>
						</div>
						<div className="lprice-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,180px),1fr))", gap:"10px 24px", textAlign:"left", maxWidth:440, margin:"0 auto 40px" }}>
							{[
								lang === "es" ? "Cola virtual en tiempo real" : "Real-time virtual queue",
								lang === "es" ? "Clientes se unen escaneando tu QR" : "Clients join by scanning your QR",
								lang === "es" ? "Seguimiento de turnos en vivo" : "Live turn tracking",
								lang === "es" ? "Página pública para tu negocio" : "Public page for your business",
								lang === "es" ? "Base de datos de clientes (exportable)" : "Client database (exportable)",
								lang === "es" ? "Generador de código QR listo para usar" : "Individual barber portals",
								lang === "es" ? "Control de flujo y organización del negocio" : "Flow control and business organization",
								lang === "es" ? "Visibilidad completa de tu operación" : "Full visibility of your operation",
								lang === "es" ? "Soporte personal por WhatsApp 24/7" : "WhatsApp priority support",
								lang === "es" ? "Clientes y empleados ilimitados" : "Unlimited clients and staff",
							].map((item,i) => (
								<p key={i} style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#64748b", display:"flex", alignItems:"center", gap:8, margin:0 }}>
									<span style={{ color:"#f97316" }}>✓</span>{item}
								</p>
							))}
						</div>
						<button type="button" className="lgb" onClick={() => { setMode("signup"); setError(""); document.getElementById("goolinext-auth")?.scrollIntoView({behavior:"smooth"}); }} style={{ padding:"17px 56px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:13, color:"white", fontSize:17, fontWeight:700, boxShadow:"0 8px 28px rgba(249,115,22,0.3)", fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif" }}>
							{lang === "es" ? "Empezar ahora" : "Get started now"}
						</button>
						<div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:20, padding:"12px 24px", background:"rgba(34,197,94,0.06)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:12, flexWrap:"wrap" }}>
							<span style={{ fontSize:18 }}>🛡️</span>
							<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#4ade80", fontSize:13, fontWeight:600, margin:0 }}>
								{lang === "es" ? "Garantía de 7 días — Si no estás satisfecho, te devolvemos tu dinero sin preguntas." : "7-Day Money-Back Guarantee — Not satisfied? Full refund, no questions asked."}
								{" "}<a href="/terms" style={{ color:"#86efac", fontSize:12, textDecoration:"underline" }}>{lang === "es" ? "Ver política" : "See policy"}</a>
							</p>
						</div>
						<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#334155", fontSize:12, marginTop:12 }}>
							{lang === "es" ? "Cancela cuando quieras" : "No credit card required to sign up · Cancel anytime"}
						</p>
					</div>
				</div>
			</section>

			{/* AUTH FORM */}
			<section id="goolinext-auth" style={{ position:"relative", zIndex:1, maxWidth:440, margin:"0 auto", padding:"0 24px 88px" }}>
				<div className="lauth-box" style={{ background:"rgba(10,10,16,0.98)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:22, padding:"38px 34px" }}>
					<div style={{ textAlign:"center", marginBottom:26 }}>
						<div style={{ width:52, height:52, background:"linear-gradient(135deg,#f97316,#c2410c)", borderRadius:15, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 6px 20px rgba(249,115,22,0.25)" }}>
							<span style={{ fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif", fontWeight:800, fontSize:24, color:"white" }}>G</span>
						</div>
						<h2 style={{ fontSize:22, fontWeight:800, color:"white", letterSpacing:"-0.5px", margin:"0 0 5px" }}>
							{mode === "signup" ? (lang === "es" ? "Crear tu cuenta" : "Create your account") : (lang === "es" ? "Iniciar sesión" : "Sign in")}
						</h2>
						<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#475569", fontSize:13 }}>
							{lang === "es" ? "Únete a las barberías que ya usan Goolinext" : "Join barbershops already using Goolinext"}
						</p>
					</div>
					<div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)", padding:4, borderRadius:12, marginBottom:22 }}>
						<button type="button" onClick={() => { setMode("signup"); setError(""); }} style={{ flex:1, padding:10, borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif", background: mode === "signup" ? "linear-gradient(135deg,#f97316,#ea580c)" : "transparent", color: mode === "signup" ? "white" : "#475569", transition:"all 0.2s" }}>
							{lang === "es" ? "Registrarse" : "Sign up"}
						</button>
						<button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ flex:1, padding:10, borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif", background: mode === "login" ? "linear-gradient(135deg,#f97316,#ea580c)" : "transparent", color: mode === "login" ? "white" : "#475569", transition:"all 0.2s" }}>
							{lang === "es" ? "Iniciar sesión" : "Sign in"}
						</button>
					</div>
					<div style={{ display:"flex", flexDirection:"column", gap:12 }}>
						<input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} style={{ width:"100%", padding:"13px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:11, color:"white", fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif", outline:"none" }} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
						<input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} style={{ width:"100%", padding:"13px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:11, color:"white", fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif", outline:"none" }} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
						{mode === "signup" && (
							<input id="auth-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.confirmPasswordPlaceholder} style={{ width:"100%", padding:"13px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:11, color:"white", fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif", outline:"none" }} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
						)}
						{error && <p style={{ color:"#f87171", fontSize:13, textAlign:"center", margin:0 }}>{error}</p>}
						<button type="button" className="lgb" onClick={handleSubmit} disabled={isPending} style={{ width:"100%", padding:15, background: isPending ? "#92400e" : "linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:12, color:"white", fontSize:15, fontWeight:700, cursor: isPending ? "not-allowed" : "pointer", boxShadow:"0 6px 22px rgba(249,115,22,0.28)", marginTop:2, fontFamily:"'Syne','Trebuchet MS','Gill Sans',Arial,sans-serif" }}>
							{isPending ? (mode === "signup" ? t.creating : t.signingIn) : (mode === "signup" ? (lang === "es" ? "Crear mi cuenta →" : "Create my account →") : t.signIn)}
						</button>
						{mode === "login" && (
							<button type="button" onClick={() => { setMode("recovery"); setError(""); }} style={{ background:"none", border:"none", color:"#f97316", fontSize:13, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", textDecoration:"underline" }}>
								{t.forgotPassword}
							</button>
						)}
						<p style={{ textAlign:"center", color:"#334155", fontSize:12, margin:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
							{mode === "signup" ? t.haveAccount : t.noAccount}{" "}
							<button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }} style={{ background:"none", border:"none", color:"#f97316", fontSize:13, cursor:"pointer", fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
								{mode === "signup" ? t.signIn : t.createAccount}
							</button>
						</p>
					</div>
				</div>
			</section>

			{/* FOOTER */}
			<footer style={{ position:"relative", zIndex:1, borderTop:"1px solid rgba(255,255,255,0.05)", padding:"30px 24px", textAlign:"center" }}>
				<p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#1e293b", fontSize:12 }}>
					© 2025 Goolinext · {lang === "es" ? "Todos los derechos reservados" : "All rights reserved"} · <a href="/privacy" style={{ color:"#334155", textDecoration:"none" }}>Privacy</a> · <a href="/terms" style={{ color:"#334155", textDecoration:"none" }}>Terms</a>
				</p>
			</footer>
		</div>
	);
}

// ============ ROOT ============

function AdminDashboard() {
	const [lang, setLang] = useState<Lang>(getSavedLang);

	// Step 1: Check if user has an account
	const { data: authStatus, isLoading: authLoading } = useQuery({
		queryKey: ["checkAuth"],
		queryFn: () => checkAuth(),
	});

	// Step 2: Only fetch role if authenticated
	const { data: role, isLoading: roleLoading } = useQuery({
		queryKey: ["myRole"],
		queryFn: () => getMyRole(),
		enabled: !!authStatus?.authenticated,
	});

	const isLoading = authLoading || (authStatus?.authenticated && roleLoading);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
				<div className="animate-pulse text-white text-lg">
					{lang === "es" ? "Cargando..." : "Loading..."}
				</div>
			</div>
		);
	}

	// Not authenticated → show auth screen first
	if (!authStatus?.authenticated) {
		return <AuthScreen lang={lang} setLang={setLang} />;
	}

	// Authenticated → existing role-based routing
	if (role?.role === "owner") {
		return <Dashboard shop={role.shop} lang={lang} setLang={setLang} />;
	}

	if (role?.role === "barber") {
		return <BarberPortal barber={role.barber} lang={lang} setLang={setLang} />;
	}

	return <WelcomeScreen lang={lang} setLang={setLang} />;
}

// ============ WELCOME SCREEN ============

function WelcomeScreen({
	lang,
	setLang,
}: {
	lang: Lang;
	setLang: (l: Lang) => void;
}) {
	const t = dash[lang];
	const tb = bp[lang];
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<"barber" | "owner">("owner");

	// Owner setup state
	const [name, setName] = useState("");
	const [address, setAddress] = useState("");
	const [phone, setPhone] = useState("");
	const [googleLink, setGoogleLink] = useState("");

	// Barber claim state
	const [code, setCode] = useState("");
	const [claimError, setClaimError] = useState("");

	const shopMutation = useMutation({
		mutationFn: () =>
			createShop({
				data: {
					name: name.trim(),
					address: address.trim(),
					phone: phone.trim(),
					googleReviewLink: googleLink.trim(),
				},
			}),
		onSuccess: (shop) => {
			queryClient.setQueryData(["myRole"], { role: "owner", shop });
		},
	});

	const claimMutation = useMutation({
		mutationFn: () =>
			claimBarberAccess({ data: { code: code.toUpperCase().trim() } }),
		onSuccess: (result) => {
			if (!result.success) {
				// Map error codes to i18n messages
				const errorMap: Record<string, string> = {
					INVALID_CODE: tb.invalidCode,
					ALREADY_CLAIMED: tb.alreadyClaimed,
					USER_ALREADY_LINKED: tb.alreadyLinked,
				};
				setClaimError(errorMap[result.error] || tb.genericError);
				return;
			}
			setClaimError("");
			queryClient.invalidateQueries({ queryKey: ["myRole"] });
		},
		onError: () => {
			// Only fires for unexpected errors (network failures, auth issues, etc.)
			setClaimError(tb.genericError);
		},
	});

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
			<div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
				<div className="flex justify-end gap-2 mb-4">
					<LangToggle lang={lang} setLang={setLang} />
					<LogoutButton lang={lang} />
				</div>
				<div className="text-center mb-6">
					<div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<GoolinextIcon className="w-8 h-8 text-white" />
					</div>
					<h1 className="text-2xl font-bold text-white">{t.setupTitle}</h1>
				</div>

				{/* Tab switcher */}
				<div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-6">
					<button
						type="button"
						onClick={() => setTab("owner")}
						className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
							tab === "owner"
								? "bg-amber-500/20 text-amber-400"
								: "text-gray-400 hover:text-gray-300"
						}`}
					>
						<Store className="w-4 h-4" />
						{tb.iAmOwner}
					</button>
					<button
						type="button"
						onClick={() => setTab("barber")}
						className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
							tab === "barber"
								? "bg-green-500/20 text-green-400"
								: "text-gray-400 hover:text-gray-300"
						}`}
					>
						<KeyRound className="w-4 h-4" />
						{tb.iAmBarber}
					</button>
				</div>

				{tab === "owner" ? (
					<div className="space-y-4">
						<p className="text-gray-400 text-sm text-center">
							{t.setupSubtitle}
						</p>
						<div>
							<label
								htmlFor="ws-name"
								className="block text-sm font-medium text-gray-300 mb-1"
							>
								{t.setupName} <span className="text-red-400">*</span>
							</label>
							<input
								id="ws-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={t.setupNamePlaceholder}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							/>
						</div>
						<div>
							<label
								htmlFor="ws-address"
								className="block text-sm font-medium text-gray-300 mb-1"
							>
								{t.setupAddress} <span className="text-red-400">*</span>
							</label>
							<input
								id="ws-address"
								type="text"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder={t.setupAddressPlaceholder}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							/>
						</div>
						<div>
							<label
								htmlFor="ws-phone"
								className="block text-sm font-medium text-gray-300 mb-1"
							>
								{t.setupPhone} <span className="text-red-400">*</span>
							</label>
							<input
								id="ws-phone"
								type="text"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder={t.setupPhonePlaceholder}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							/>
						</div>
						<div>
							<label
								htmlFor="ws-google"
								className="block text-sm font-medium text-gray-300 mb-1"
							>
								{t.settGoogleLink} <span className="text-red-400">*</span>
							</label>
							<input
								id="ws-google"
								type="url"
								value={googleLink}
								onChange={(e) => setGoogleLink(e.target.value)}
								placeholder={t.setupGooglePlaceholder}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							/>
						</div>
						{shopMutation.isError && (
							<p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl p-3">
								{lang === "es" ? "Error al crear el negocio. Intenta de nuevo." : "Error creating business. Please try again."}
							</p>
						)}
						<button
							type="button"
							onClick={() => shopMutation.mutate()}
							disabled={!name.trim() || !address.trim() || !phone.trim() || !googleLink.trim() || shopMutation.isPending}
							className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
						>
							{shopMutation.isPending ? t.setupCreating : t.setupCreate}
						</button>
					</div>
				) : (
					<div className="space-y-5">
						<div className="text-center">
							<h2 className="text-lg font-semibold text-white">
								{tb.claimTitle}
							</h2>
							<p className="text-gray-400 text-sm mt-1">{tb.claimSubtitle}</p>
						</div>
						<input
							type="text"
							value={code}
							onChange={(e) => {
								setCode(
									e.target.value
										.toUpperCase()
										.replace(/[^A-Z0-9]/g, "")
										.slice(0, 6),
								);
								setClaimError("");
							}}
							placeholder={tb.claimPlaceholder}
							maxLength={6}
							className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-2xl font-mono tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
						/>
						{claimError && (
							<p className="text-red-400 text-sm text-center">{claimError}</p>
						)}
						<button
							type="button"
							onClick={() => claimMutation.mutate()}
							disabled={code.length !== 6 || claimMutation.isPending}
							className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{claimMutation.isPending ? tb.claimClaiming : tb.claimButton}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

// ============ MAIN DASHBOARD ============

// ============ LOGOUT BUTTON ============

function LogoutButton({ lang }: { lang: Lang }) {
	const queryClient = useQueryClient();
	const logoutMutation = useMutation({
		mutationFn: () => logout(),
		onSuccess: () => {
			queryClient.clear();
			window.location.href = "/";
		},
	});

	return (
		<button
			type="button"
			onClick={() => logoutMutation.mutate()}
			disabled={logoutMutation.isPending}
			className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-red-900/40 hover:border-red-700 hover:text-red-400 transition-colors"
			title={lang === "es" ? "Cerrar sesión" : "Sign out"}
		>
			<Shield className="w-4 h-4" />
			<span className="hidden sm:inline">
				{lang === "es" ? "Salir" : "Sign out"}
			</span>
		</button>
	);
}

// ============ DASHBOARD ============

function Dashboard({
	shop,
	lang,
	setLang,
}: {
	shop: {
		id: number;
		name: string;
		address: string | null;
		googleReviewLink: string | null;
	};
	lang: Lang;
	setLang: (l: Lang) => void;
}) {
	const t = dash[lang];
	const [activeTab, setActiveTab] = useState<
		"dashboard" | "queue" | "barbers" | "qr" | "clients" | "settings" | "help" | "reports" | "retention" | "reputation"
	>("dashboard");



	const { data: subStatus, isLoading: subLoading, refetch: refetchSub } = useQuery({
		queryKey: ["subscriptionStatus"],
		queryFn: () => getSubscriptionStatus(),
	});

	// Handle payment success redirect from Stripe
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const payment = params.get("payment");
		const sessionId = params.get("session_id");
		if (payment === "success" && sessionId) {
			activateSubscription({ data: { sessionId } })
				.then(() => {
					window.history.replaceState({}, "", "/");
					refetchSub();
				})
				.catch(() => {
					window.history.replaceState({}, "", "/");
					refetchSub();
				});
		}
	}, []);

	// Poll for pending follow-ups every 2 minutes
	useEffect(() => {
		const run = () => {
			processFollowUps().catch(() => {});
		};
		run();
		const interval = setInterval(run, 2 * 60 * 1000);
		return () => clearInterval(interval);
	}, []);

	// Process 30-day reminders every 30 minutes
	useEffect(() => {
		const run = () => {
			processReminders().catch(() => {});

		};
		run();
		const interval = setInterval(run, 5 * 60 * 1000); // every 5 min for queue
		return () => clearInterval(interval);
	}, []);

	const tabs = [
		{ key: "dashboard" as const, label: t.tabHome, icon: Store },
		{ key: "queue" as const, label: t.tabQueue, icon: List },
		{ key: "barbers" as const, label: t.tabBarbers, icon: GoolinextIcon },
		{ key: "qr" as const, label: t.tabQR, icon: QrCode },
		{ key: "clients" as const, label: t.tabClients, icon: Database },
		{ key: "reports" as const, label: lang === "es" ? "Reportes" : "Reports", icon: BarChart2 },
		{ key: "retention" as const, label: lang === "es" ? "Retención" : "Retention", icon: Users },
		{ key: "reputation" as const, label: lang === "es" ? "Reputación" : "Reputation", icon: Star },
		{ key: "help" as const, label: lang === "es" ? "Ayuda" : "Help", icon: Bell },
		{ key: "settings" as const, label: t.tabSettings, icon: Settings },
	];

	// Show paywall if not subscribed (only when we have definitive data)
	if (!subLoading && subStatus !== undefined && subStatus?.status !== "active") {
		const isExpired = subStatus?.status === "canceled" || subStatus?.status === "past_due" || subStatus?.status === "unpaid";
		return <PaywallScreen lang={lang} onPaid={() => window.location.reload()} isExpired={isExpired} />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">

			{/* Header */}
			<div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10">
				<div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
							<GoolinextIcon className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-white">{shop.name}</h1>
							<p className="text-xs text-gray-500">{t.dashboard}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<LangToggle lang={lang} setLang={setLang} />
						<LogoutButton lang={lang} />
					</div>
				</div>
			</div>

			{/* Subscription Banner */}
			<SubscriptionBanner lang={lang} />
			{/* Nav Tabs */}
			<div className="max-w-5xl mx-auto px-4 py-3">
				<div className="flex gap-1 bg-gray-900/60 p-1 rounded-xl overflow-x-auto">
					{tabs.map((tab) => (
						<button
							type="button"
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
								activeTab === tab.key
									? "bg-amber-500/20 text-amber-400"
									: "text-gray-400 hover:text-gray-300"
							}`}
						>
							<tab.icon className="w-4 h-4" />
							<span className="hidden sm:inline">{tab.label}</span>
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<div className="max-w-5xl mx-auto px-4 pb-8">
				{activeTab === "dashboard" && (
					<StatsView shopId={shop.id} lang={lang} />
				)}
				{activeTab === "queue" && <QueueView shopId={shop.id} lang={lang} />}
				{activeTab === "barbers" && (
					<BarbersView shopId={shop.id} lang={lang} />
				)}
				{activeTab === "qr" && (
					<QRView shopId={shop.id} shopName={shop.name} lang={lang} />
				)}
				{activeTab === "clients" && (
					<ClientsView shopId={shop.id} lang={lang} />
				)}
				{activeTab === "settings" && <SettingsView shop={shop} lang={lang} />}

				{activeTab === "reports" && <ReportsView shopId={shop.id} lang={lang} />}
				{activeTab === "retention" && <RetentionView shopId={shop.id} lang={lang} />}
				{activeTab === "reputation" && <ReputationView shop={shop} lang={lang} />}
				{activeTab === "help" && <HelpView shopName={shop.name} lang={lang} />}
			</div>
		</div>
	);
}

// ============ BARBER PORTAL ============

function BarberPortal({
	barber,
	lang,
	setLang,
}: {
	barber: {
		id: number;
		name: string;
		specialty: string | null;
		photoUrl: string | null;
		shopId: number;
		isActive: boolean;
		shopName: string;
	};
	lang: Lang;
	setLang: (l: Lang) => void;
}) {
	const tb = bp[lang];
	const queryClient = useQueryClient();
	const [currentPhoto, setCurrentPhoto] = useState(barber.photoUrl);

	const { data: queue } = useQuery({
		queryKey: ["myBarberQueue"],
		queryFn: () => getMyBarberQueue(),
		refetchInterval: 10000,
	});

	const today = new Date().toISOString().split("T")[0];
	const { data: myAppointments } = useQuery({
		queryKey: ["barberAppointments", today],
		queryFn: () => getBarberAppointments({ data: { date: today } }),
		refetchInterval: 60000,
	});



	// Real-time updates
	useWebSocket({
		onMessage: (msg) => {
			const data = msg as { type: string; shopId?: number };
			if (data.type === "queue_updated" && data.shopId === barber.shopId) {
				queryClient.invalidateQueries({ queryKey: ["myBarberQueue"] });
			}
		},
	});

	const nextMutation = useMutation({
		mutationFn: () => barberCallNext(),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["myBarberQueue"] }),
	});

	const [completingVisitId, setCompletingVisitId] = useState<number|null>(null);
	const [amountInput, setAmountInput] = useState("");
	const completeMutation = useMutation({
		mutationFn: (args: { visitId: number; amountPaid: number }) =>
			barberCompleteClient({ data: { visitId: args.visitId, amountPaid: args.amountPaid } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["myBarberQueue"] });
			setCompletingVisitId(null);
			setAmountInput("");
		},
	});

	const barberCancelMutation = useMutation({
		mutationFn: (args: { visitId: number; status: "cancelled" | "no_show" }) =>
			barberCancelVisit({ data: { visitId: args.visitId, status: args.status } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["myBarberQueue"] }),
	});

	const myPhotoMutation = useMutation({
		mutationFn: (photoUrl: string | null) =>
			updateMyBarberPhoto({ data: { photoUrl } }),
		onSuccess: (_data, photoUrl) => {
			setCurrentPhoto(photoUrl);
		},
	});

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">

			{/* Amount modal - clean bottom sheet, no keyboard push */}
			{completingVisitId !== null && (
				<div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.8)"}}>
					<div style={{width:"100%",maxWidth:480,background:"#111118",borderRadius:"24px 24px 0 0",borderTop:"1px solid rgba(255,255,255,0.08)",padding:"20px 24px",paddingBottom:"max(28px,env(safe-area-inset-bottom))"}}>
						{/* Handle */}
						<div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"0 auto 20px"}} />
						{/* Title */}
						<p style={{textAlign:"center",fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.4)",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:4}}>
							{queue?.currentClient?.clientName}
						</p>
						<p style={{textAlign:"center",fontSize:20,fontWeight:700,color:"white",marginBottom:24}}>
							{lang === "es" ? "¿Cuanto le cobraras?" : "How much did you charge?"}
						</p>
						{/* Amount input - big and clean */}
						<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"16px 24px",marginBottom:20}}>
							<span style={{fontSize:36,fontWeight:700,color:"#4ade80",lineHeight:1}}>$</span>
							<input
								type="number"
								inputMode="numeric"
								min="0"
								value={amountInput}
								onChange={e => setAmountInput(e.target.value)}
								placeholder="0"
								style={{background:"transparent",border:"none",outline:"none",color:"white",fontSize:52,fontWeight:800,width:180,textAlign:"center",WebkitAppearance:"none",MozAppearance:"textfield"}}
							/>
						</div>
						{/* Buttons */}
						<div style={{display:"flex",gap:12}}>
							<button type="button"
								onClick={() => { setCompletingVisitId(null); setAmountInput(""); }}
								style={{flex:1,padding:"16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:"rgba(255,255,255,0.6)",fontSize:16,fontWeight:600,cursor:"pointer"}}>
								{lang === "es" ? "Cancelar" : "Cancel"}
							</button>
							<button type="button"
								onClick={() => { if(amountInput) completeMutation.mutate({ visitId: completingVisitId!, amountPaid: parseFloat(amountInput) }); }}
								disabled={!amountInput || completeMutation.isPending}
								style={{flex:1,padding:"16px",background:amountInput?"#22c55e":"rgba(34,197,94,0.3)",border:"none",borderRadius:14,color:"white",fontSize:16,fontWeight:700,cursor:amountInput?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
								{completeMutation.isPending ? "..." : (lang === "es" ? "✓ Confirmar" : "✓ Confirm")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Header */}
			<div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10">
				<div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<BarberPhotoAvatar
							photoUrl={currentPhoto}
							name={barber.name}
							size="sm"
							onUpload={(dataUrl) => myPhotoMutation.mutate(dataUrl)}
							uploading={myPhotoMutation.isPending}
						/>
						<div>
							<h1 className="text-lg font-bold text-white">
								{barber.shopName}
							</h1>
							<p className="text-xs text-gray-500">
								{tb.hello}, {barber.name}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<LangToggle lang={lang} setLang={setLang} />
						<LogoutButton lang={lang} />
					</div>
				</div>
			</div>

			<div className="max-w-lg mx-auto px-4 py-6 space-y-5">
				{/* Queue count */}
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center">
					<p className="text-5xl font-bold text-white">
						{queue?.waitingCount ?? 0}
					</p>
					<p className="text-sm text-gray-500 mt-1">{tb.waiting}</p>
				</div>

				{/* Currently serving */}
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
					<div className="px-5 py-3 border-b border-gray-800">
						<p className="text-xs text-green-500 font-medium uppercase tracking-wider">
							{tb.serving}
						</p>
					</div>
					{queue?.currentClient ? (
						<div className="px-5 py-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
									<User className="w-5 h-5 text-green-400" />
								</div>
								<div>
									<p className="text-white font-semibold">
										{queue.currentClient.clientName}
									</p>
									{queue.currentClient.clientPhone && (
										<p className="text-sm text-gray-500">
											{queue.currentClient.clientPhone}
										</p>
									)}
								</div>
							</div>
							{completingVisitId === queue.currentClient?.visitId ? (
								<div className="flex flex-col gap-2 mt-2 w-full">
									<p className="text-xs text-gray-400 font-medium">{lang === "es" ? "¿Cuánto pagó el cliente?" : "How much did the client pay?"}</p>
									<div className="flex items-center gap-2 w-full">
										<span className="text-gray-300 font-bold text-lg flex-shrink-0">$</span>
										<input
											type="number"
											min="0"
											step="0.01"
											value={amountInput}
											onChange={e => setAmountInput(e.target.value)}
											placeholder="0.00"
											autoFocus
											className="min-w-0 flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-green-500"
										/>
									</div>
									<div className="flex gap-2 w-full">
										<button
											type="button"
											onClick={() => { if(amountInput) completeMutation.mutate({ visitId: completingVisitId!, amountPaid: parseFloat(amountInput) }); }}
											disabled={!amountInput || completeMutation.isPending}
											className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold disabled:opacity-40 flex items-center justify-center gap-2"
										>
											{completeMutation.isPending ? "..." : <><Check className="w-4 h-4" />{lang === "es" ? "Confirmar" : "Confirm"}</>}
										</button>
										<button type="button" onClick={() => { setCompletingVisitId(null); setAmountInput(""); }} className="px-4 py-3 bg-gray-700 text-gray-300 rounded-xl text-sm font-medium">
											{lang === "es" ? "Cancelar" : "Cancel"}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => { setCompletingVisitId(queue.currentClient?.visitId ?? null); setAmountInput(""); }}
									className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all text-sm font-medium"
								>
									<Check className="w-4 h-4" />
									{tb.complete}
								</button>
							)}
						</div>
					) : (
						<div className="px-5 py-6 text-center">
							<p className="text-gray-600 text-sm">{tb.noClient}</p>
						</div>
					)}
				</div>

				{/* Next client button - requires amount if there's a current client */}
				<button
					type="button"
					onClick={() => {
						if (queue?.currentClient && completingVisitId !== queue.currentClient.visitId) {
							// Force amount popup first
							setCompletingVisitId(queue.currentClient.visitId);
							setAmountInput("");
						} else {
							nextMutation.mutate();
						}
					}}
					disabled={
						nextMutation.isPending ||
						((queue?.waitingCount ?? 0) === 0 && !queue?.currentClient)
					}
					className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-3"
				>
					<ChevronRight className="w-6 h-6" />
					{tb.nextClient}
				</button>





				{/* Waiting list */}
				{queue?.waitingClients && queue.waitingClients.length > 0 ? (
					<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
						<div className="px-5 py-3 border-b border-gray-800">
							<p className="text-sm font-medium text-gray-400">
								{tb.waiting} ({queue.waitingCount})
							</p>
						</div>
						<div className="divide-y divide-gray-800/50">
							{queue.waitingClients.map((client, index) => (
								<div
									key={client.visitId}
									className="px-5 py-3 flex items-center justify-between"
								>
									<div className="flex items-center gap-3">
										<span
											className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
												index === 0
													? "bg-amber-500/20 text-amber-400"
													: "bg-gray-800 text-gray-500"
											}`}
										>
											{index + 1}
										</span>
										<div>
											<p
												className={`font-medium ${
													index === 0 ? "text-white" : "text-gray-400"
												}`}
											>
												{client.clientName}
											</p>
											{client.createdAt && (
												<p className="text-xs text-gray-600 flex items-center gap-1">
													<Clock className="w-3 h-3" />
													{formatWait(client.createdAt, lang)}
												</p>
											)}
										</div>
									</div>
									<div className="flex gap-1.5">
										<button type="button" onClick={() => { if(confirm(lang==="es"?"¿Marcar como cancelado?":"Mark as cancelled?")) barberCancelMutation.mutate({ visitId: client.visitId, status: "cancelled" }); }} disabled={barberCancelMutation.isPending} className="px-2.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-xs font-medium hover:bg-red-500/25 transition-all">
											{lang === "es" ? "Canceló" : "Cancelled"}
										</button>
										<button type="button" onClick={() => { if(confirm(lang==="es"?"¿Marcar como no se presentó?":"Mark as no-show?")) barberCancelMutation.mutate({ visitId: client.visitId, status: "no_show" }); }} disabled={barberCancelMutation.isPending} className="px-2.5 py-1.5 bg-gray-700/50 text-gray-400 border border-gray-700 rounded-lg text-xs font-medium hover:bg-gray-700 transition-all">
											{lang === "es" ? "No llegó" : "No-show"}
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center">
						<p className="text-gray-600 text-sm">{tb.noWaiting}</p>
					</div>
				)}
			</div>
		</div>
	);
}

// ============ STATS VIEW ============

function StatsView({ shopId, lang }: { shopId: number; lang: Lang }) {
	const [showAllVisits, setShowAllVisits] = useState(false);
	const t = dash[lang];
	const { data: stats } = useQuery({
		queryKey: ["stats", shopId],
		queryFn: () => getDashboardStats({ data: { shopId } }),
	});

	return (
		<div className="space-y-6">
			{/* KPI Cards */}
			<div className="grid grid-cols-2 gap-4">
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
							<Users className="w-5 h-5 text-blue-400" />
						</div>
					</div>
					<p className="text-3xl font-bold text-white">
						{stats?.totalClients ?? 0}
					</p>
					<p className="text-sm text-gray-500">{t.registeredClients}</p>
				</div>
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
							<CalendarCheck className="w-5 h-5 text-green-400" />
						</div>
					</div>
					<p className="text-3xl font-bold text-white">
						{stats?.totalVisits ?? 0}
					</p>
					<p className="text-sm text-gray-500">{t.totalVisits}</p>
				</div>
			</div>

			{/* Recent Visits */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
				<div className="p-5 border-b border-gray-800">
					<h2 className="text-lg font-semibold text-white">{t.recentVisits}</h2>
				</div>
				{stats?.recentVisits && stats.recentVisits.length > 0 ? (
					<div className="divide-y divide-gray-800">
						{(showAllVisits ? stats.recentVisits : stats.recentVisits.slice(0, 5)).map((visit) => (
							<div
								key={visit.visitId}
								className="px-5 py-4 flex items-center justify-between"
							>
								<div>
									<p className="text-white font-medium">{visit.clientName}</p>
									<p className="text-sm text-gray-500">
										{lang === "es" ? "Barbero" : "Barber"}: {visit.barberName} ·{" "}
										{visit.clientPhone}
									</p>
								</div>
								<div className="flex items-center gap-2">
									{visit.status === "waiting" && (
										<span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-lg">
											{t.waiting}
										</span>
									)}
									{visit.status === "in_service" && (
										<span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg">
											{t.serving}
										</span>
									)}
									{visit.status === "completed" && (
										<span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg">
											{t.completed}
										</span>
									)}
									{visit.followUpSent && (
										<span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-lg">
											{t.reviewSent}
										</span>
									)}
								</div>
							</div>
						))}
						{stats.recentVisits.length > 5 && (
							<button type="button" onClick={() => setShowAllVisits(v => !v)}
								className="w-full py-3 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-all border-t border-gray-800">
								{showAllVisits
									? (lang === "es" ? "▲ Ver menos" : "▲ Show less")
									: (lang === "es" ? `▼ Ver ${stats.recentVisits.length - 5} más` : `▼ Show ${stats.recentVisits.length - 5} more`)}
							</button>
						)}
					</div>
				) : (
					<div className="p-8 text-center">
						<p className="text-gray-500">{t.noVisits}</p>
					</div>
				)}
			</div>
		</div>
	);
}

// ============ QUEUE VIEW ============

function QueueView({ shopId, lang }: { shopId: number; lang: Lang }) {
	const t = dash[lang];
	const queryClient = useQueryClient();

	const { data: queues } = useQuery({
		queryKey: ["shopQueues", shopId],
		queryFn: () => getShopQueues({ data: { shopId } }),
		refetchInterval: 10000,
	});

	// Real-time updates
	useWebSocket({
		onMessage: (msg) => {
			const data = msg as { type: string; shopId?: number };
			if (data.type === "queue_updated" && data.shopId === shopId) {
				queryClient.invalidateQueries({
					queryKey: ["shopQueues", shopId],
				});
			}
		},
	});

	const nextMutation = useMutation({
		mutationFn: (barberId: number) =>
			callNextClient({ data: { barberId, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["shopQueues", shopId] }),
	});

	const [ownerCompletingVisitId, setOwnerCompletingVisitId] = useState<number|null>(null);
	const [ownerAmountInput, setOwnerAmountInput] = useState("");
	const completeMutation = useMutation({
		mutationFn: (args: { visitId: number; amountPaid: number }) =>
			completeClient({ data: { visitId: args.visitId, shopId, amountPaid: args.amountPaid } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shopQueues", shopId] });
			setOwnerCompletingVisitId(null);
			setOwnerAmountInput("");
		},
	});

	const cancelMutation = useMutation({
		mutationFn: (visitId: number) =>
			cancelQueueEntry({ data: { visitId, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["shopQueues", shopId] }),
	});

	const totalWaiting = queues?.reduce((sum, q) => sum + q.waitingCount, 0) ?? 0;
	const totalServing =
		queues?.filter((q) => q.currentClient !== null).length ?? 0;

	return (
		<div className="space-y-5">
			{/* Summary */}
			<div className="grid grid-cols-2 gap-4">
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
							<Users className="w-5 h-5 text-amber-400" />
						</div>
					</div>
					<p className="text-3xl font-bold text-white">{totalWaiting}</p>
					<p className="text-sm text-gray-500">{t.inWaiting}</p>
				</div>
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
							<GoolinextIcon className="w-5 h-5 text-green-400" />
						</div>
					</div>
					<p className="text-3xl font-bold text-white">{totalServing}</p>
					<p className="text-sm text-gray-500">{t.beingServed}</p>
				</div>
			</div>

			{/* Queue link for TV */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
				<div>
					<p className="text-sm text-gray-400">{t.tvScreen}</p>
					<p className="text-xs text-gray-600 mt-0.5">{t.tvDesc}</p>
				</div>
				<a
					href={`/queue/${shopId}`}
					target="_blank"
					rel="noopener noreferrer"
					className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-all text-sm font-medium flex-shrink-0"
				>
					{t.open}
				</a>
			</div>

			{/* Barber Queues */}
			{queues && queues.length > 0 ? (
				<div className="space-y-4">
					{queues.map((q) => (
						<div
							key={q.barber.id}
							className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden"
						>
							{/* Barber Header */}
							<div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center ${q.currentClient ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-amber-500/30 to-orange-600/30"}`}
									>
										<GoolinextIcon
											className={`w-4 h-4 ${q.currentClient ? "text-white" : "text-amber-400"}`}
										/>
									</div>
									<div>
										<p className="text-white font-semibold">{q.barber.name}</p>
										<p className="text-xs text-gray-500">
											{q.waitingCount} {t.queueWaiting}
											{q.barber.specialty ? ` · ${q.barber.specialty}` : ""}
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => nextMutation.mutate(q.barber.id)}
									disabled={
										nextMutation.isPending ||
										(q.waitingCount === 0 && !q.currentClient)
									}
									className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
								>
									<ChevronRight className="w-4 h-4" />
									{t.nextClient}
								</button>
							</div>

							{/* Current Client */}
							{q.currentClient && (
								<div className="px-5 py-3 bg-green-500/5 border-b border-green-500/20 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<User className="w-4 h-4 text-green-400" />
										<div>
											<p className="text-xs text-green-500 font-medium uppercase tracking-wider">
												{t.serving}
											</p>
											<p className="text-green-300 font-semibold">
												{q.currentClient.clientName}
											</p>
										</div>
									</div>
									{ownerCompletingVisitId === q.currentClient?.visitId ? (
										<div className="flex items-center gap-2 mt-2">
											<span className="text-gray-300 font-bold">$</span>
											<input
												type="number" min="0" step="0.01"
												value={ownerAmountInput}
												onChange={e => setOwnerAmountInput(e.target.value)}
												placeholder="0.00" autoFocus
												className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
											/>
											<button type="button" onClick={() => { if(ownerAmountInput) completeMutation.mutate({ visitId: ownerCompletingVisitId!, amountPaid: parseFloat(ownerAmountInput) }); }} disabled={!ownerAmountInput || completeMutation.isPending} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-bold disabled:opacity-40">
												{completeMutation.isPending ? "..." : "✓"}
											</button>
											<button type="button" onClick={() => { setOwnerCompletingVisitId(null); setOwnerAmountInput(""); }} className="px-2 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm">✕</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => { setOwnerCompletingVisitId(q.currentClient?.visitId ?? null); setOwnerAmountInput(""); }}
											className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all text-xs font-medium"
										>
											<Check className="w-3.5 h-3.5" />
											{t.completeBtn}
										</button>
									)}
								</div>
							)}

							{/* Waiting List */}
							{q.waitingClients.length > 0 ? (
								<div className="divide-y divide-gray-800/50">
									{q.waitingClients.map((client, index) => (
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
												<div>
													<p
														className={`font-medium ${index === 0 ? "text-white" : "text-gray-400"}`}
													>
														{client.clientName}
													</p>
													<p className="text-xs text-gray-600">
														{client.clientPhone}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{client.createdAt && (
													<span className="text-xs text-gray-600 flex items-center gap-1">
														<Clock className="w-3 h-3" />
														{formatWait(client.createdAt, lang)}
													</span>
												)}
												<button
													type="button"
													onClick={() => cancelMutation.mutate(client.visitId)}
													disabled={cancelMutation.isPending}
													className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
													title={t.cancel}
												>
													<X className="w-3.5 h-3.5" />
												</button>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="px-5 py-4 text-center">
									<p className="text-gray-600 text-sm">
										{q.currentClient ? t.noMoreWaiting : t.noClientsQueue}
									</p>
								</div>
							)}
						</div>
					))}
				</div>
			) : (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
					<List className="w-10 h-10 text-gray-600 mx-auto mb-3" />
					<p className="text-gray-500">{t.addBarbersFirst}</p>
				</div>
			)}
		</div>
	);
}

function formatWait(createdAt: Date, lang: Lang): string {
	const now = Date.now();
	const created = new Date(createdAt).getTime();
	const diffMin = Math.floor((now - created) / 60000);
	if (diffMin < 1) return dash[lang].now;
	if (diffMin < 60) return `${diffMin}m`;
	const hours = Math.floor(diffMin / 60);
	const mins = diffMin % 60;
	return `${hours}h ${mins}m`;
}

// ============ PHOTO UPLOAD COMPONENT ============

function BarberPhotoAvatar({
	photoUrl,
	name,
	size = "md",
	onUpload,
	uploading,
	showUploadButton = false,
	uploadLabel,
}: {
	photoUrl: string | null;
	name: string;
	size?: "sm" | "md" | "lg";
	onUpload?: (dataUrl: string) => void;
	uploading?: boolean;
	showUploadButton?: boolean;
	uploadLabel?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const dims =
		size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-12 h-12";
	const iconSize =
		size === "lg" ? "w-8 h-8" : size === "md" ? "w-6 h-6" : "w-5 h-5";
	const cameraSize = size === "lg" ? "w-7 h-7" : "w-5 h-5";
	const cameraPad =
		size === "lg" ? "-bottom-1 -right-1" : "-bottom-0.5 -right-0.5";

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file || !onUpload) return;
			try {
				// Inline high-quality image resize - 800px max, 0.92 quality
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const img = new Image();
				img.onload = () => {
					let w = img.width, h = img.height;
					const MAX = 800;
					if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
					else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
					const c = document.createElement("canvas");
					c.width = w; c.height = h;
					const ctx = c.getContext("2d")!;
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = "high";
					ctx.drawImage(img, 0, 0, w, h);
					resolve(c.toDataURL("image/jpeg", 0.98));
				};
				img.onerror = reject;
				img.src = reader.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
				onUpload(dataUrl);
			} catch {
				// Silently ignore — invalid file
			}
			e.target.value = "";
		},
		[onUpload],
	);

	return (
		<div className="flex flex-col items-center gap-1.5">
			<button
				type="button"
				className="relative group"
				onClick={() => onUpload && inputRef.current?.click()}
				disabled={!onUpload || uploading}
			>
				{photoUrl ? (
					<img
						src={photoUrl}
						alt={name}
						className={`${dims} rounded-full object-cover border-2 border-gray-700 group-hover:border-amber-500/50 transition-all`}
					/>
				) : (
					<div
						className={`${dims} rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center border-2 border-gray-700 group-hover:border-amber-500/50 transition-all`}
					>
						<GoolinextIcon className={`${iconSize} text-amber-400`} />
					</div>
				)}
				{onUpload && (
					<div
						className={`absolute ${cameraPad} ${cameraSize} bg-amber-500 rounded-full flex items-center justify-center border-2 border-gray-900 group-hover:bg-amber-400 transition-colors`}
					>
						<Camera className="w-3 h-3 text-white" />
					</div>
				)}
				{uploading && (
					<div
						className={`absolute inset-0 ${dims} rounded-full bg-black/60 flex items-center justify-center`}
					>
						<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
					</div>
				)}
				{onUpload && (
					<input
						ref={inputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleFileChange}
					/>
				)}
			</button>
			{showUploadButton && onUpload && uploadLabel && (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={uploading}
					className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
				>
					{uploading ? "..." : uploadLabel}
				</button>
			)}
		</div>
	);
}

// ============ BARBERS VIEW ============

function BarbersView({ shopId, lang }: { shopId: number; lang: Lang }) {
	const t = dash[lang];
	const queryClient = useQueryClient();

	const [name, setName] = useState("");
	const [specialty, setSpecialty] = useState("");
	const [barberPhone, setBarberPhone] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [copiedId, setCopiedId] = useState<number | null>(null);

	const { data: barberList } = useQuery({
		queryKey: ["barbers", shopId],
		queryFn: () => getBarbers({ data: { shopId } }),
	});

	const addMutation = useMutation({
		mutationFn: () =>
			createBarber({
				data: { shopId, name, specialty: specialty || undefined, phone: barberPhone || undefined },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
			setName("");
			setSpecialty("");
			setBarberPhone("");
			setShowForm(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteBarber({ data: { id, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const regenMutation = useMutation({
		mutationFn: (barberId: number) =>
			regenerateBarberCode({ data: { barberId, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const unlinkMutation = useMutation({
		mutationFn: (barberId: number) =>
			unlinkBarber({ data: { barberId, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const scheduleMutation = useMutation({
		mutationFn: (args: { barberId: number; workDays: number[] }) =>
			updateBarberSchedule({
				data: { barberId: args.barberId, shopId, workDays: args.workDays },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const vacationMutation = useMutation({
		mutationFn: (args: { barberId: number; onVacation: boolean }) =>
			toggleBarberVacation({
				data: { barberId: args.barberId, shopId, onVacation: args.onVacation },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const overrideMutation = useMutation({
		mutationFn: (args: { barberId: number; active: boolean }) =>
			setBarberOverride({
				data: { barberId: args.barberId, shopId, active: args.active },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
	});

	const [photoError, setPhotoError] = useState<string>("");
	const photoMutation = useMutation({
		mutationFn: (args: { barberId: number; photoUrl: string | null }) =>
			updateBarberPhoto({
				data: { barberId: args.barberId, shopId, photoUrl: args.photoUrl },
			}),
		onSuccess: () => {
			setPhotoError("");
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
		},
		onError: (e: any) => setPhotoError("Photo upload failed: " + (e?.message || "unknown error")),
	});

	const [editingPhone, setEditingPhone] = useState<{ id: number; phone: string } | null>(null);
	const phoneMutation = useMutation({
		mutationFn: (args: { barberId: number; phone: string }) =>
			updateBarberPhone({ data: { barberId: args.barberId, shopId, phone: args.phone } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
			setEditingPhone(null);
		},
	});

	const copyCode = (barberId: number, code: string) => {
		navigator.clipboard.writeText(code);
		setCopiedId(barberId);
		setTimeout(() => setCopiedId(null), 2000);
	};

	// Helper to compute barber's availability status for today
	const getBarberStatus = (b: {
		onVacation: boolean;
		workDays: string;
		manualOverrideDate: string | null;
	}) => {
		const now = new Date();
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		const todayDay = now.getDay();
		const workDays: number[] = JSON.parse(b.workDays || "[0,1,2,3,4,5,6]");
		const hasOverride = b.manualOverrideDate === todayStr;

		if (b.onVacation)
			return {
				key: "vacation" as const,
				color: "text-orange-400",
				bg: "bg-orange-500/10",
			};
		if (hasOverride)
			return {
				key: "override" as const,
				color: "text-cyan-400",
				bg: "bg-cyan-500/10",
			};
		if (!workDays.includes(todayDay))
			return {
				key: "dayOff" as const,
				color: "text-gray-400",
				bg: "bg-gray-500/10",
			};
		return {
			key: "available" as const,
			color: "text-green-400",
			bg: "bg-green-500/10",
		};
	};

	const statusLabels = {
		available: t.statusAvailable,
		dayOff: t.statusDayOff,
		vacation: t.statusVacation,
		override: t.statusOverride,
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-white">{t.barbersTitle}</h2>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-all text-sm font-medium"
				>
					<Plus className="w-4 h-4" />
					{t.add}
				</button>
			</div>

			{/* Info banner */}
			{barberList && barberList.length > 0 && (
				<div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
					<KeyRound className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
					<p className="text-sm text-blue-300">{t.barberAccountInfo}</p>
				</div>
			)}

			{showForm && (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t.barberName}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					/>
					<input
						type="text"
						value={specialty}
						onChange={(e) => setSpecialty(e.target.value)}
						placeholder={t.barberSpecialty}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					/>
					<input
						type="tel"
						value={barberPhone}
						onChange={(e) => setBarberPhone(e.target.value)}
						placeholder={lang === "es" ? "Teléfono del empleado +1XXXXXXXXXX" : "Employee phone +1XXXXXXXXXX"}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					/>
					<button
						type="button"
						onClick={() => addMutation.mutate()}
						disabled={!name.trim() || !barberPhone.trim() || addMutation.isPending}
						className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
					>
						{addMutation.isPending ? t.addingBarber : t.addBarber}
					</button>
				</div>
			)}

			{barberList && barberList.length > 0 ? (
				<div className="space-y-3">
					{barberList.map((b) => {
						const workDays: number[] = JSON.parse(
							b.workDays || "[0,1,2,3,4,5,6]",
						);
						const status = getBarberStatus(b);
						const now = new Date();
						const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
						const hasOverride = b.manualOverrideDate === todayStr;

						return (
							<div
								key={b.id}
								className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<BarberPhotoAvatar
											photoUrl={b.photoUrl}
											name={b.name}
											size="md"
											onUpload={(dataUrl) =>
												photoMutation.mutate({
													barberId: b.id,
													photoUrl: dataUrl,
												})
											}
											uploading={photoMutation.isPending}
										/>
										{photoError && <p className="text-red-400 text-xs mt-1">{photoError}</p>}
										<div>
											<p className="text-white font-medium">{b.name}</p>
											{b.specialty && (
												<p className="text-sm text-gray-500">{b.specialty}</p>
											)}
											{/* Status badge */}
											<span
												className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}
											>
												{statusLabels[status.key]}
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={() => deleteMutation.mutate(b.id)}
										className="p-2 text-gray-500 hover:text-red-400 transition-colors"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								</div>

								{/* Availability section */}
								<div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
									<p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
										{t.availabilityTitle}
									</p>

									{/* Work days selector */}
									<div>
										<p className="text-xs text-gray-500 mb-1.5">
											{t.workDaysLabel}
										</p>
										<div className="flex gap-1">
											{t.dayNames.map((dayName, i) => {
												const isActive = workDays.includes(i);
												return (
													<button
														key={dayName}
														type="button"
														onClick={() => {
															const newDays = isActive
																? workDays.filter((d) => d !== i)
																: [...workDays, i].sort();
															scheduleMutation.mutate({
																barberId: b.id,
																workDays: newDays,
															});
														}}
														disabled={scheduleMutation.isPending}
														className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
															isActive
																? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
																: "bg-gray-800/50 text-gray-600 border border-gray-800 hover:border-gray-700"
														}`}
													>
														{dayName}
													</button>
												);
											})}
										</div>
									</div>

									{/* Vacation toggle + Override button */}
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() =>
												vacationMutation.mutate({
													barberId: b.id,
													onVacation: !b.onVacation,
												})
											}
											disabled={vacationMutation.isPending}
											className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
												b.onVacation
													? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
													: "bg-gray-800/50 text-gray-400 border border-gray-800 hover:border-gray-700"
											}`}
										>
											<Palmtree className="w-3.5 h-3.5" />
											{b.onVacation ? t.vacationOn : t.vacationMode}
										</button>

										{/* Manual override button — show when barber is on day off but NOT on vacation */}
										{!b.onVacation && (
											<button
												type="button"
												onClick={() =>
													overrideMutation.mutate({
														barberId: b.id,
														active: !hasOverride,
													})
												}
												disabled={overrideMutation.isPending}
												className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
													hasOverride
														? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
														: "bg-gray-800/50 text-gray-400 border border-gray-800 hover:border-gray-700"
												}`}
											>
												<Zap className="w-3.5 h-3.5" />
												{hasOverride ? t.overrideActive : t.overrideToday}
											</button>
										)}
									</div>
								</div>

								{/* Account linking section */}
								<div className="mt-3 pt-3 border-t border-gray-800">
									{b.userId ? (
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<UserCheck className="w-4 h-4 text-green-400" />
												<span className="text-sm text-green-400 font-medium">
													{t.linked}
												</span>
											</div>
											<button
												type="button"
												onClick={() => unlinkMutation.mutate(b.id)}
												disabled={unlinkMutation.isPending}
												className="px-3 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors font-medium"
											>
												{t.unlinkBarberBtn}
											</button>
										</div>
									) : (
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<span className="text-xs text-gray-500">
													{t.accessCode}:
												</span>
												{b.accessCode ? (
													<>
														<span className="font-mono text-sm text-amber-400 tracking-wider">
															{b.accessCode}
														</span>
														<button
															type="button"
															onClick={() => copyCode(b.id, b.accessCode ?? "")}
															className="p-1 text-gray-500 hover:text-white transition-colors"
															title="Copy"
														>
															{copiedId === b.id ? (
																<Check className="w-3.5 h-3.5 text-green-400" />
															) : (
																<Copy className="w-3.5 h-3.5" />
															)}
														</button>
													</>
												) : (
													<span className="text-xs text-gray-600">—</span>
												)}
											</div>
											<button
												type="button"
												onClick={() => regenMutation.mutate(b.id)}
												disabled={regenMutation.isPending}
												className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-amber-400 transition-colors"
											>
												<RefreshCw className="w-3 h-3" />
												{t.regenerateCode}
											</button>
										</div>
									)}
								</div>
								{/* Barber Phone for SMS notifications */}
								<div className="mt-3 pt-3 border-t border-gray-800">
									<div className="flex items-center gap-2">
										<span className="text-xs text-gray-500 flex items-center gap-1">📱 {lang === "es" ? "Tel empleado:" : "Staff phone:"}</span>
										{editingPhone?.id === b.id ? (
											<>
												<input type="tel" value={editingPhone.phone} onChange={(e) => setEditingPhone({ id: b.id, phone: e.target.value })} placeholder="+1XXXXXXXXXX" className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs focus:outline-none" />
												<button type="button" onClick={() => phoneMutation.mutate({ barberId: b.id, phone: editingPhone.phone })} className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium">✓</button>
												<button type="button" onClick={() => setEditingPhone(null)} className="px-2 py-1 text-gray-500 text-xs">✕</button>
											</>
										) : (
											<>
												<span className="text-xs text-gray-400 flex-1">{(b as any).phone || "—"}</span>
												<button type="button" onClick={() => setEditingPhone({ id: b.id, phone: (b as any).phone ?? "" })} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
													{lang === "es" ? "Editar" : "Edit"}
												</button>
											</>
										)}
									</div>
								</div>


							</div>
						);
					})}
				</div>
			) : (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
					<GoolinextIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
					<p className="text-gray-500">{t.noBarbersMsg}</p>
				</div>
			)}
		</div>
	);
}

// ============ QR VIEW ============

function QRView({
	shopId,
	shopName,
	lang,
}: {
	shopId: number;
	shopName?: string;
	lang: Lang;
}) {
	const t = dash[lang];
	const registerUrl = `${window.location.origin}/register/${shopId}`;
	const bizUrl = `${window.location.origin}/biz/${shopId}`;
	const [cardLang, setCardLang] = useState<"en"|"es">(lang);
	const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(registerUrl)}&bgcolor=ffffff&color=111827&margin=2`;

	const cardTexts = {
		en: { headline: "JOIN THE LINE", sub: "Scan and register in seconds.\nYou'll get an alert when it's your turn.", s1: "Scan\nthe QR", s2: "Enter\nyour name", s3: "Wait for\nyour alert", badge: "SCAN TO JOIN THE LINE", footer: "POWERED BY GOOLINEXT · MAKEMCIE LLC" },
		es: { headline: "ÚNETE A LA COLA", sub: "Escanea y regístrate en segundos.\nRecibirás un aviso cuando sea tu turno.", s1: "Escanea\nel QR", s2: "Pon tu\nnombre", s3: "Espera\nel aviso", badge: "ESCANEAR PARA REGISTRARSE", footer: "POWERED BY GOOLINEXT · MAKEMCIE LLC" },
	};
	const ct = cardTexts[cardLang];

	const [downloading, setDownloading] = useState(false);

	const downloadCard = async () => {
		setDownloading(true);
		try {
			const qrDataUrl = await new Promise<string>((resolve) => {
				const img = new Image();
				img.crossOrigin = "anonymous";
				img.onload = () => {
					const c = document.createElement("canvas");
					c.width = img.width; c.height = img.height;
					c.getContext("2d")!.drawImage(img, 0, 0);
					resolve(c.toDataURL("image/png"));
				};
				img.src = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(registerUrl)}&bgcolor=ffffff&color=111827&margin=2`;
			});

			const W = 800, H = 1060;
			const canvas = document.createElement("canvas");
			canvas.width = W; canvas.height = H;
			const ctx = canvas.getContext("2d")!;

			// Background gradient
			const bg = ctx.createLinearGradient(0, 0, W, H);
			bg.addColorStop(0, "#0f0a05");
			bg.addColorStop(0.5, "#1a0d00");
			bg.addColorStop(1, "#0a0608");
			ctx.fillStyle = bg;
			roundRect(ctx, 0, 0, W, H, 40);
			ctx.fill();

			// Orange glow top-left
			const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
			glow.addColorStop(0, "rgba(249,115,22,0.12)");
			glow.addColorStop(1, "transparent");
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, W, H);

			// Logo box
			const logoGrad = ctx.createLinearGradient(48, 44, 110, 106);
			logoGrad.addColorStop(0, "#f97316");
			logoGrad.addColorStop(1, "#c2410c");
			ctx.fillStyle = logoGrad;
			roundRect(ctx, 48, 44, 62, 62, 16);
			ctx.fill();

			// G letter
			ctx.fillStyle = "white";
			ctx.font = "bold 36px Arial";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("G", 79, 76);

			// Brand name
			ctx.fillStyle = "white";
			ctx.font = "bold 34px Arial";
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillText("Goolinext", 122, 76);

			// Divider line
			const div = ctx.createLinearGradient(0, 130, W, 130);
			div.addColorStop(0, "transparent");
			div.addColorStop(0.5, "rgba(249,115,22,0.5)");
			div.addColorStop(1, "transparent");
			ctx.strokeStyle = div;
			ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.moveTo(48, 134); ctx.lineTo(W-48, 134); ctx.stroke();

			// Headline
			ctx.fillStyle = "white";
			ctx.font = "bold 64px Arial Black, Arial";
			ctx.textAlign = "left";
			ctx.textBaseline = "top";
			ctx.fillText(ct.headline, 48, 158);

			// Subtitle
			ctx.fillStyle = "#64748b";
			ctx.font = "22px Arial";
			ctx.textBaseline = "top";
			const lines = ct.sub.split("\n");
			lines.forEach((line, i) => ctx.fillText(line, 48, 242 + i * 32));

			// Steps
			const stepLabels = [ct.s1, ct.s2, ct.s3];
			const stepX = [136, 400, 664];
			stepLabels.forEach((label, i) => {
				// Circle
				ctx.strokeStyle = "rgba(249,115,22,0.3)";
				ctx.fillStyle = "rgba(249,115,22,0.1)";
				ctx.lineWidth = 1.5;
				ctx.beginPath(); ctx.arc(stepX[i], 340, 22, 0, Math.PI*2); ctx.fill(); ctx.stroke();
				// Number
				ctx.fillStyle = "#f97316";
				ctx.font = "bold 20px Arial";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(String(i+1), stepX[i], 340);
				// Label
				ctx.fillStyle = "#475569";
				ctx.font = "18px Arial";
				ctx.textBaseline = "top";
				const parts = label.replace("\n"," ").split(" ");
				ctx.fillText(parts.slice(0,2).join(" "), stepX[i], 374);
				if (parts.length > 2) ctx.fillText(parts.slice(2).join(" "), stepX[i], 398);
				// Connecting line
				if (i < 2) {
					ctx.strokeStyle = "rgba(249,115,22,0.2)";
					ctx.lineWidth = 1;
					ctx.beginPath(); ctx.moveTo(stepX[i]+26, 340); ctx.lineTo(stepX[i+1]-26, 340); ctx.stroke();
				}
			});

			// QR white background
			ctx.fillStyle = "white";
			ctx.shadowColor = "rgba(249,115,22,0.2)";
			ctx.shadowBlur = 30;
			roundRect(ctx, 80, 430, W-160, W-160, 20);
			ctx.fill();
			ctx.shadowBlur = 0;

			// Orange corner marks
			const corners = [[80,430],[W-80,430],[80,430+W-160],[W-80,430+W-160]];
			corners.forEach(([cx,cy], i) => {
				const [dx, dy] = [[1,1],[-1,1],[1,-1],[-1,-1]][i];
				ctx.strokeStyle = "#f97316";
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.moveTo(cx + dx*30, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy*30);
				ctx.stroke();
			});

			// QR image
			const qrImg = new Image();
			qrImg.crossOrigin = "anonymous";
			await new Promise<void>(resolve => { qrImg.onload = () => resolve(); qrImg.src = qrDataUrl; });
			const qrPad = 24;
			ctx.drawImage(qrImg, 80+qrPad, 430+qrPad, W-160-qrPad*2, W-160-qrPad*2);

			// Scan badge
			const badgeW = 340, badgeH = 36;
			const badgeX = (W - badgeW) / 2;
			const badgeY = 430 + W - 160 - 18;
			const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX+badgeW, badgeY);
			badgeGrad.addColorStop(0, "#f97316"); badgeGrad.addColorStop(1, "#ea580c");
			ctx.fillStyle = badgeGrad;
			ctx.shadowColor = "rgba(249,115,22,0.5)"; ctx.shadowBlur = 12;
			roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.fillStyle = "white";
			ctx.font = "bold 16px Arial";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("📱 " + ct.badge, W/2, badgeY + badgeH/2);

			// URL box
			const urlY = 430 + W - 160 + 38;
			ctx.fillStyle = "rgba(255,255,255,0.04)";
			ctx.strokeStyle = "rgba(255,255,255,0.08)";
			ctx.lineWidth = 1;
			roundRect(ctx, 48, urlY, W-96, 44, 12);
			ctx.fill(); ctx.stroke();
			ctx.fillStyle = "#f97316";
			ctx.beginPath(); ctx.arc(72, urlY+22, 5, 0, Math.PI*2); ctx.fill();
			ctx.fillStyle = "#64748b";
			ctx.font = "18px monospace";
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillText(`goolinext.com/register/${shopId}`, 86, urlY+22);

			// Footer
			ctx.fillStyle = "#334155";
			ctx.font = "16px Arial";
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";
			ctx.fillText(ct.footer, W/2, H-24);

			// Download
			const link = document.createElement("a");
			link.download = `goolinext-qr-${cardLang}-${shopId}.png`;
			link.href = canvas.toDataURL("image/png", 1.0);
			link.click();
		} catch(e) {
			console.error(e);
		} finally {
			setDownloading(false);
		}
	};

	function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
		ctx.beginPath();
		ctx.moveTo(x+r, y);
		ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
		ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
		ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
		ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
		ctx.closePath();
	}

	return (
		<div className="space-y-4">
			{/* Premium Print Card */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-base font-bold text-white">{lang === "es" ? "Cartel para imprimir" : "Print poster"}</h2>
					<div className="flex gap-2">
						<button type="button" onClick={() => setCardLang("en")} style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background:cardLang==="en"?"#f97316":"rgba(255,255,255,0.08)", color:cardLang==="en"?"white":"#64748b", fontFamily:"inherit" }}>EN</button>
						<button type="button" onClick={() => setCardLang("es")} style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background:cardLang==="es"?"#f97316":"rgba(255,255,255,0.08)", color:cardLang==="es"?"white":"#64748b", fontFamily:"inherit" }}>ES</button>
					</div>
				</div>

				{/* Card Preview */}
				<div id="qr-print-card" style={{ background:"linear-gradient(135deg,#0f0a05 0%,#1a0d00 50%,#0a0608 100%)", border:"1px solid rgba(249,115,22,0.3)", borderRadius:20, padding:"28px 24px 22px", position:"relative", overflow:"hidden", fontFamily:"'Plus Jakarta Sans',sans-serif", maxWidth:320, margin:"0 auto" }}>
					{/* Logo */}
					<div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
						<div style={{ width:32, height:32, background:"linear-gradient(135deg,#f97316,#c2410c)", borderRadius:9, position:"relative", flexShrink:0 }}>
							<span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-52%)", fontWeight:800, fontSize:17, color:"white", lineHeight:1 }}>G</span>
						</div>
						<span style={{ fontWeight:800, fontSize:17, color:"white", letterSpacing:"-0.5px" }}>Goolinext</span>
					</div>
					<div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(249,115,22,0.4),transparent)", marginBottom:18 }} />

					{/* Headline */}
					<h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, color:"white", letterSpacing:1, lineHeight:1, marginBottom:4 }}>{ct.headline}</h1>
					<p style={{ fontSize:11, color:"#64748b", marginBottom:18, lineHeight:1.6, whiteSpace:"pre-line" }}>{ct.sub}</p>

					{/* Steps */}
					<div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:18 }}>
						{[ct.s1, ct.s2, ct.s3].map((s, i) => (
							<div key={i} style={{ display:"flex", alignItems:"center", gap:4, flex:1 }}>
								<div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
									<div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(249,115,22,0.12)", border:"1px solid rgba(249,115,22,0.25)", position:"relative" }}>
										<span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-52%)", fontSize:10, fontWeight:700, color:"#f97316", lineHeight:1 }}>{i+1}</span>
									</div>
									<span style={{ fontSize:9, color:"#475569", textAlign:"center", lineHeight:1.4, whiteSpace:"pre-line" }}>{s}</span>
								</div>
								{i < 2 && <div style={{ width:20, height:1, background:"rgba(249,115,22,0.2)", marginBottom:16, flexShrink:0 }} />}
							</div>
						))}
					</div>

					{/* QR Code */}
					<div style={{ position:"relative", background:"white", borderRadius:14, padding:12, marginBottom:28, boxShadow:"0 0 0 1px rgba(249,115,22,0.2),0 8px 28px rgba(249,115,22,0.15)" }}>
						{[["tl","top:6px;left:6px;borderTop","borderLeft"],["tr","top:6px;right:6px;borderTop","borderRight"],["bl","bottom:6px;left:6px;borderBottom","borderLeft"],["br","bottom:6px;right:6px;borderBottom","borderRight"]].map(([k,b1,b2]) => (
							<div key={k} style={{ position:"absolute", width:16, height:16, ...(b1.includes("top")?{top:6}:{bottom:6}), ...(b2.includes("left")?{left:6}:{right:6}), borderTop:b1.includes("Top")?"2.5px solid #f97316":"none", borderBottom:b1.includes("Bottom")?"2.5px solid #f97316":"none", borderLeft:b2.includes("Left")?"2.5px solid #f97316":"none", borderRight:b2.includes("Right")?"2.5px solid #f97316":"none", borderRadius:k==="tl"?"3px 0 0 0":k==="tr"?"0 3px 0 0":k==="bl"?"0 0 0 3px":"0 0 3px 0" }} />
						))}
						<img src={qrUrl} alt="QR" style={{ width:"100%", display:"block", borderRadius:6 }} />
						<div style={{ position:"absolute", bottom:-12, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#f97316,#ea580c)", color:"white", fontSize:9, fontWeight:700, padding:"4px 12px", borderRadius:20, whiteSpace:"nowrap", letterSpacing:"0.08em", boxShadow:"0 3px 10px rgba(249,115,22,0.4)" }}>📱 {ct.badge}</div>
					</div>

					{/* URL */}
					<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 12px", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
						<div style={{ width:5, height:5, borderRadius:"50%", background:"#f97316", flexShrink:0 }} />
						<span style={{ fontSize:10, color:"#64748b", fontFamily:"monospace" }}>goolinext.com/register/{shopId}</span>
					</div>
					<div style={{ textAlign:"center", fontSize:9, color:"#334155", letterSpacing:"0.05em" }}>{ct.footer}</div>
				</div>

				{/* Download/Print buttons */}
				<div className="flex gap-3 mt-5">
					<button type="button" onClick={downloadCard} disabled={downloading} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-60">
						{downloading ? <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /> : <Download className="w-4 h-4" />}
						{downloading ? (lang === "es" ? "Generando..." : "Generating...") : (lang === "es" ? "Descargar PNG" : "Download PNG")}
					</button>
					<button type="button" onClick={() => navigator.clipboard.writeText(registerUrl)} className="px-4 py-3 bg-gray-800 text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-700 transition-all">
						<Copy className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Business Public Page */}
			<div className="bg-gray-900/60 border border-amber-500/20 rounded-2xl p-6">
				<div className="flex items-center gap-3 mb-3">
					<div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
						<Globe className="w-4 h-4 text-amber-400" />
					</div>
					<div>
						<h3 className="text-white font-bold text-sm">
							{lang === "es" ? "Página pública de tu negocio" : "Your Business Public Page"}
						</h3>
						<p className="text-gray-500 text-xs">
							{lang === "es" ? "Comparte este link en Google y redes sociales" : "Share this link on Google and social media"}
						</p>
					</div>
				</div>
				<div className="bg-gray-800 rounded-xl p-3 mb-3">
					<p className="text-amber-400 text-xs break-all font-mono">{registerUrl}</p>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => navigator.clipboard.writeText(registerUrl)}
						className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-all"
					>
						{lang === "es" ? "📋 Copiar link" : "📋 Copy link"}
					</button>
					<a
						href={registerUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex-1 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-xs font-semibold text-center hover:bg-amber-500/10 transition-all"
					>
						{lang === "es" ? "👁️ Ver página" : "👁️ Preview"}
					</a>
				</div>
			</div>
		</div>
	);
}

// ============ CLIENTS VIEW ============

function ClientsView({ shopId, lang }: { shopId: number; lang: Lang }) {
	const t = dash[lang];
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [editingClient, setEditingClient] = useState<{
		id: number;
		name: string;
		phone: string;
		email: string;
	} | null>(null);
	const [deletingClientId, setDeletingClientId] = useState<number | null>(null);
	const [downloading, setDownloading] = useState(false);

	const { data: clientList, isLoading } = useQuery({
		queryKey: ["shopClients", shopId],
		queryFn: () => getShopClients({ data: { shopId } }),
	});

	const filtered = useMemo(() => {
		if (!clientList) return [];
		if (!search.trim()) return clientList;
		const q = search.toLowerCase();
		return clientList.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.phone?.toLowerCase().includes(q) ||
				c.email?.toLowerCase().includes(q),
		);
	}, [clientList, search]);

	const formatDate = (date: Date | string | null) => {
		if (!date) return t.never;
		const d = new Date(date);
		return d.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const updateMut = useMutation({
		mutationFn: (vars: {
			clientId: number;
			name?: string;
			phone?: string;
			email?: string | null;
		}) =>
			updateClient({
				data: { ...vars, shopId },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shopClients", shopId] });
			setEditingClient(null);
		},
	});

	const deleteMut = useMutation({
		mutationFn: (clientId: number) =>
			deleteClient({ data: { clientId, shopId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shopClients", shopId] });
			setDeletingClientId(null);
		},
	});

	const handleExport = async () => {
		setDownloading(true);
		try {
			const data = await exportClientsCSV({ data: { shopId } });
			// Build CSV string
			const headers = [
				lang === "es" ? "Nombre" : "Name",
				lang === "es" ? "Teléfono" : "Phone",
				"Email",
				lang === "es" ? "Consentimiento SMS" : "SMS Consent",
				lang === "es" ? "Visitas" : "Visits",
				lang === "es" ? "Última visita" : "Last Visit",
				lang === "es" ? "Registrado" : "Registered",
			];
			const escapeCSV = (v: string) => {
				if (v.includes(",") || v.includes('"') || v.includes("\n"))
					return `"${v.replace(/"/g, '""')}"`;
				return v;
			};
			type ExportClient = {
				name: string;
				phone: string | null;
				email: string | null;
				smsConsented: boolean | null;
				visitCount: number;
				lastVisitAt: Date | string | null;
				createdAt: Date | string | null;
			};
			const rows = data.map((c: ExportClient) =>
				[
					escapeCSV(c.name),
					escapeCSV(c.phone || ""),
					escapeCSV(c.email || ""),
					c.smsConsented ? (lang === "es" ? "Sí" : "Yes") : "No",
					String(c.visitCount ?? 0),
					c.lastVisitAt ? formatDate(c.lastVisitAt) : "",
					c.createdAt ? formatDate(c.createdAt) : "",
				].join(","),
			);
			const csv = [headers.join(","), ...rows].join("\n");
			const blob = new Blob([`\uFEFF${csv}`], {
				type: "text/csv;charset=utf-8;",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error("Export failed", e);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white">{t.clientsTitle}</h2>
					<p className="text-sm text-gray-500">{t.clientsDesc}</p>
				</div>
				<button
					type="button"
					onClick={handleExport}
					disabled={downloading || !clientList?.length}
					className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
				>
					<Download className="w-4 h-4" />
					{downloading ? t.downloading : t.exportCsv}
				</button>
			</div>

			{/* Search + count */}
			<div className="flex items-center gap-3">
				<div className="flex-1 relative">
					<Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t.searchClients}
						className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					/>
				</div>
				<span className="text-sm text-gray-500 whitespace-nowrap">
					{t.totalClients(clientList?.length ?? 0)}
				</span>
			</div>

			{/* Table */}
			{isLoading ? (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
					<p className="text-gray-500 animate-pulse">
						{lang === "es" ? "Cargando..." : "Loading..."}
					</p>
				</div>
			) : filtered.length > 0 ? (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
					{/* Table header */}
					<div className="hidden lg:grid grid-cols-[1fr_1fr_1fr_60px_80px_100px_90px] gap-2 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium uppercase tracking-wider">
						<span>{t.clientName}</span>
						<span>{t.clientPhone}</span>
						<span>{t.clientEmail}</span>
						<span className="text-center">{t.visitCount}</span>
						<span className="text-center">{t.clientSms}</span>
						<span>{t.clientLastVisit}</span>
						<span className="text-center">{t.actions}</span>
					</div>

					{/* Rows */}
					<div className="divide-y divide-gray-800/50">
						{filtered.map((c) => (
							<div
								key={c.id}
								className="px-5 py-3 lg:grid lg:grid-cols-[1fr_1fr_1fr_60px_80px_100px_90px] lg:gap-2 lg:items-center"
							>
								{/* Name */}
								<div className="flex items-center gap-2">
									<div className="w-8 h-8 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-full flex items-center justify-center flex-shrink-0">
										<User className="w-3.5 h-3.5 text-amber-400" />
									</div>
									<p className="text-white font-medium truncate">{c.name}</p>
								</div>
								{/* Phone */}
								<p className="text-gray-400 text-sm truncate mt-1 lg:mt-0">
									{c.phone || "—"}
								</p>
								{/* Email */}
								<p className="text-gray-400 text-sm truncate mt-1 lg:mt-0">
									{c.email || "—"}
								</p>
								{/* Visit count */}
								<p className="text-gray-400 text-sm mt-1 lg:mt-0 lg:text-center">
									{c.visitCount ?? 0}
								</p>
								{/* SMS consent */}
								<div className="mt-1 lg:mt-0 lg:text-center">
									{c.smsConsented ? (
										<span className="inline-block px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-lg">
											{t.yes}
										</span>
									) : (
										<span className="inline-block px-2 py-0.5 text-xs bg-gray-700 text-gray-500 rounded-lg">
											{t.no}
										</span>
									)}
								</div>
								{/* Last visit */}
								<p className="text-gray-500 text-sm mt-1 lg:mt-0">
									{formatDate(c.lastVisitAt)}
								</p>
								{/* Actions */}
								<div className="flex items-center gap-1 mt-2 lg:mt-0 lg:justify-center">
									<button
										type="button"
										onClick={() =>
											setEditingClient({
												id: c.id,
												name: c.name,
												phone: c.phone || "",
												email: c.email || "",
											})
										}
										className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-amber-400 transition-colors"
										title={t.editClient}
									>
										<Pencil className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={() => setDeletingClientId(c.id)}
										className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
										title={t.deleteClient}
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			) : (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
					<Database className="w-10 h-10 text-gray-600 mx-auto mb-3" />
					<p className="text-gray-500">
						{search.trim()
							? lang === "es"
								? "No se encontraron clientes"
								: "No clients found"
							: t.noClientsYet}
					</p>
				</div>
			)}

			{/* Edit Modal */}
			{editingClient && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
						<h3 className="text-lg font-semibold text-white">
							{t.editClientTitle}
						</h3>
						<div className="space-y-3">
							<label className="block">
								<span className="block text-xs text-gray-400 mb-1">
									{t.clientName}
								</span>
								<input
									type="text"
									value={editingClient.name}
									onChange={(e) =>
										setEditingClient({
											...editingClient,
											name: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
								/>
							</label>
							<label className="block">
								<span className="block text-xs text-gray-400 mb-1">
									{t.clientPhone}
								</span>
								<input
									type="tel"
									value={editingClient.phone}
									onChange={(e) =>
										setEditingClient({
											...editingClient,
											phone: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
								/>
							</label>
							<label className="block">
								<span className="block text-xs text-gray-400 mb-1">
									{t.clientEmail}
								</span>
								<input
									type="email"
									value={editingClient.email}
									onChange={(e) =>
										setEditingClient({
											...editingClient,
											email: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
								/>
							</label>
						</div>
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setEditingClient(null)}
								className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm font-medium"
							>
								{t.cancelBtn}
							</button>
							<button
								type="button"
								disabled={updateMut.isPending || !editingClient.name.trim()}
								onClick={() =>
									updateMut.mutate({
										clientId: editingClient.id,
										name: editingClient.name.trim(),
										phone: editingClient.phone.trim() || undefined,
										email: editingClient.email.trim() || null,
									})
								}
								className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-medium"
							>
								{updateMut.isPending ? t.saving2 : t.save}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deletingClientId !== null && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
						<h3 className="text-lg font-semibold text-white">
							{t.deleteClient}
						</h3>
						<p className="text-sm text-gray-400">{t.deleteConfirm}</p>
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setDeletingClientId(null)}
								className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm font-medium"
							>
								{t.cancelBtn}
							</button>
							<button
								type="button"
								disabled={deleteMut.isPending}
								onClick={() => deleteMut.mutate(deletingClientId)}
								className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-medium"
							>
								{deleteMut.isPending ? t.saving2 : t.deleteConfirmBtn}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}



// ============ PAYWALL SCREEN ============
function PaywallScreen({ lang: initialLang, onPaid, isExpired }: { lang: Lang; onPaid: () => void; isExpired?: boolean }) {
	const [lang, setLang] = useState<Lang>(initialLang);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleLogout = async () => {
		try { await logout(); } catch {} finally { window.location.reload(); }
	};

	const handleSubscribe = async () => {
		try {
			setLoading(true);
			setError("");
			const result = await createCheckoutSession();
			if (result?.url) {
				window.location.href = result.url;
			} else {
				setError(lang === "es" ? "Error al crear sesión de pago" : "Error creating payment session");
			}
		} catch (e: any) {
			setError(e.message ?? "Error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ minHeight: "100dvh", width: "100%", background: "linear-gradient(135deg, #030305 0%, #0a0a0f 50%, #030305 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
			{/* Language Toggle */}
			<div style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 6, zIndex: 100 }}>
				<button type="button" onClick={() => setLang("en")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === "en" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang === "en" ? "white" : "#64748b" }}>EN</button>
				<button type="button" onClick={() => setLang("es")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === "es" ? "#f97316" : "rgba(255,255,255,0.08)", color: lang === "es" ? "white" : "#64748b" }}>ES</button>
			</div>

			<div style={{ maxWidth: 440, width: "100%", background: "rgba(15,15,20,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 32px", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
				<div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
					<GoolinextIcon className="w-8 h-8 text-white" />
				</div>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", marginBottom: 8 }}>Goolinext Pro</h1>
				{isExpired && (
					<div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
						<p style={{ color: "#22c55e", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
							{lang === "es" ? "✓ Tus datos están seguros" : "✓ Your data is safe"}
						</p>
						<p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
							{lang === "es"
								? "Todos tus clientes, historial y configuración están guardados. Reactiva tu cuenta y continúa donde lo dejaste."
								: "All your clients, history and settings are saved. Reactivate your account and continue where you left off."}
						</p>
					</div>
				)}
				<p style={{ color: "#64748b", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
					{isExpired
						? (lang === "es"
							? "Tu suscripción está inactiva. Reactiva ahora para volver a usar Goolinext Pro."
							: "Your subscription is inactive. Reactivate now to use Goolinext Pro again.")
						: (lang === "es"
							? "Activa tu suscripción para acceder al sistema completo de gestión de tu negocio."
							: "Activate your subscription to access the complete business management system.")
					}
				</p>

				{/* Features */}
				<div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, textAlign: "left" }}>
					{[
						lang === "es" ? "Cola virtual en tiempo real" : "Real-time virtual queue",
						lang === "es" ? "Clientes se unen escaneando tu QR" : "Clients join by scanning your QR",
						lang === "es" ? "Seguimiento de turnos en vivo" : "Live turn tracking",
						lang === "es" ? "Página pública profesional para tu negocio" : "Professional public page for your business",
						lang === "es" ? "Base de datos de clientes (exportable)" : "Client database (exportable)",
						lang === "es" ? "QR para gestionar reseñas y reputación" : "QR to manage reviews and reputation",
						lang === "es" ? "Control total del flujo de clientes" : "Full client flow control",
						lang === "es" ? "Clientes y empleados ilimitados" : "Unlimited clients and staff",
						lang === "es" ? "Soporte personal por WhatsApp 24/7" : "Personal WhatsApp support 24/7",
					].map((feature, i) => (
						<div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" }}>
							<div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
								<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
							</div>
							<span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.4 }}>{feature}</span>
						</div>
					))}
				</div>

				{/* Price */}
				<div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
					<p style={{ fontSize: "2rem", fontWeight: 800, color: "white", margin: 0 }}>$89<span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 400 }}>/mo</span></p>
					<p style={{ color: "#f97316", fontSize: 12, marginTop: 4 }}>{lang === "es" ? "Todo incluido · Sin contratos" : "All included · No contracts"}</p>
				</div>

				{error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

				<button
					type="button"
					onClick={handleSubscribe}
					disabled={loading}
					style={{ width: "100%", padding: "16px", background: loading ? "#92400e" : "linear-gradient(135deg, #f97316, #ea580c)", color: "white", fontWeight: 700, fontSize: 16, border: "none", borderRadius: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 8px 30px rgba(249,115,22,0.35)" }}
				>
					{loading ? "..." : (lang === "es" ? "Activar por $89/mes" : "Activate for $89/mo")}
				</button>
				<p style={{ color: "#334155", fontSize: 11, marginTop: 12 }}>
					{lang === "es" ? "Pago seguro vía Stripe · Cancela cuando quieras" : "Secure payment via Stripe · Cancel anytime"}
				</p>
				<div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ fontSize: 16 }}>🛡️</span>
					<p style={{ color: "#4ade80", fontSize: 12, fontWeight: 600, margin: 0 }}>
						{lang === "es" ? "Garantía de devolución de 7 días — sin preguntas." : "7-Day Money-Back Guarantee — no questions asked."}
						{" "}<a href="/terms" style={{ color:"#86efac", fontSize:11, textDecoration:"underline" }}>{lang === "es" ? "Ver política" : "See policy"}</a>
					</p>
				</div>
				<button
					type="button"
					onClick={handleLogout}
					style={{ marginTop: 16, background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
				>
					{lang === "es" ? "Cerrar sesión" : "Sign out"}
				</button>
			</div>
		</div>
	);
}

// ============ SUBSCRIPTION BANNER ============
function SubscriptionBanner({ lang }: { lang: Lang }) {
	return null; // Banner replaced by paywall
}


// ============ APPOINTMENTS VIEW ============
function HelpView({ shopName, lang }: { shopName: string; lang: Lang }) {
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	const mutation = useMutation({
		mutationFn: () => sendSupportEmail({
			data: { subject, message, shopName, userEmail: email },
		}),
		onSuccess: () => {
			setSent(true);
			setSubject("");
			setMessage("");
			setEmail("");
		},
	});

	if (sent) {
		return (
			<div className="max-w-lg mx-auto">
				<div className="bg-gray-900/60 border border-green-500/30 rounded-2xl p-8 text-center">
					<div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
						<Check className="w-8 h-8 text-green-400" />
					</div>
					<h2 className="text-xl font-bold text-white mb-2">
						{lang === "es" ? "¡Mensaje enviado!" : "Message sent!"}
					</h2>
					<p className="text-gray-400 text-sm mb-6">
						{lang === "es"
							? "Hemos recibido tu mensaje. Te responderemos pronto."
							: "We received your message. We will get back to you soon."}
					</p>
					<button
						type="button"
						onClick={() => setSent(false)}
						className="px-6 py-2.5 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-all text-sm font-medium"
					>
						{lang === "es" ? "Enviar otro mensaje" : "Send another message"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-lg mx-auto space-y-4">
			{/* WhatsApp button */}
			<a
				href="https://wa.me/16465154329"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-4 p-5 bg-green-500/10 border border-green-500/30 rounded-2xl hover:bg-green-500/20 transition-all"
			>
				<div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
					<span style={{ fontSize: 24 }}>💬</span>
				</div>
				<div>
					<p className="text-white font-bold text-sm">
						{lang === "es" ? "Chatea con nosotros en WhatsApp" : "Chat with us on WhatsApp"}
					</p>
					<p className="text-green-400 text-xs mt-0.5">
						{lang === "es" ? "Respuesta rápida • Soporte directo" : "Fast response • Direct support"}
					</p>
				</div>
				<span className="ml-auto text-green-400">↗</span>
			</a>

			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
				<div className="flex items-center gap-3 mb-6">
					<div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
						<Bell className="w-5 h-5 text-amber-400" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">
							{lang === "es" ? "Envíanos un mensaje" : "Send us a message"}
						</h2>
						<p className="text-sm text-gray-500">
							{lang === "es"
								? "¿Tienes algún problema? Escríbenos y te ayudamos."
								: "Having an issue? Write to us and we will help you."}
						</p>
					</div>
				</div>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-1">
							{lang === "es" ? "Tu email" : "Your email"}
						</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={lang === "es" ? "tu@email.com" : "you@email.com"}
							className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-1">
							{lang === "es" ? "Asunto" : "Subject"}
						</label>
						<input
							type="text"
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							placeholder={lang === "es" ? "¿En qué podemos ayudarte?" : "How can we help you?"}
							className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-1">
							{lang === "es" ? "Mensaje" : "Message"}
						</label>
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={5}
							placeholder={lang === "es"
								? "Describe tu problema o pregunta en detalle..."
								: "Describe your issue or question in detail..."}
							className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
						/>
					</div>
					{mutation.isError && (
						<p className="text-red-400 text-sm">
							{lang === "es" ? "Error al enviar. Intenta de nuevo." : "Failed to send. Please try again."}
						</p>
					)}
					<button
						type="button"
						onClick={() => mutation.mutate()}
						disabled={!subject.trim() || !message.trim() || !email.trim() || mutation.isPending}
						className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all"
					>
						{mutation.isPending
							? (lang === "es" ? "Enviando..." : "Sending...")
							: (lang === "es" ? "Enviar mensaje" : "Send message")}
					</button>
				</div>
			</div>
		</div>
	);
}

// ============ SETTINGS VIEW ============

function SettingsView({
	shop,
	lang,
}: {
	shop: {
		id: number;
		name: string;
		googleReviewLink: string | null;
	};
	lang: Lang;
}) {
	const t = dash[lang];
	const queryClient = useQueryClient();
	const bizUrl = typeof window !== "undefined" ? `${window.location.origin}/biz/${shop.id}` : "";
	const { data: fullShop } = useQuery({
		queryKey: ["myShop"],
		queryFn: () => getMyShop(),
	});

	const [shopName, setShopName] = useState(fullShop?.name ?? shop.name ?? "");
	const [shopAddress, setShopAddress] = useState(fullShop?.address ?? "");
	const [shopPhone, setShopPhone] = useState(fullShop?.phone ?? "");
	const [googleLink, setGoogleLink] = useState(
		fullShop?.googleReviewLink ?? "",
	);
	const [welcomeMsg, setWelcomeMsg] = useState(fullShop?.welcomeMessage ?? "");
	const [welcomeMsgEn, setWelcomeMsgEn] = useState(fullShop?.welcomeMessageEn ?? "");
	const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";
	const [followUpMsg, setFollowUpMsg] = useState(
		fullShop?.followUpMessage ?? "",
	);
	const [twilioSid, setTwilioSid] = useState(fullShop?.twilioSid ?? "");
	const [twilioToken, setTwilioToken] = useState(fullShop?.twilioToken ?? "");
	const [twilioPhone, setTwilioPhone] = useState(fullShop?.twilioPhone ?? "");
	const [smsConsentText, setSmsConsentText] = useState(
		fullShop?.smsConsentText ?? "",
	);
	const [reminderMessage, setReminderMessage] = useState(
		fullShop?.reminderMessage ?? "",
	);
	const [reminderDays, setReminderDays] = useState(
		fullShop?.reminderDays ?? 30,
	);
	const [logoUrl, setLogoUrl] = useState(fullShop?.logoUrl ?? "");
	const [showQr, setShowQr] = useState(fullShop?.showQr ?? true);
	const [announceTurnEnabled, setAnnounceTurnEnabled] = useState(fullShop?.announceTurnEnabled ?? true);
	const [ownerPhone, setOwnerPhone] = useState("");

	// Load owner phone
	const { data: ownerPhoneData } = useQuery({
		queryKey: ["ownerPhone"],
		queryFn: () => getOwnerPhone(),
	});

	useEffect(() => {
		if (ownerPhoneData?.phone) setOwnerPhone(ownerPhoneData.phone);
	}, [ownerPhoneData]);

	useEffect(() => {
		if (fullShop) {
			if (fullShop.name) setShopName(fullShop.name);
			if (fullShop.address) setShopAddress(fullShop.address);
			if (fullShop.phone) setShopPhone(fullShop.phone);
			if (fullShop.showQr !== undefined) setShowQr(fullShop.showQr);
		}
	}, [fullShop]);

	const savePhoneMutation = useMutation({
		mutationFn: () => updateOwnerPhone({ data: { phone: ownerPhone } }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ownerPhone"] }),
	});

	const qrToggleMutation = useMutation({
		mutationFn: async (newValue: boolean) => {
			await updateShop({
				data: {
					id: shop.id,
					showQr: newValue,
				},
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["myShop"] });
			queryClient.invalidateQueries({ queryKey: ["shopPublic", shop.id] });
		},
	});

	const announceTurnMutation = useMutation({
		mutationFn: async (newValue: boolean) => {
			await updateShop({
				data: {
					id: shop.id,
					announceTurnEnabled: newValue,
				},
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["myShop"] });
			queryClient.invalidateQueries({ queryKey: ["shopPublic", shop.id] });
		},
	});


		const defaultHours = {
		0: { open: "09:00", close: "18:00", closed: true },
		1: { open: "09:00", close: "19:00", closed: false },
		2: { open: "09:00", close: "19:00", closed: false },
		3: { open: "09:00", close: "19:00", closed: false },
		4: { open: "09:00", close: "19:00", closed: false },
		5: { open: "09:00", close: "19:00", closed: false },
		6: { open: "09:00", close: "17:00", closed: false },
	};
	const [weeklyHours, setWeeklyHours] = useState<Record<number, { open: string; close: string; closed: boolean }>>(
		fullShop?.weeklyHours ? JSON.parse(fullShop.weeklyHours) : defaultHours
	);
	const [logoUploading, setLogoUploading] = useState(false);
	const logoInputRef = useRef<HTMLInputElement>(null);

	const mutation = useMutation({
		mutationFn: async () => {
			// Save shop settings
			await updateShop({
				data: {
					id: shop.id,
					name: shopName.trim() || undefined,
					address: shopAddress.trim() || undefined,
					phone: shopPhone.trim() || undefined,
					googleReviewLink: googleLink || undefined,
					welcomeMessage: welcomeMsg || undefined,
					welcomeMessageEn: welcomeMsgEn || undefined,
					followUpMessage: followUpMsg || undefined,
					twilioSid: twilioSid || undefined,
					twilioToken: twilioToken || undefined,
					twilioPhone: twilioPhone || undefined,
					smsConsentText: smsConsentText || undefined,
					reminderMessage: reminderMessage || undefined,
					reminderDays: reminderDays,
					logoUrl: logoUrl || undefined,
					weeklyHours: JSON.stringify(weeklyHours),
					timezone,
				},
			});
			// Also save owner phone if provided
			if (ownerPhone) {
				await updateOwnerPhone({ data: { phone: ownerPhone } });
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["myShop"] });
			queryClient.invalidateQueries({ queryKey: ["ownerPhone"] });
		},
	});

	return (
		<div className="space-y-6">


			{/* Messages + SMS - hidden until enabled */}

			{/* Business Public Page */}
			<div className="bg-gray-900/60 border border-amber-500/20 rounded-2xl p-5 space-y-4">
				<h3 className="text-lg font-semibold text-white flex items-center gap-2">
					<Globe className="w-5 h-5 text-amber-400" />
					{lang === "es" ? "Página pública del negocio" : "Business Public Page"}
				</h3>

				{/* Logo Upload */}
				<div>
					<label className="block text-sm font-medium text-gray-300 mb-2">
						{lang === "es" ? "Logo del negocio" : "Business Logo"}
					</label>
					<div className="flex items-center gap-4">
						<div className="relative group">
							<button
								type="button"
								onClick={() => logoInputRef.current?.click()}
								className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-gray-600 hover:border-amber-500 transition-colors flex items-center justify-center bg-gray-800 relative"
							>
								{logoUrl ? (
									<img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
								) : (
									<div className="flex flex-col items-center gap-1">
										<Camera className="w-6 h-6 text-gray-500" />
										<span className="text-xs text-gray-500">{lang === "es" ? "Subir" : "Upload"}</span>
									</div>
								)}
								{logoUploading && (
									<div className="absolute inset-0 bg-black/60 flex items-center justify-center">
										<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									</div>
								)}
							</button>
							<input
								ref={logoInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={async (e) => {
									const file = e.target.files?.[0];
									if (!file) return;
									try {
										setLogoUploading(true);
										// Inline high-quality image resize - 800px max, 0.92 quality
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const img = new Image();
				img.onload = () => {
					let w = img.width, h = img.height;
					const MAX = 800;
					if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
					else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
					const c = document.createElement("canvas");
					c.width = w; c.height = h;
					const ctx = c.getContext("2d")!;
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = "high";
					ctx.drawImage(img, 0, 0, w, h);
					resolve(c.toDataURL("image/jpeg", 0.98));
				};
				img.onerror = reject;
				img.src = reader.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
										setLogoUrl(dataUrl);
									} catch {}
									finally { setLogoUploading(false); }
									e.target.value = "";
								}}
							/>
						</div>
						<div>
							<p className="text-sm text-gray-300 font-medium mb-1">
								{lang === "es" ? "Haz click para subir tu logo" : "Click to upload your logo"}
							</p>
							<p className="text-xs text-gray-500">
								{lang === "es" ? "JPG, PNG o WebP. Se mostrará en tu página pública." : "JPG, PNG or WebP. Shown on your public page."}
							</p>
							{logoUrl && (
								<button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-400 hover:text-red-300 mt-1">
									{lang === "es" ? "Eliminar logo" : "Remove logo"}
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Business Hours */}
				<div>
					<label className="block text-sm font-medium text-gray-300 mb-3">
						{lang === "es" ? "Horario por día" : "Hours per day"}
					</label>
					<div className="space-y-2">
						{[0,1,2,3,4,5,6].map((dayIdx) => {
							const dayNames = lang === "es"
								? ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
								: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
							const day = weeklyHours[dayIdx] ?? { open: "09:00", close: "19:00", closed: false };
							return (
								<div key={dayIdx} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
									<span className="text-sm text-gray-300 w-24 flex-shrink-0">{dayNames[dayIdx]}</span>
									{day.closed ? (
										<span className="text-sm text-gray-500 flex-1">{lang === "es" ? "Cerrado" : "Closed"}</span>
									) : (
										<div className="flex items-center gap-2 flex-1">
											<input
												type="time"
												value={day.open}
												onChange={(e) => setWeeklyHours(prev => ({ ...prev, [dayIdx]: { ...prev[dayIdx], open: e.target.value } }))}
												className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
											/>
											<span className="text-gray-500 text-sm">–</span>
											<input
												type="time"
												value={day.close}
												onChange={(e) => setWeeklyHours(prev => ({ ...prev, [dayIdx]: { ...prev[dayIdx], close: e.target.value } }))}
												className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
											/>
										</div>
									)}
									<button
										type="button"
										onClick={() => setWeeklyHours(prev => ({ ...prev, [dayIdx]: { ...prev[dayIdx], closed: !prev[dayIdx]?.closed } }))}
										className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${day.closed ? "bg-gray-700 text-gray-400" : "bg-red-900/40 text-red-400"}`}
									>
										{day.closed ? (lang === "es" ? "Abrir" : "Open") : (lang === "es" ? "Cerrar" : "Close")}
									</button>
								</div>
							);
						})}
					</div>
				</div>

				{/* Public page link */}
				<div className="bg-gray-800 rounded-xl p-3">
					<p className="text-xs text-gray-500 mb-1">{lang === "es" ? "Link de tu página:" : "Your page link:"}</p>
					<p className="text-amber-400 text-xs font-mono break-all">
						{typeof window !== "undefined" ? `${window.location.origin}/biz/${shop.id}` : ""}
					</p>
				</div>
			</div>

			{/* Welcome message - single English field, auto-translated on public page */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
				<h3 className="text-sm font-semibold text-white">{lang === "es" ? "Mensaje de bienvenida (página pública)" : "Welcome message (public page)"}</h3>
				<p className="text-xs text-gray-500">{lang === "es" ? "Escríbelo en inglés. Se muestra en la página pública del negocio." : "Write it in English. It shows on your business public page."}</p>
				<textarea value={welcomeMsgEn} onChange={e => setWelcomeMsgEn(e.target.value)} rows={3}
					placeholder="Where precision meets passion. The finest cuts, the best experience."
					className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none text-sm" />
			</div>

			{/* Business Info */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-sm font-bold text-white">{lang === "es" ? "Información del negocio" : "Business Information"}</h3>
				<div>
					<label className="block text-xs font-medium text-gray-400 mb-1.5">{t.setupName} <span className="text-red-400">*</span></label>
					<input type="text" value={shopName} onChange={e => setShopName(e.target.value)}
						placeholder={t.setupNamePlaceholder}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
				</div>
				<div>
					<label className="block text-xs font-medium text-gray-400 mb-1.5">{t.setupAddress} <span className="text-red-400">*</span></label>
					<input type="text" value={shopAddress} onChange={e => setShopAddress(e.target.value)}
						placeholder={t.setupAddressPlaceholder}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
				</div>
				<div>
					<label className="block text-xs font-medium text-gray-400 mb-1.5">{t.setupPhone} <span className="text-red-400">*</span></label>
					<input type="tel" value={shopPhone} onChange={e => setShopPhone(e.target.value)}
						placeholder={t.setupPhonePlaceholder}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
				</div>
			</div>

			{/* Google Review Link */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
				<h3 className="text-base font-semibold text-white flex items-center gap-2">
					<Star className="w-4 h-4 text-amber-400" />
					{lang === "es" ? "Link de reseñas de Google" : "Google Reviews link"}
				</h3>
				<p className="text-xs text-gray-500">{lang === "es" ? "Aparecerá en tu página pública para que los clientes dejen reseñas." : "Shown on your public page so clients can leave reviews."}</p>
				<input
					type="url"
					value={googleLink}
					onChange={(e) => setGoogleLink(e.target.value)}
					placeholder="https://g.page/r/..."
					className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
				/>
			</div>

						

			{/* QR Code Settings */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
				<h3 className="text-base font-semibold text-white flex items-center gap-2">
					<QrCode className="w-4 h-4 text-amber-400" />
					{lang === "es" ? "Código QR de la cola" : "Queue QR Code"}
				</h3>
				<p className="text-xs text-gray-500">
					{lang === "es" 
						? "Controla si el código QR se muestra en la pantalla de la cola en tiempo real." 
						: "Control whether the QR code displays on the live queue screen."}
				</p>
				<div className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
					<label className="text-sm font-medium text-gray-300">
						{lang === "es" ? "Mostrar QR en la cola" : "Show QR on queue display"}
					</label>
					<button
						type="button"
						onClick={() => { const newVal = !showQr; setShowQr(newVal); qrToggleMutation.mutate(newVal); }}
						className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
							showQr ? "bg-green-600" : "bg-gray-600"
						}`}
					>
						<span
							className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
								showQr ? "translate-x-7" : "translate-x-1"
							}`}
						/>
					</button>
				</div>

				<div className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
					<label className="text-sm font-medium text-gray-300">
						{lang === "es" ? "Anunciar turno cuando cliente llega" : "Announce turn when client arrives"}
					</label>
					<button
						type="button"
						onClick={() => { const newVal = !announceTurnEnabled; setAnnounceTurnEnabled(newVal); announceTurnMutation.mutate(newVal); }}
						className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
							announceTurnEnabled ? "bg-green-600" : "bg-gray-600"
						}`}
					>
						<span
							className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
								announceTurnEnabled ? "translate-x-7" : "translate-x-1"
							}`}
						/>
					</button>
				</div>
			</div>

		<button
				type="button"
				onClick={() => mutation.mutate()}
				disabled={mutation.isPending}
				className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
			>
				{mutation.isPending ? t.saving : t.saveChanges}
			</button>
			{mutation.isSuccess && (
				<p className="text-center text-green-400 text-sm">{t.saved}</p>
			)}
			<CancelSubscriptionSection lang={lang} />
		</div>
	);
}

// ============ CANCEL SUBSCRIPTION ============
function CancelSubscriptionSection({ lang }: { lang: Lang }) {
	const queryClient = useQueryClient();
	const [showModal, setShowModal] = useState(false);
	const [reason, setReason] = useState("");
	const [customReason, setCustomReason] = useState("");
	const [step, setStep] = useState<"select" | "confirm" | "done">("select");

	const reasons = lang === "es" ? [
		"Es muy caro para mi negocio",
		"No uso todas las funciones",
		"Encontré otra solución",
		"Mi negocio cerró temporalmente",
		"Problemas técnicos con el sistema",
		"Otro motivo",
	] : [
		"It's too expensive for my business",
		"I don't use all the features",
		"I found another solution",
		"My business closed temporarily",
		"Technical issues with the system",
		"Other reason",
	];

	const { data: subStatus } = useQuery({
		queryKey: ["subscriptionStatus"],
		queryFn: () => getSubscriptionStatus(),
	});

	const cancelMutation = useMutation({
		mutationFn: () => {
			const finalReason = reason === (lang === "es" ? "Otro motivo" : "Other reason") ? customReason : reason;
			return cancelSubscription({ data: { reason: finalReason } });
		},
		onSuccess: () => {
			setStep("done");
			queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
			setTimeout(() => { window.location.href = "/"; }, 3000);
		},
	});

	return (
		<>
			<div className="border-t border-gray-800 pt-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-300">{lang === "es" ? "Cancelar suscripción" : "Cancel subscription"}</p>
						<p className="text-xs text-gray-600 mt-0.5">{lang === "es" ? "Tu acceso continuará hasta el final del período actual" : "Your access continues until the end of the current period"}</p>
					</div>
					<button type="button" onClick={() => { setShowModal(true); setStep("select"); setReason(""); setCustomReason(""); }} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-all">
						{lang === "es" ? "Cancelar membresía" : "Cancel membership"}
					</button>
				</div>
			</div>

			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
						{step === "done" ? (
							<div className="text-center space-y-4">
								<div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
									<Check className="w-6 h-6 text-gray-400" />
								</div>
								<p className="text-white font-semibold">{lang === "es" ? "Suscripción cancelada" : "Subscription cancelled"}</p>
								<p className="text-gray-400 text-sm">{lang === "es" ? "Lamentamos verte partir. Redirigiendo..." : "Sorry to see you go. Redirecting..."}</p>
							</div>
						) : step === "confirm" ? (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-white">{lang === "es" ? "¿Estás seguro?" : "Are you sure?"}</h3>
								<div className="bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 mb-1">{lang === "es" ? "Motivo:" : "Reason:"}</p>
									<p className="text-gray-300 text-sm">{reason === (lang === "es" ? "Otro motivo" : "Other reason") ? customReason : reason}</p>
								</div>
								<div className="flex gap-3">
									<button type="button" onClick={() => setStep("select")} className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all">{lang === "es" ? "Volver" : "Back"}</button>
									<button type="button" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
										{cancelMutation.isPending ? "..." : (lang === "es" ? "Sí, cancelar" : "Yes, cancel")}
									</button>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-semibold text-white">{lang === "es" ? "¿Por qué cancelas?" : "Why are you cancelling?"}</h3>
									<button type="button" onClick={() => setShowModal(false)} className="p-1.5 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
								</div>
								<div className="space-y-2">
									{reasons.map((r) => (
										<button key={r} type="button" onClick={() => setReason(r)} className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${reason === r ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600"}`}>{r}</button>
									))}
								</div>
								{reason === (lang === "es" ? "Otro motivo" : "Other reason") && (
									<textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} rows={3} placeholder={lang === "es" ? "Cuéntanos más..." : "Tell us more..."} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none text-sm" />
								)}
								<div className="flex gap-3">
									<button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all">{lang === "es" ? "Cerrar" : "Close"}</button>
									<button type="button" onClick={() => setStep("confirm")} disabled={!reason || (reason === (lang === "es" ? "Otro motivo" : "Other reason") && !customReason.trim())} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">{lang === "es" ? "Continuar" : "Continue"}</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
}

// ============ REPORTS VIEW ============
function ReputationView({ shop, lang }: { shop: any; lang: Lang }) {
	const queryClient = useQueryClient();
	const [whatsapp, setWhatsapp] = useState(() => {
		const num = shop.whatsappNumber ?? "";
		// Strip country code if already saved with it
		const codes = ["+1787","+1","+52","+34","+57","+58","+53","+54","+56","+51","+593","+502","+504","+503","+506","+507","+809","+44","+55","+39","+33","+49"];
		for (const c of codes) { if (num.startsWith(c)) return num.slice(c.length); }
		return num;
	});
	const [countryCode, setCountryCode] = useState(() => {
		const num = shop.whatsappNumber ?? "";
		const codes = ["+1787","+1","+52","+34","+57","+58","+53","+54","+56","+51","+593","+502","+504","+503","+506","+507","+809","+44","+55","+39","+33","+49"];
		for (const c of codes) { if (num.startsWith(c)) return c; }
		return "+1";
	});
	const [saved, setSaved] = useState(false);
	const [showQR, setShowQR] = useState(false);
	// Only generate QR URL after whatsapp is saved
	const savedWhatsapp = shop.whatsappNumber ?? "";
	const reviewUrl = `${typeof window !== "undefined" ? window.location.origin : "https://goolinext.com"}/biz/${shop.id}?review=1`;
	const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=000000&margin=20`;

	const [saveError, setSaveError] = useState("");
	const saveMutation = useMutation({
		mutationFn: () => updateShop({ data: { id: shop.id, whatsappNumber: countryCode + whatsapp.replace(/\D/g,"") } }),
		onSuccess: () => {
			setSaved(true);
			setShowQR(true);
			setSaveError("");
			queryClient.invalidateQueries({ queryKey: ["myShop"] });
		},
		onError: (e: any) => setSaveError(e?.message || "Error al guardar"),
	});

	const downloadQR = async () => {
	// Dimensiones de la imagen original
	const IMG_WIDTH = 1086;
	const IMG_HEIGHT = 1448;

	// Crear canvas con las mismas dimensiones que la imagen original
	const canvas = document.createElement("canvas");
	canvas.width = IMG_WIDTH;
	canvas.height = IMG_HEIGHT;
	const ctx = canvas.getContext("2d")!;

	// Cargar la imagen de fondo (según idioma)
	const bgImagePath = lang === "es" 
		? "/reputation-qr/español.png" 
		: "/reputation-qr/ingles.png";

	const bgImage = new Image();
	bgImage.crossOrigin = "anonymous";

	// Cargar QR desde API
	const qrImage = new Image();
	qrImage.crossOrigin = "anonymous";

	// Cuando ambas imágenes estén cargadas
	await Promise.all([
		new Promise<void>(resolve => {
			bgImage.onload = () => resolve();
			bgImage.src = bgImagePath;
		}),
		new Promise<void>(resolve => {
			qrImage.onload = () => resolve();
			qrImage.src = qrApiUrl;
		})
	]);

	// Dibujar la imagen de fondo
	ctx.drawImage(bgImage, 0, 0, IMG_WIDTH, IMG_HEIGHT);

	// Coordenadas del cuadro blanco con borde dorado
	const QR_BOX = {
		left: 240,
		top: 520,
		width: 606,
		height: 430,
	};

	// Margen interior para que el QR no toque los bordes
	const QR_MARGIN = 60;

	// QR CODE: 41% del área blanca (MÁS PEQUEÑO)
	// 41% de 1023 = 420px (un chin más pequeño)
	// Centrado en la misma posición
	const qrSize = 420;
	const qrX = QR_BOX.left + (QR_BOX.width - qrSize) / 2;
	const qrY = QR_BOX.top + (QR_BOX.height - qrSize) / 2 + 70;

	// Dibujar el QR centrado en el cuadro blanco
	ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

	// Descargar
	const a = document.createElement("a");
	a.href = canvas.toDataURL("image/png", 1.0);
	a.download = `${shop.name.replace(/\s+/g, "-")}-google-review-qr.png`;
	a.click();
};
;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-500/20 rounded-2xl p-5">
				<div className="flex items-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
						<svg width="22" height="22" viewBox="0 0 48 48">
							<path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.1 34.8 29.5 38 24 38c-7.7 0-14-6.3-14-14s6.3-14 14-14c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 11.3 1 1 11.3 1 24s10.3 23 23 23c12.9 0 22-9.1 22-23 0-1.5-.2-2.7-.5-4z"/>
							<path fill="#34A853" d="M6.3 14.7l7 5.1C15.2 16 19.3 13 24 13c3.4 0 6.5 1.2 8.9 3.2l6.4-6.4C35.2 3.5 29.9 1 24 1 16.3 1 9.7 5.6 6.3 14.7z"/>
							<path fill="#FBBC05" d="M24 47c5.7 0 10.9-1.9 14.9-5.1l-6.9-5.7C29.8 38 27 39 24 39c-5.5 0-10.2-3.3-12.2-8L5 36.2C8.5 43 15.7 47 24 47z"/>
							<path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.5-2.6 4.6-4.8 6l6.9 5.7C42.3 36.7 45 30.8 45 24c0-1.5-.2-2.7-.5-4z"/>
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-bold text-white">{lang==="es"?"QR de Reputación":"Reputation QR"}</h2>
						<p className="text-sm text-gray-400">{lang==="es"?"Genera reseñas en Google automáticamente":"Generate Google reviews automatically"}</p>
					</div>
				</div>
			</div>

			{/* WhatsApp config */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
				<div className="flex items-center gap-2 mb-1">
					<div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.845L.057 23.887a.5.5 0 0 0 .616.616l6.04-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.888 9.888 0 0 1-5.035-1.375l-.361-.214-3.733.907.923-3.635-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.532 6.532 2.1 12 2.1S21.9 6.532 21.9 12 17.468 21.9 12 21.9z"/></svg>
					</div>
					<h3 className="text-sm font-bold text-white">{lang==="es"?"WhatsApp para quejas":"WhatsApp for complaints"}</h3>
				</div>
				<p className="text-xs text-gray-500">{lang==="es"?"Cuando un cliente tiene una queja, se le abrirá WhatsApp directo contigo.":"When a client has a complaint, WhatsApp will open directly with you."}</p>
				{saveError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{saveError}</p>}
				<div className="flex gap-2">
					<select value={countryCode} onChange={e=>setCountryCode(e.target.value)}
						className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 text-sm">
						{[
							{code:"+1",flag:"🇺🇸",label:"US/CA"},
							{code:"+52",flag:"🇲🇽",label:"MX"},
							{code:"+34",flag:"🇪🇸",label:"ES"},
							{code:"+57",flag:"🇨🇴",label:"CO"},
							{code:"+58",flag:"🇻🇪",label:"VE"},
							{code:"+53",flag:"🇨🇺",label:"CU"},
							{code:"+1787",flag:"🇵🇷",label:"PR"},
							{code:"+54",flag:"🇦🇷",label:"AR"},
							{code:"+56",flag:"🇨🇱",label:"CL"},
							{code:"+51",flag:"🇵🇪",label:"PE"},
							{code:"+593",flag:"🇪🇨",label:"EC"},
							{code:"+502",flag:"🇬🇹",label:"GT"},
							{code:"+504",flag:"🇭🇳",label:"HN"},
							{code:"+503",flag:"🇸🇻",label:"SV"},
							{code:"+506",flag:"🇨🇷",label:"CR"},
							{code:"+507",flag:"🇵🇦",label:"PA"},
							{code:"+809",flag:"🇩🇴",label:"DO"},
							{code:"+44",flag:"🇬🇧",label:"UK"},
							{code:"+55",flag:"🇧🇷",label:"BR"},
							{code:"+39",flag:"🇮🇹",label:"IT"},
							{code:"+33",flag:"🇫🇷",label:"FR"},
							{code:"+49",flag:"🇩🇪",label:"DE"},
						].map(c=>(
							<option key={c.code} value={c.code}>{c.flag} {c.code} {c.label}</option>
						))}
					</select>
					<input type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))}
						placeholder="5551234567"
						className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm font-mono" />
					<button type="button" onClick={()=>saveMutation.mutate()}
						disabled={!whatsapp.trim()||saveMutation.isPending}
						className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${saved?"bg-green-500 text-white":"bg-amber-500 text-black disabled:opacity-40"}`}>
						{saveMutation.isPending?"...":(lang==="es"?"Guardar y Generar QR":"Save & Generate QR")}
					</button>
				</div>
			</div>

			{/* QR Preview & Download - only show after saving */}
			{(showQR || savedWhatsapp) && <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-sm font-bold text-white flex items-center gap-2">
					<div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/></svg>
					</div>
					{lang==="es"?"Código QR profesional":"Professional QR code"}
				</h3>
				<p className="text-xs text-gray-500">
					{lang==="es"
						?"Imprime este código y ponlo en tu negocio. Cuando la gente lo escanee verá dos opciones: queja o reseña en Google."
						:"Print this code and place it in your business. When people scan it they'll see two options: complaint or Google review."}
				</p>


				{/* URL preview */}
				<div className="bg-gray-800/50 rounded-xl p-3">
					<p className="text-xs text-gray-500 mb-1">{lang==="es"?"URL de tu página":"Your page URL"}</p>
					<p className="text-xs text-green-400 font-mono break-all">{reviewUrl}</p>
				</div>

				{/* Download button */}
				<button type="button" onClick={downloadQR}
					className="w-full py-4 bg-gradient-to-r from-blue-500 to-green-500 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
					{lang==="es"?"Descargar QR para imprimir":"Download QR to print"}
				</button>

				{/* Instructions */}
				<div className="space-y-2">
					<p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{lang==="es"?"Cómo funciona":"How it works"}</p>
					{[
						lang==="es"?"1. Imprime el QR y ponlo visible en tu negocio":"1. Print the QR and place it visibly in your business",
						lang==="es"?"2. El cliente lo escanea con su teléfono":"2. The client scans it with their phone",
						lang==="es"?"3. Elige: queja (te contacta por WhatsApp) o reseña (va a Google)":"3. Chooses: complaint (contacts you on WhatsApp) or review (goes to Google)",
						lang==="es"?"4. Más reseñas = más clientes nuevos":"4. More reviews = more new clients",
					].map((step,i)=>(
						<p key={i} className="text-xs text-gray-500 flex items-start gap-2">
							<span className="text-green-400 flex-shrink-0">✓</span>{step}
						</p>
					))}
				</div>
			</div>}

			{/* Prompt to save first */}
			{!showQR && !savedWhatsapp && (
				<div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6 text-center space-y-2">
					<div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center mx-auto">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
					</div>
					<p className="text-sm font-semibold text-white">{lang==="es"?"Agrega tu WhatsApp primero":"Add your WhatsApp first"}</p>
					<p className="text-xs text-gray-500">{lang==="es"?"Guarda tu número para generar el código QR":"Save your number to generate the QR code"}</p>
				</div>
			)}
		</div>
	);
}

function RetentionView({ shopId, lang }: { shopId: number; lang: Lang }) {
	const t = dash[lang];
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [noteInput, setNoteInput] = useState<Record<number, string>>({});
	const [expandedId, setExpandedId] = useState<number | null>(null);

	const { data: clients = [], isLoading } = useQuery({
		queryKey: ["inactiveClients", shopId],
		queryFn: () => getInactiveClients(),
	});

	const statusMutation = useMutation({
		mutationFn: (args: { clientId: number; status: string; note?: string }) =>
			updateClientCallStatus({ data: args }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inactiveClients", shopId] }),
	});

	const pending = clients.filter((c: any) => c.callStatus === "pending" || !c.callStatus);
	const answered = clients.filter((c: any) => c.callStatus === "answered");
	const noAnswer = clients.filter((c: any) => c.callStatus === "no_answer");

	const filtered = (list: any[]) => list.filter((c: any) =>
		c.name?.toLowerCase().includes(search.toLowerCase()) ||
		c.phone?.includes(search)
	);

	const formatDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" });

	const ClientCard = ({ client, showActions }: { client: any; showActions: boolean }) => (
		<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="font-bold text-white text-sm truncate">{client.name}</p>
					<a href={`tel:${client.phone}`} className="text-amber-400 text-sm font-mono">{client.phone}</a>
					<div className="flex items-center gap-3 mt-1">
						<span className="text-xs text-gray-500">{lang === "es" ? "Última visita:" : "Last visit:"} <span className="text-gray-400">{formatDate(client.lastVisit)}</span></span>
						<span className={`text-xs font-bold px-2 py-0.5 rounded-full ${client.daysSince > 60 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
							{client.daysSince} {lang === "es" ? "días" : "days"}
						</span>
					</div>
					<p className="text-xs text-gray-600 mt-0.5">{client.totalVisits} {lang === "es" ? "visitas totales" : "total visits"}</p>
				</div>
				<a href={`tel:${client.phone}`}
					className="flex-shrink-0 w-9 h-9 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center text-green-400 hover:bg-green-500/25 transition-all"
					title={lang === "es" ? "Llamar" : "Call"}>
					📞
				</a>
			</div>

			{/* Note */}
			{client.note && (
				<p className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">📝 {client.note}</p>
			)}

			{showActions && (
				<div className="space-y-2">
					<input
						type="text"
						value={noteInput[client.clientId] ?? ""}
						onChange={e => setNoteInput(p => ({ ...p, [client.clientId]: e.target.value }))}
						placeholder={lang === "es" ? "Agregar nota..." : "Add note..."}
						className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-xs focus:outline-none focus:border-amber-500"
					/>
					<div className="flex gap-2">
						<button type="button"
							onClick={() => statusMutation.mutate({ clientId: client.clientId, status: "answered", note: noteInput[client.clientId] })}
							disabled={statusMutation.isPending}
							className="flex-1 py-2 bg-green-500/15 text-green-400 border border-green-500/25 rounded-lg text-xs font-semibold hover:bg-green-500/25 transition-all">
							✅ {lang === "es" ? "Respondió" : "Answered"}
						</button>
						<button type="button"
							onClick={() => statusMutation.mutate({ clientId: client.clientId, status: "no_answer", note: noteInput[client.clientId] })}
							disabled={statusMutation.isPending}
							className="flex-1 py-2 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-all">
							📵 {lang === "es" ? "No respondió" : "No answer"}
						</button>
					</div>
				</div>
			)}

			{!showActions && client.callStatus !== "pending" && (
				<button type="button"
					onClick={() => statusMutation.mutate({ clientId: client.clientId, status: "pending" })}
					className="text-xs text-gray-600 hover:text-gray-400 transition-all">
					↩ {lang === "es" ? "Mover a pendiente" : "Move to pending"}
				</button>
			)}
		</div>
	);

	const downloadCSV = () => {
		const header = lang === "es"
			? "Estado,Nombre,Teléfono,Última visita,Días sin venir,Visitas totales,Nota"
			: "Status,Name,Phone,Last visit,Days away,Total visits,Note";
		const statusLabel = (s: string) => {
			if (lang === "es") return s === "answered" ? "Respondió" : s === "no_answer" ? "No respondió" : "Por llamar";
			return s === "answered" ? "Answered" : s === "no_answer" ? "No answer" : "To call";
		};
		const ordered = [...pending, ...answered, ...noAnswer];
		const rows = ordered.map((c: any) =>
			[statusLabel(c.callStatus), `"${c.name}"`, c.phone, c.lastVisit, c.daysSince, c.totalVisits, `"${c.note || ""}"`].join(",")
		);
		const csv = [header, ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `retencion-clientes-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	if (isLoading) return (
		<div className="flex justify-center py-12">
			<div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
		</div>
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5">
				<div className="flex items-start justify-between flex-wrap gap-3">
					<div>
						<h2 className="text-lg font-bold text-white">{lang === "es" ? "Control de Retención" : "Retention Control"}</h2>
						<p className="text-sm text-gray-400 mt-1">{lang === "es" ? "Clientes sin visitar en 30+ días" : "Clients who haven't visited in 30+ days"}</p>
					</div>
					<div className="flex flex-col items-end gap-3">
						<div className="flex gap-3 text-center">
							<div className="bg-gray-900/60 rounded-xl px-4 py-2">
								<p className="text-2xl font-bold text-amber-400">{pending.length}</p>
								<p className="text-xs text-gray-500">{lang === "es" ? "Por llamar" : "To call"}</p>
							</div>
							<div className="bg-gray-900/60 rounded-xl px-4 py-2">
								<p className="text-2xl font-bold text-green-400">{answered.length}</p>
								<p className="text-xs text-gray-500">{lang === "es" ? "Respondieron" : "Answered"}</p>
							</div>
							<div className="bg-gray-900/60 rounded-xl px-4 py-2">
								<p className="text-2xl font-bold text-red-400">{noAnswer.length}</p>
								<p className="text-xs text-gray-500">{lang === "es" ? "No respondió" : "No answer"}</p>
							</div>
						</div>
						{clients.length > 0 && (
							<button type="button" onClick={downloadCSV}
								className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-all">
								⬇ {lang === "es" ? "Exportar CSV" : "Export CSV"}
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Search */}
			<input type="text" value={search} onChange={e => setSearch(e.target.value)}
				placeholder={lang === "es" ? "Buscar por nombre o teléfono..." : "Search by name or phone..."}
				className="w-full px-4 py-3 bg-gray-900/60 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />

			{clients.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-4xl mb-3">🎉</p>
					<p className="text-white font-bold">{lang === "es" ? "¡Sin clientes inactivos!" : "No inactive clients!"}</p>
					<p className="text-gray-500 text-sm mt-1">{lang === "es" ? "Todos tus clientes han visitado en los últimos 30 días." : "All your clients have visited in the last 30 days."}</p>
				</div>
			) : (
				<div className="space-y-6">
					{/* COLUMN: To Call */}
					{filtered(pending).length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-3">
								<div className="w-2 h-2 rounded-full bg-amber-400" />
								<h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
									📋 {lang === "es" ? "Por llamar" : "To call"} ({filtered(pending).length})
								</h3>
							</div>
							<div className="space-y-3">
								{filtered(pending).map((c: any) => <ClientCard key={c.clientId} client={c} showActions={true} />)}
							</div>
						</div>
					)}

					{/* COLUMN: Answered */}
					{filtered(answered).length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-3">
								<div className="w-2 h-2 rounded-full bg-green-400" />
								<h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">
									✅ {lang === "es" ? "Llamó y respondió" : "Called & answered"} ({filtered(answered).length})
								</h3>
							</div>
							<div className="space-y-3">
								{filtered(answered).map((c: any) => <ClientCard key={c.clientId} client={c} showActions={false} />)}
							</div>
						</div>
					)}

					{/* COLUMN: No Answer */}
					{filtered(noAnswer).length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-3">
								<div className="w-2 h-2 rounded-full bg-red-400" />
								<h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
									📵 {lang === "es" ? "No respondió" : "No answer"} ({filtered(noAnswer).length})
								</h3>
							</div>
							<div className="space-y-3">
								{filtered(noAnswer).map((c: any) => <ClientCard key={c.clientId} client={c} showActions={false} />)}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ReportsView({ shopId, lang }: { shopId: number; lang: "en" | "es" }) {
	const today = new Date().toISOString().split("T")[0];
	const [selectedDate, setSelectedDate] = useState(today);
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [view, setView] = useState<"day" | "month" | "year">("day");

	const { data: dailyReport, isLoading: dailyLoading } = useQuery({
		queryKey: ["dailyReport", shopId, selectedDate],
		queryFn: () => getDailyReport({ data: { shopId, date: selectedDate } }),
		enabled: view === "day",
	});

	const { data: monthlyReport, isLoading: monthlyLoading } = useQuery({
		queryKey: ["monthlyReport", shopId, selectedYear, selectedMonth],
		queryFn: () => getMonthlyReport({ data: { shopId, year: selectedYear, month: selectedMonth } }),
		enabled: view === "month",
	});

	const { data: yearlyReport, isLoading: yearlyLoading } = useQuery({
		queryKey: ["yearlyReport", shopId, selectedYear],
		queryFn: () => getYearlyReport({ data: { shopId, year: selectedYear } }),
		enabled: view === "year",
	});

	const months = lang === "es"
		? ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
		: ["January","February","March","April","May","June","July","August","September","October","November","December"];

	const downloadCSV = () => {
		if (view === "day" && dailyReport?.visits) {
			const rows = [
				["Client","Barber","Status","Amount","Time"],
				...dailyReport.visits.map((v: any) => [
					v.clientName,
					v.barberName,
					v.status,
					v.amountPaid ? `${v.amountPaid.toFixed(2)}` : "$0.00",
					new Date(v.createdAt).toLocaleTimeString(),
				])
			];
			const csv = rows.map(r => r.join(",")).join("\n");
			const blob = new Blob([csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `report-${selectedDate}.csv`;
			a.click();
		} else if (view === "month" && monthlyReport?.visits) {
			const rows = [
				["Date","Client","Barber","Status","Amount"],
				// Barber summary section
				...(monthlyReport.byBarber ? [
					[lang==="es"?"GANANCIAS POR EMPLEADO":"EARNINGS BY STAFF","","","",""],
					[lang==="es"?"Empleado":"Staff",lang==="es"?"Clientes":"Clients","Total","",""],
					...Object.entries(monthlyReport.byBarber).sort(([,a]: any,[,b]: any) => (b as any).revenue - (a as any).revenue)
						.map(([name, data]: any) => [name, data.count, `${(data.revenue||0).toFixed(2)}`,"",""]),
					["TOTAL","",`${(monthlyReport.totalRevenue||0).toFixed(2)}`,"",""],
					["","","","",""],
					[lang==="es"?"DETALLE DE VISITAS":"VISIT DETAILS","","","",""],
				] : []),
				...monthlyReport.visits.map((v: any) => [
					new Date(v.createdAt).toLocaleDateString(),
					v.clientName,
					v.barberName,
					v.status,
					v.amountPaid ? `${v.amountPaid.toFixed(2)}` : "$0.00",
				])
			];
			const csv = rows.map(r => r.join(",")).join("\n");
			const blob = new Blob([csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `report-${selectedYear}-${selectedMonth}.csv`;
			a.click();
		} else if (view === "year" && yearlyReport?.visits) {
			const rows = [
				["Date","Client","Barber","Status","Amount"],
				// Barber summary section
				...(yearlyReport.byBarber ? [
					[lang==="es"?"GANANCIAS POR EMPLEADO":"EARNINGS BY STAFF","","","",""],
					[lang==="es"?"Empleado":"Staff",lang==="es"?"Clientes":"Clients","Total","",""],
					...Object.entries(yearlyReport.byBarber).sort(([,a]: any,[,b]: any) => (b as any).revenue - (a as any).revenue)
						.map(([name, data]: any) => [name, data.count, `${(data.revenue||0).toFixed(2)}`,"",""]),
					["TOTAL","",`${(yearlyReport.totalRevenue||0).toFixed(2)}`,"",""],
					["","","","",""],
					[lang==="es"?"DETALLE DE VISITAS":"VISIT DETAILS","","","",""],
				] : []),
				...yearlyReport.visits.map((v: any) => [new Date(v.createdAt).toLocaleDateString(), v.clientName, v.barberName, v.status, v.amountPaid ? `${v.amountPaid.toFixed(2)}` : "$0.00"])
			];
			const csv = rows.map(r => r.join(",")).join("\n");
			const blob = new Blob([csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `report-${selectedYear}.csv`;
			a.click();
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap gap-3">
				<h2 className="text-xl font-bold text-white flex items-center gap-2">
					<BarChart2 className="w-5 h-5 text-amber-400" />
					{lang === "es" ? "Reportes" : "Reports"}
				</h2>
				<button type="button" onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl text-sm font-semibold hover:bg-amber-500/25">
					<Database className="w-4 h-4" />
					{lang === "es" ? "Descargar CSV" : "Download CSV"}
				</button>
			</div>

			{/* View toggle */}
			<div className="flex gap-2">
				<button type="button" onClick={() => setView("day")} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${view==="day" ? "bg-amber-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
					{lang === "es" ? "Por Día" : "Daily"}
				</button>
				<button type="button" onClick={() => setView("month")} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${view==="month" ? "bg-amber-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
					{lang === "es" ? "Por Mes" : "Monthly"}
				</button>
				<button type="button" onClick={() => setView("year")} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${view==="year" ? "bg-amber-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
					{lang === "es" ? "Por Año" : "Yearly"}
				</button>
			</div>

			{/* Date selector */}
			{view === "day" ? (
				<div>
					<label className="block text-sm text-gray-400 mb-1">{lang === "es" ? "Seleccionar día" : "Select day"}</label>
					<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
						className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-amber-500" />
				</div>
			) : view === "year" ? (
				<div>
					<label className="block text-sm text-gray-400 mb-1">{lang === "es" ? "Seleccionar año" : "Select year"}</label>
					<select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-amber-500">
						{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
					</select>
				</div>
			) : (
				<div className="flex gap-3">
					<select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
						className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-amber-500">
						{months.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
					</select>
					<select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
						className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-amber-500">
						{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
					</select>
				</div>
			)}

			{/* Daily Report */}
			{view === "day" && (
				<div className="space-y-4">
					{dailyLoading ? (
						<div className="text-gray-500 text-sm">{lang === "es" ? "Cargando..." : "Loading..."}</div>
					) : dailyReport ? (
						<>
							{/* Summary cards */}
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
								{[
									{ label: lang==="es"?"Clientes":"Clients", value: dailyReport.totalCompleted, color:"text-white" },
									{ label: lang==="es"?"Cancelados":"Cancelled", value: dailyReport.totalCancelled, color:"text-red-400" },
									{ label: lang==="es"?"No se presentaron":"No-shows", value: (dailyReport as any).totalNoShows ?? 0, color:"text-orange-400" },
									{ label: lang==="es"?"Ingreso total":"Total Revenue", value: `${(dailyReport.totalRevenue??0).toFixed(2)}`, color:"text-green-400" },
								].map((s,i) => (
									<div key={i} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
										<p className="text-xs text-gray-500 mb-1">{s.label}</p>
										<p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
									</div>
								))}
							</div>

							{/* By barber */}
							{Object.keys(dailyReport.byBarber).length > 0 && (
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
									<h3 className="text-sm font-semibold text-gray-300 mb-3">{lang==="es"?"Por empleado":"By staff member"}</h3>
									<div className="space-y-2">
										{Object.entries(dailyReport.byBarber).map(([name, data]: [string, any]) => (
											<div key={name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
												<span className="text-white font-medium">{name}</span>
												<div className="flex items-center gap-4">
													<span className="text-gray-400 text-sm">{data.count} {lang==="es"?(data.count===1?"cliente":"clientes"):(data.count===1?"client":"clients")}</span>
													<span className="text-green-400 font-bold">${data.revenue.toFixed(2)}</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Full visit list */}
							<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
								<div className="px-5 py-3 border-b border-gray-800">
									{/* Barber earnings breakdown */}
									{dailyReport.byBarber && Object.keys(dailyReport.byBarber).length > 0 && (
										<div className="px-5 py-4 border-b border-gray-800">
											<p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">💰 {lang === "es" ? "Ganancias por empleado" : "Earnings by staff"}</p>
											<div className="space-y-2">
												{Object.entries(dailyReport.byBarber).sort(([,a]: any,[,b]: any) => (b as any).revenue - (a as any).revenue).map(([name, data]: any) => (
													<div key={name} className="flex items-center gap-3">
														<div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">{name[0]?.toUpperCase()}</div>
														<div className="flex-1 min-w-0">
															<div className="flex justify-between items-baseline mb-1">
																<span className="text-white text-sm font-medium whitespace-nowrap overflow-x-auto">{name}</span>
																<span className="text-green-400 font-bold text-sm ml-2 flex-shrink-0">${(data.revenue||0).toFixed(2)}</span>
															</div>
															<div className="flex items-center gap-2">
																<div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
																	<div className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full" style={{width:`${dailyReport.totalRevenue>0?(data.revenue/dailyReport.totalRevenue*100):0}%`}}/>
																</div>
																<span className="text-gray-600 text-xs flex-shrink-0">{data.count} {lang==="es"?"clientes":"clients"}</span>
															</div>
														</div>
													</div>
												))}
											</div>
										</div>
									)}
									<h3 className="text-sm font-semibold text-gray-300">{lang==="es"?"Lista completa":"Full list"}</h3>
								</div>
								<div className="divide-y divide-gray-800/50">
									{dailyReport.visits.length === 0 && (
										<p className="px-5 py-6 text-gray-600 text-sm text-center">{lang==="es"?"Sin registros este día":"No records this day"}</p>
									)}
									{dailyReport.visits.map((v: any) => (
										<div key={v.visitId} className="px-5 py-3 flex items-center justify-between">
											<div>
												<p className="text-white font-medium text-sm">{v.clientName}</p>
												<p className="text-gray-500 text-xs">{v.barberName} · {new Date(v.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>
											</div>
											<div className="flex items-center gap-3">
												<span className={`text-xs px-2 py-1 rounded-full font-medium ${v.status==="completed"?"bg-green-500/15 text-green-400":v.status==="cancelled"?"bg-red-500/15 text-red-400":v.status==="no_show"?"bg-orange-500/15 text-orange-400":"bg-amber-500/15 text-amber-400"}`}>
													{v.status==="completed"?(lang==="es"?"Completado":"Completed"):v.status==="cancelled"?(lang==="es"?"Cancelado":"Cancelled"):v.status==="no_show"?(lang==="es"?"No llegó":"No-show"):(lang==="es"?"En espera":"Waiting")}
												</span>
												<span className="text-green-400 font-bold text-sm">{v.amountPaid ? `${v.amountPaid.toFixed(2)}` : "—"}</span>
											</div>
										</div>
									))}
								</div>
							</div>
						</>
					) : null}
				</div>
			)}

			{/* Yearly Report */}
			{view === "year" && (
				<div className="space-y-4">
					{yearlyLoading ? <p className="text-gray-500 text-sm">{lang==="es"?"Cargando...":"Loading..."}</p> : yearlyReport ? (
						<>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
									<p className="text-xs text-gray-500 mb-1">{lang==="es"?"Total clientes":"Total clients"}</p>
									<p className="text-2xl font-bold text-white">{yearlyReport.totalClients}</p>
								</div>
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
									<p className="text-xs text-gray-500 mb-1">{lang==="es"?"Ingreso del año":"Yearly revenue"}</p>
									<p className="text-2xl font-bold text-green-400">${(yearlyReport.totalRevenue??0).toFixed(2)}</p>
								</div>
							</div>
							{/* Barber earnings by staff */}
							{yearlyReport.byBarber && Object.keys(yearlyReport.byBarber).length > 0 && (
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
									<p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-4">💰 {lang === "es" ? "Ganancias por empleado" : "Earnings by staff"}</p>
									<div className="space-y-3">
										{Object.entries(yearlyReport.byBarber).sort(([,a]: any,[,b]: any) => (b as any).revenue - (a as any).revenue).map(([name, data]: any) => (
											<div key={name} className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">{name[0]?.toUpperCase()}</div>
												<div className="flex-1 min-w-0">
													<div className="flex justify-between items-baseline mb-1">
														<span className="text-white text-sm font-semibold whitespace-nowrap overflow-x-auto">{name}</span>
														<span className="text-green-400 font-bold text-sm ml-2 flex-shrink-0">${(data.revenue||0).toFixed(2)}</span>
													</div>
													<div className="flex items-center gap-2">
														<div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
															<div className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full" style={{width: yearlyReport.totalRevenue>0 ? (data.revenue/yearlyReport.totalRevenue*100).toFixed(0)+"%" : "0%"}}/>
														</div>
														<span className="text-gray-600 text-xs flex-shrink-0">{data.count} {lang==="es"?"clientes":"clients"}</span>
													</div>
												</div>
											</div>
										))}
									</div>
									<div className="mt-4 pt-3 border-t border-gray-800 flex justify-between">
										<span className="text-gray-400 text-sm font-semibold">Total</span>
										<span className="text-green-400 font-bold text-lg">${(yearlyReport.totalRevenue??0).toFixed(2)}</span>
									</div>
								</div>
							)}


							<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
								<div className="px-5 py-3 border-b border-gray-800"><h3 className="text-sm font-semibold text-gray-300">{lang==="es"?"Mes a mes":"Month by month"}</h3></div>
								<div className="divide-y divide-gray-800/50">
									{Object.entries(yearlyReport.byMonth).map(([month, data]: [string,any]) => (
										<div key={month} className="px-5 py-3 flex justify-between">
											<div>
												<p className="text-white font-medium text-sm">{months[Number(month)-1]}</p>
												<p className="text-gray-500 text-xs">{data.clients} {lang==="es"?"clientes":"clients"}</p>
											</div>
											<span className={`font-bold ${data.revenue>0?"text-green-400":"text-gray-600"}`}>${data.revenue.toFixed(2)}</span>
										</div>
									))}
								</div>
							</div>
						</>
					) : null}
				</div>
			)}

			{/* Monthly Report */}
			{view === "month" && (
				<div className="space-y-4">
					{monthlyLoading ? (
						<div className="text-gray-500 text-sm">{lang === "es" ? "Cargando..." : "Loading..."}</div>
					) : monthlyReport ? (
						<>
							{/* Monthly summary */}
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
									<p className="text-xs text-gray-500 mb-1">{lang==="es"?"Total clientes":"Total clients"}</p>
									<p className="text-2xl font-bold text-white">{monthlyReport.totalClients}</p>
								</div>
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
									<p className="text-xs text-gray-500 mb-1">{lang==="es"?"Ingreso del mes":"Monthly revenue"}</p>
									<p className="text-2xl font-bold text-green-400">${(monthlyReport.totalRevenue??0).toFixed(2)}</p>
								</div>
							</div>

							{/* Barber earnings by staff */}
							{monthlyReport.byBarber && Object.keys(monthlyReport.byBarber).length > 0 && (
								<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
									<p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-4">💰 {lang === "es" ? "Ganancias por empleado" : "Earnings by staff"}</p>
									<div className="space-y-3">
										{Object.entries(monthlyReport.byBarber).sort(([,a]: any,[,b]: any) => (b as any).revenue - (a as any).revenue).map(([name, data]: any) => (
											<div key={name} className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">{name[0]?.toUpperCase()}</div>
												<div className="flex-1 min-w-0">
													<div className="flex justify-between items-baseline mb-1">
														<span className="text-white text-sm font-semibold whitespace-nowrap overflow-x-auto">{name}</span>
														<span className="text-green-400 font-bold text-sm ml-2 flex-shrink-0">${(data.revenue||0).toFixed(2)}</span>
													</div>
													<div className="flex items-center gap-2">
														<div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
															<div className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full" style={{width: monthlyReport.totalRevenue>0 ? (data.revenue/monthlyReport.totalRevenue*100).toFixed(0)+"%" : "0%"}}/>
														</div>
														<span className="text-gray-600 text-xs flex-shrink-0">{data.count} {lang==="es"?"clientes":"clients"}</span>
													</div>
												</div>
											</div>
										))}
									</div>
									<div className="mt-4 pt-3 border-t border-gray-800 flex justify-between">
										<span className="text-gray-400 text-sm font-semibold">Total</span>
										<span className="text-green-400 font-bold text-lg">${(monthlyReport.totalRevenue??0).toFixed(2)}</span>
									</div>
								</div>
							)}

							{/* Day by day breakdown */}
							<div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
								<div className="px-5 py-3 border-b border-gray-800">
									<h3 className="text-sm font-semibold text-gray-300">{lang==="es"?"Resumen por día":"Day by day"}</h3>
								</div>
								<div className="divide-y divide-gray-800/50">
									{Object.entries(monthlyReport.byDay).length === 0 && (
										<p className="px-5 py-6 text-gray-600 text-sm text-center">{lang==="es"?"Sin registros este mes":"No records this month"}</p>
									)}
									{Object.entries(monthlyReport.byDay).sort().map(([date, data]: [string, any]) => (
										<div key={date} className="px-5 py-3 flex items-center justify-between">
											<div>
												<p className="text-white font-medium text-sm">{new Date(date+"T12:00:00").toLocaleDateString(lang==="es"?"es-US":"en-US",{weekday:"short",month:"short",day:"numeric"})}</p>
												<p className="text-gray-500 text-xs">{data.clients} {lang==="es"?"clientes":"clients"} · {data.cancelled} {lang==="es"?"cancelados":"cancelled"}</p>
											</div>
											<span className="text-green-400 font-bold">${data.revenue.toFixed(2)}</span>
										</div>
									))}
								</div>
							</div>
						</>
					) : null}
				</div>
			)}
		</div>
	);
}
