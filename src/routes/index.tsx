import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
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
	Scissors,
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
import { compressImage } from "@/lib/image-utils";
import {
	barberCallNext,
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
} from "@/lib/server-fns";
import { useWebSocket } from "@/lib/websocket";

export const Route = createFileRoute("/")({ component: AdminDashboard });

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

	const recoveryQuery = useQuery({
		queryKey: ["recoveryInfo"],
		queryFn: () => getRecoveryInfo(),
		enabled: mode === "recovery",
	});

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
		mutationFn: () => resetPassword({ data: { newPassword } }),
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

					{recoveryQuery.isLoading ? (
						<p className="text-gray-400 text-center py-8">{t.loading}</p>
					) : recoveryQuery.data?.found ? (
						resetDone ? (
							<div className="space-y-4 text-center">
								<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
									<Check className="w-6 h-6 text-green-400" />
								</div>
								<p className="text-green-400 text-sm">{t.resetSuccess}</p>
								<button
									type="button"
									onClick={() => {
										setMode("login");
										setResetDone(false);
										setNewPassword("");
										setConfirmNewPassword("");
										setError("");
									}}
									className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all"
								>
									{t.backToLogin}
								</button>
							</div>
						) : (
							<div className="space-y-4">
								<p className="text-gray-400 text-sm text-center">
									{t.recoveryDesc}
								</p>
								<div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-center">
									<p className="text-xs text-gray-500 mb-1">{t.email}</p>
									<p className="text-white font-mono">
										{recoveryQuery.data.maskedEmail}
									</p>
								</div>
								<div>
									<label
										htmlFor="new-password"
										className="block text-sm font-medium text-gray-300 mb-1"
									>
										<span className="flex items-center gap-1.5">
											<Lock className="w-3.5 h-3.5" />
											{t.newPassword}
										</span>
									</label>
									<input
										id="new-password"
										type="password"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										placeholder={t.newPasswordPlaceholder}
										className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
										onKeyDown={(e) => {
											if (e.key === "Enter") handleReset();
										}}
									/>
								</div>
								<div>
									<label
										htmlFor="confirm-new-password"
										className="block text-sm font-medium text-gray-300 mb-1"
									>
										<span className="flex items-center gap-1.5">
											<Shield className="w-3.5 h-3.5" />
											{t.confirmNewPassword}
										</span>
									</label>
									<input
										id="confirm-new-password"
										type="password"
										value={confirmNewPassword}
										onChange={(e) => setConfirmNewPassword(e.target.value)}
										placeholder={t.confirmNewPasswordPlaceholder}
										className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
										onKeyDown={(e) => {
											if (e.key === "Enter") handleReset();
										}}
									/>
								</div>

								{error && (
									<p className="text-red-400 text-sm text-center">{error}</p>
								)}

								<button
									type="button"
									onClick={handleReset}
									disabled={resetMutation.isPending}
									className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{resetMutation.isPending ? t.resetting : t.resetPassword}
								</button>

								<button
									type="button"
									onClick={() => {
										setMode("login");
										setError("");
									}}
									className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 text-sm"
								>
									<ArrowLeft className="w-4 h-4" />
									{t.backToLogin}
								</button>
							</div>
						)
					) : (
						<div className="space-y-4 text-center">
							<p className="text-gray-400 text-sm">{t.noAccountFound}</p>
							<button
								type="button"
								onClick={() => {
									setMode("login");
									setError("");
								}}
								className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 text-sm"
							>
								<ArrowLeft className="w-4 h-4" />
								{t.backToLogin}
							</button>
						</div>
					)}
				</div>
			</div>
		);
	}

	// ---- Signup / Login mode ----
	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
			<div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
				<div className="flex justify-end mb-4">
					<LangToggle lang={lang} setLang={setLang} />
				</div>
				<div className="text-center mb-6">
					<div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Scissors className="w-8 h-8 text-white" />
					</div>
					<h1 className="text-2xl font-bold text-white">Goolinext</h1>
					<p className="text-gray-400 text-sm mt-2">{t.subtitle}</p>
				</div>

				{/* Tab switcher */}
				<div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-6">
					<button
						type="button"
						onClick={() => {
							setMode("signup");
							setError("");
						}}
						className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
							mode === "signup"
								? "bg-amber-500/20 text-amber-400"
								: "text-gray-400 hover:text-gray-300"
						}`}
					>
						<User className="w-4 h-4" />
						{t.createAccount}
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("login");
							setError("");
						}}
						className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
							mode === "login"
								? "bg-amber-500/20 text-amber-400"
								: "text-gray-400 hover:text-gray-300"
						}`}
					>
						<Lock className="w-4 h-4" />
						{t.signIn}
					</button>
				</div>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="auth-email"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							<span className="flex items-center gap-1.5">
								<Mail className="w-3.5 h-3.5" />
								{t.email}
							</span>
						</label>
						<input
							id="auth-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t.emailPlaceholder}
							className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSubmit();
							}}
						/>
					</div>
					<div>
						<label
							htmlFor="auth-password"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							<span className="flex items-center gap-1.5">
								<Lock className="w-3.5 h-3.5" />
								{t.password}
							</span>
						</label>
						<input
							id="auth-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder={t.passwordPlaceholder}
							className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSubmit();
							}}
						/>
					</div>
					{mode === "signup" && (
						<div>
							<label
								htmlFor="auth-confirm"
								className="block text-sm font-medium text-gray-300 mb-1"
							>
								<span className="flex items-center gap-1.5">
									<Shield className="w-3.5 h-3.5" />
									{t.confirmPassword}
								</span>
							</label>
							<input
								id="auth-confirm"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder={t.confirmPasswordPlaceholder}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSubmit();
								}}
							/>
						</div>
					)}

					{error && <p className="text-red-400 text-sm text-center">{error}</p>}

					<button
						type="button"
						onClick={handleSubmit}
						disabled={isPending}
						className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
					>
						{isPending
							? mode === "signup"
								? t.creating
								: t.signingIn
							: mode === "signup"
								? t.createAccount
								: t.signIn}
					</button>

					{mode === "login" && (
						<button
							type="button"
							onClick={() => {
								setMode("recovery");
								setError("");
							}}
							className="w-full text-center text-amber-400/70 hover:text-amber-400 text-sm transition-colors"
						>
							{t.forgotPassword}
						</button>
					)}

					<p className="text-center text-gray-500 text-sm">
						{mode === "signup" ? t.haveAccount : t.noAccount}{" "}
						<button
							type="button"
							onClick={() => {
								setMode(mode === "signup" ? "login" : "signup");
								setError("");
							}}
							className="text-amber-400 hover:text-amber-300 font-medium"
						>
							{mode === "signup" ? t.signIn : t.createAccount}
						</button>
					</p>
				</div>
			</div>
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
					name,
					address: address || undefined,
					phone: phone || undefined,
					googleReviewLink: googleLink || undefined,
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
						<Scissors className="w-8 h-8 text-white" />
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
								{t.setupName}
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
								{t.setupAddress}
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
								{t.setupPhone}
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
								{t.settGoogleLink}
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
						<button
							type="button"
							onClick={() => shopMutation.mutate()}
							disabled={!name.trim() || shopMutation.isPending}
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
			queryClient.invalidateQueries({ queryKey: ["checkAuth"] });
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
		"dashboard" | "queue" | "barbers" | "qr" | "clients" | "settings" | "help"
	>("dashboard");

	const { data: subStatus, isLoading: subLoading } = useQuery({
		queryKey: ["subscriptionStatus"],
		queryFn: () => getSubscriptionStatus(),
	});

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
		const interval = setInterval(run, 30 * 60 * 1000);
		return () => clearInterval(interval);
	}, []);

	const tabs = [
		{ key: "dashboard" as const, label: t.tabHome, icon: Store },
		{ key: "queue" as const, label: t.tabQueue, icon: List },
		{ key: "barbers" as const, label: t.tabBarbers, icon: Scissors },
		{ key: "qr" as const, label: t.tabQR, icon: QrCode },
		{ key: "clients" as const, label: t.tabClients, icon: Database },
		{ key: "settings" as const, label: t.tabSettings, icon: Settings },
		{ key: "help" as const, label: lang === "es" ? "Ayuda" : "Help", icon: Bell },
	];

	// Show paywall if not subscribed
	if (!subLoading && subStatus?.status !== "active") {
		return <PaywallScreen lang={lang} onPaid={() => window.location.reload()} />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
			{/* Header */}
			<div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10">
				<div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
							<Scissors className="w-5 h-5 text-white" />
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

	const completeMutation = useMutation({
		mutationFn: (visitId: number) =>
			barberCompleteClient({ data: { visitId } }),
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
							<button
								type="button"
								onClick={() =>
									completeMutation.mutate(queue.currentClient?.visitId)
								}
								disabled={completeMutation.isPending}
								className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all text-sm font-medium"
							>
								<Check className="w-4 h-4" />
								{tb.complete}
							</button>
						</div>
					) : (
						<div className="px-5 py-6 text-center">
							<p className="text-gray-600 text-sm">{tb.noClient}</p>
						</div>
					)}
				</div>

				{/* Next client button */}
				<button
					type="button"
					onClick={() => nextMutation.mutate()}
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
						{stats.recentVisits.map((visit) => (
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

	const completeMutation = useMutation({
		mutationFn: (visitId: number) =>
			completeClient({ data: { visitId, shopId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["shopQueues", shopId] }),
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
							<Scissors className="w-5 h-5 text-green-400" />
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
										<Scissors
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
									<button
										type="button"
										onClick={() =>
											completeMutation.mutate(q.currentClient?.visitId)
										}
										disabled={completeMutation.isPending}
										className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all text-xs font-medium"
									>
										<Check className="w-3.5 h-3.5" />
										{t.completeBtn}
									</button>
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
				const dataUrl = await compressImage(file);
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
						<Scissors className={`${iconSize} text-amber-400`} />
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
	const [showForm, setShowForm] = useState(false);
	const [copiedId, setCopiedId] = useState<number | null>(null);

	const { data: barberList } = useQuery({
		queryKey: ["barbers", shopId],
		queryFn: () => getBarbers({ data: { shopId } }),
	});

	const addMutation = useMutation({
		mutationFn: () =>
			createBarber({
				data: { shopId, name, specialty: specialty || undefined },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
			setName("");
			setSpecialty("");
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

	const photoMutation = useMutation({
		mutationFn: (args: { barberId: number; photoUrl: string | null }) =>
			updateBarberPhoto({
				data: { barberId: args.barberId, shopId, photoUrl: args.photoUrl },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["barbers", shopId] }),
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
					<button
						type="button"
						onClick={() => addMutation.mutate()}
						disabled={!name.trim() || addMutation.isPending}
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
							</div>
						);
					})}
				</div>
			) : (
				<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
					<Scissors className="w-10 h-10 text-gray-600 mx-auto mb-3" />
					<p className="text-gray-500">{t.noBarbersMsg}</p>
				</div>
			)}
		</div>
	);
}

// ============ QR VIEW ============

function QRView({
	shopId,
	lang,
}: {
	shopId: number;
	shopName?: string;
	lang: Lang;
}) {
	const t = dash[lang];
	const registerUrl = `${window.location.origin}/register/${shopId}`;
	const bizUrl = `${window.location.origin}/biz/${shopId}`;
	const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(registerUrl)}&bgcolor=111827&color=f59e0b`;

	return (
		<div className="space-y-4">
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
				<h2 className="text-xl font-bold text-white mb-2">{t.qrTitle}</h2>
				<p className="text-gray-400 mb-6 text-sm">{t.qrDesc}</p>

				<div className="inline-block bg-white p-4 rounded-2xl mb-4">
					<img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
				</div>

				{/* Download button - right below QR */}
				<div className="flex gap-3 justify-center mb-6">
					<a
						href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(registerUrl)}&bgcolor=111827&color=f59e0b&format=png`}
						download={`QR-${shopId}.png`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-amber-600 hover:to-orange-700 transition-all"
					>
						<Download className="w-4 h-4" />
						{lang === "es" ? "Descargar QR (alta resolución)" : "Download QR (high resolution)"}
					</a>
				</div>

				<div className="bg-gray-800 rounded-xl p-4 mb-4">
					<p className="text-xs text-gray-500 mb-1">{t.qrLink}</p>
					<p className="text-amber-400 text-sm break-all font-mono">
						{registerUrl}
					</p>
				</div>

				<p className="text-gray-500 text-xs">{t.qrTip}</p>
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
					<p className="text-amber-400 text-xs break-all font-mono">{bizUrl}</p>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => navigator.clipboard.writeText(bizUrl)}
						className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-all"
					>
						{lang === "es" ? "📋 Copiar link" : "📋 Copy link"}
					</button>
					<a
						href={bizUrl}
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
function PaywallScreen({ lang, onPaid }: { lang: Lang; onPaid: () => void }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

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
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
			<div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
				<div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
					<Scissors className="w-8 h-8 text-white" />
				</div>
				<h1 className="text-2xl font-bold text-white mb-2">Goolinext Pro</h1>
				<p className="text-gray-400 text-sm mb-8">
					{lang === "es"
						? "Activa tu suscripción para acceder al sistema completo de gestión de tu barbería."
						: "Activate your subscription to access the complete barbershop management system."}
				</p>

				{/* Features */}
				<div className="space-y-3 mb-8 text-left">
					{[
						lang === "es" ? "✅ Cola virtual en tiempo real" : "✅ Real-time virtual queue",
						lang === "es" ? "✅ SMS automáticos a clientes" : "✅ Automatic SMS to clients",
						lang === "es" ? "✅ Página pública de tu negocio" : "✅ Public business page",
						lang === "es" ? "✅ Barberos ilimitados" : "✅ Unlimited barbers",
						lang === "es" ? "✅ Código QR descargable" : "✅ Downloadable QR code",
						lang === "es" ? "✅ Soporte por WhatsApp" : "✅ WhatsApp support",
					].map((feature, i) => (
						<div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-gray-800/50 rounded-xl">
							<span className="text-sm text-gray-300">{feature}</span>
						</div>
					))}
				</div>

				{/* Price */}
				<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
					<p className="text-3xl font-bold text-white">$74<span className="text-lg text-gray-400">/mes</span></p>
					<p className="text-amber-400 text-xs mt-1">{lang === "es" ? "Todo incluido · Sin contratos" : "All included · No contracts"}</p>
				</div>

				{error && <p className="text-red-400 text-sm mb-4">{error}</p>}

				<button
					type="button"
					onClick={handleSubscribe}
					disabled={loading}
					className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 text-lg"
				>
					{loading ? "..." : (lang === "es" ? "🚀 Activar por $74/mes" : "🚀 Activate for $74/mo")}
				</button>
				<p className="text-gray-600 text-xs mt-4">
					{lang === "es" ? "Pago seguro vía Stripe · Cancela cuando quieras" : "Secure payment via Stripe · Cancel anytime"}
				</p>
			</div>
		</div>
	);
}

// ============ SUBSCRIPTION BANNER ============
function SubscriptionBanner({ lang }: { lang: Lang }) {
	return null; // Banner replaced by paywall
}

// ============ HELP VIEW ============

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
	const { data: fullShop } = useQuery({
		queryKey: ["myShop"],
		queryFn: () => getMyShop(),
	});

	const [googleLink, setGoogleLink] = useState(
		fullShop?.googleReviewLink ?? "",
	);
	const [welcomeMsg, setWelcomeMsg] = useState(fullShop?.welcomeMessage ?? "");
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
		mutationFn: () =>
			updateShop({
				data: {
					id: shop.id,
					googleReviewLink: googleLink || undefined,
					welcomeMessage: welcomeMsg || undefined,
					followUpMessage: followUpMsg || undefined,
					twilioSid: twilioSid || undefined,
					twilioToken: twilioToken || undefined,
					twilioPhone: twilioPhone || undefined,
					smsConsentText: smsConsentText || undefined,
					reminderMessage: reminderMessage || undefined,
					reminderDays: reminderDays,
					logoUrl: logoUrl || undefined,
					weeklyHours: JSON.stringify(weeklyHours),
				},
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["myShop"] }),
	});

	return (
		<div className="space-y-6">
			{/* Messages */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-lg font-semibold text-white">{t.settMessages}</h3>
				<div>
					<label
						htmlFor="set-welcome"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settWelcome}
					</label>
					<textarea
						id="set-welcome"
						value={welcomeMsg}
						onChange={(e) => setWelcomeMsg(e.target.value)}
						rows={3}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
					/>
				</div>
				<div>
					<label
						htmlFor="set-followup"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settFollowUp}
					</label>
					<textarea
						id="set-followup"
						value={followUpMsg}
						onChange={(e) => setFollowUpMsg(e.target.value)}
						rows={3}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
					/>
				</div>
			</div>

			{/* Google */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-lg font-semibold text-white flex items-center gap-2">
					<Star className="w-5 h-5 text-amber-400" /> {t.settGoogle}
				</h3>
				<div>
					<label
						htmlFor="set-google"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settGoogleLink}
					</label>
					<input
						id="set-google"
						type="url"
						value={googleLink}
						onChange={(e) => setGoogleLink(e.target.value)}
						placeholder="https://g.page/r/..."
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					/>
				</div>
			</div>



			{/* SMS Consent (Opt-in) */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-lg font-semibold text-white flex items-center gap-2">
					<Shield className="w-5 h-5 text-blue-400" /> {t.settConsent}
				</h3>
				<p className="text-sm text-gray-500">{t.settConsentDesc}</p>
				<div>
					<label
						htmlFor="set-consent"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settConsentCustom}
					</label>
					<textarea
						id="set-consent"
						value={smsConsentText}
						onChange={(e) => setSmsConsentText(e.target.value)}
						rows={4}
						placeholder={
							lang === "es"
								? `Ej: Acepto recibir mensajes SMS de ${shop.name} incluyendo confirmaciones de turno, recordatorios y promociones. Pueden aplicar tarifas de datos. Responde STOP para cancelar.`
								: `e.g. I agree to receive SMS messages from ${shop.name} including turn confirmations, reminders and promotions. Data rates may apply. Reply STOP to opt out.`
						}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
					/>
					<p className="text-xs text-gray-600 mt-1">{t.settConsentDefault}</p>
				</div>
			</div>

			{/* 30-Day Reminders */}
			<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
				<h3 className="text-lg font-semibold text-white flex items-center gap-2">
					<Bell className="w-5 h-5 text-purple-400" /> {t.settReminder}
				</h3>
				<p className="text-sm text-gray-500">{t.settReminderDesc}</p>
				<div>
					<label
						htmlFor="set-reminder-days"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settReminderDays}
					</label>
					<div className="flex items-center gap-3">
						<input
							id="set-reminder-days"
							type="number"
							min={7}
							max={90}
							value={reminderDays}
							onChange={(e) =>
								setReminderDays(
									Math.max(7, Math.min(90, Number(e.target.value) || 30)),
								)
							}
							className="w-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-center"
						/>
						<span className="text-gray-400 text-sm">
							{t.settReminderDaysUnit}
						</span>
					</div>
				</div>
				<div>
					<label
						htmlFor="set-reminder-msg"
						className="block text-sm font-medium text-gray-300 mb-1"
					>
						{t.settReminderMsg}
					</label>
					<textarea
						id="set-reminder-msg"
						value={reminderMessage}
						onChange={(e) => setReminderMessage(e.target.value)}
						rows={3}
						placeholder={
							lang === "es"
								? "¡Hola {nombre}! Hace tiempo que no te vemos en {barberia}. Te esperamos pronto para tu próximo corte. 💈"
								: "Hey {name}! It's been a while since your last visit at {shop}. Come see us for your next cut! 💈"
						}
						className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
					/>
					<p className="text-xs text-gray-600 mt-1">{t.settReminderVars}</p>
				</div>
			</div>

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
										const dataUrl = await compressImage(file);
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
		</div>
	);
}
