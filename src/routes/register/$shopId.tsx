import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronRight,
	Clock,
	Globe,
	Mail,
	MapPin,
	Phone,
	Scissors,
	User,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getConsentText, type Lang, reg } from "@/lib/i18n";
import {
	getActiveBarbers,
	getQueuePosition,
	getShopPublic,
	registerVisit,
} from "@/lib/server-fns";

export const Route = createFileRoute("/register/$shopId")({
	component: RegisterPage,
});

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
			className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-700 transition-all"
		>
			<Globe className="w-3.5 h-3.5" />
			{lang === "es" ? "EN" : "ES"}
		</button>
	);
}

function RegisterPage() {
	const { shopId } = Route.useParams();
	const shopIdNum = Number(shopId);
	const [lang, setLang] = useState<Lang>(getSavedLang);
	const t = reg[lang];

	const { data: shop, isLoading: shopLoading } = useQuery({
		queryKey: ["shopPublic", shopIdNum],
		queryFn: () => getShopPublic({ data: { shopId: shopIdNum } }),
	});

	const { data: barberList, isLoading: barbersLoading } = useQuery({
		queryKey: ["activeBarbers", shopIdNum],
		queryFn: () => getActiveBarbers({ data: { shopId: shopIdNum } }),
	});

	const [step, setStep] = useState(1);
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [smsConsented, setSmsConsented] = useState(false);
	const [selectedBarber, setSelectedBarber] = useState<number | null>(null);
	const [result, setResult] = useState<{
		visitId: number;
		welcomeMessage: string | null;
		shopName: string | null;
		queuePosition: number;
		barberName: string;
	} | null>(null);

	const mutation = useMutation({
		mutationFn: () =>
			registerVisit({
				data: {
					shopId: shopIdNum,
					name,
					phone,
					email: email || undefined,
					barberId: selectedBarber as number,
					smsConsented,
				},
			}),
		onSuccess: (data) => {
			setResult(data);
			setStep(3);
		},
	});

	if (shopLoading || barbersLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="w-12 h-12 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
					<p className="text-gray-400 text-sm">{t.loading}</p>
				</div>
			</div>
		);
	}

	if (!shop) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
				<div className="text-center">
					<div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Scissors className="w-8 h-8 text-gray-600" />
					</div>
					<h2 className="text-xl font-bold text-white mb-2">{t.notFound}</h2>
					<p className="text-gray-500">{t.notFoundDesc}</p>
				</div>
			</div>
		);
	}

	// Build consent text: custom from shop settings or default per language
	const consentText = shop.smsConsentText
		? shop.smsConsentText
				.replace("{barberia}", shop.name)
				.replace("{shop}", shop.name)
				.replace("{nombre}", name || (lang === "es" ? "cliente" : "client"))
				.replace("{name}", name || (lang === "es" ? "cliente" : "client"))
		: getConsentText(lang, shop.name);

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
			{/* Header */}
			<div className="bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 px-4 py-4 safe-top">
				<div className="max-w-lg mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
							<Scissors className="w-5 h-5 text-white" />
						</div>
						<div className="min-w-0">
							<h1 className="text-lg font-bold text-white truncate">
								{shop.name}
							</h1>
							{shop.address && (
								<p className="text-xs text-gray-500 flex items-center gap-1 truncate">
									<MapPin className="w-3 h-3 flex-shrink-0" />
									{shop.address}
								</p>
							)}
						</div>
					</div>
					<LangToggle lang={lang} setLang={setLang} />
				</div>
			</div>

			{/* Progress Bar */}
			<div className="max-w-lg mx-auto w-full px-4 pt-4 pb-2">
				<div className="flex gap-2">
					{[1, 2, 3].map((s) => (
						<div
							key={s}
							className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
								s <= step
									? "bg-gradient-to-r from-amber-500 to-orange-500"
									: "bg-gray-800"
							}`}
						/>
					))}
				</div>
				<p className="text-xs text-gray-600 mt-2 text-center">{t.step(step)}</p>
			</div>

			{/* Content */}
			<div className="flex-1 max-w-lg mx-auto w-full px-4 pb-8">
				{/* Step 1: Client Info */}
				{step === 1 && (
					<div className="space-y-6 animate-in fade-in">
						<div className="text-center pt-2">
							<h2 className="text-2xl font-bold text-white mb-1">
								{t.welcome}
							</h2>
							<p className="text-gray-400">{t.subtitle}</p>
						</div>

						<div className="space-y-4">
							<div>
								<label
									htmlFor="reg-name"
									className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-1.5"
								>
									<User className="w-4 h-4 text-amber-400" />
									{t.name}
									<span className="text-amber-500">{t.required}</span>
								</label>
								<input
									id="reg-name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={t.namePlaceholder}
									className="w-full px-4 py-3.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-base"
									autoComplete="name"
								/>
							</div>
							<div>
								<label
									htmlFor="reg-phone"
									className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-1.5"
								>
									<Phone className="w-4 h-4 text-amber-400" />
									{t.phone}
									<span className="text-amber-500">{t.required}</span>
								</label>
								<input
									id="reg-phone"
									type="tel"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder={t.phonePlaceholder}
									className="w-full px-4 py-3.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-base"
									autoComplete="tel"
								/>
							</div>
							<div>
								<label
									htmlFor="reg-email"
									className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-1.5"
								>
									<Mail className="w-4 h-4 text-gray-500" />
									{t.email}
									<span className="text-gray-600 text-xs font-normal">
										{t.optional}
									</span>
								</label>
								<input
									id="reg-email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder={t.emailPlaceholder}
									className="w-full px-4 py-3.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-base"
									autoComplete="email"
								/>
							</div>

							{/* SMS Consent Checkbox */}
							<label
								htmlFor="sms-consent"
								className="flex items-start gap-3 cursor-pointer group pt-1"
							>
								<div className="flex-shrink-0 mt-0.5">
									<input
										id="sms-consent"
										type="checkbox"
										checked={smsConsented}
										onChange={(e) => setSmsConsented(e.target.checked)}
										className="sr-only peer"
									/>
									<div className="w-5 h-5 border-2 border-gray-600 rounded-md flex items-center justify-center transition-all peer-checked:border-amber-500 peer-checked:bg-amber-500 group-hover:border-gray-500">
										{smsConsented && (
											<Check className="w-3.5 h-3.5 text-white" />
										)}
									</div>
								</div>
								<span className="text-xs text-gray-400 leading-relaxed">
									{consentText}
								</span>
							</label>
						</div>

						<button
							type="button"
							onClick={() => setStep(2)}
							disabled={!name.trim() || !phone.trim()}
							className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg shadow-amber-500/20"
						>
							{t.next}
							<ChevronRight className="w-5 h-5" />
						</button>
					</div>
				)}

				{/* Step 2: Select Barber */}
				{step === 2 && (
					<div className="space-y-5 animate-in fade-in">
						<div>
							<button
								type="button"
								onClick={() => setStep(1)}
								className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-3 transition-colors"
							>
								<ArrowLeft className="w-4 h-4" />
								{t.back}
							</button>
							<div className="text-center">
								<h2 className="text-2xl font-bold text-white mb-1">
									{t.chooseBarber}
								</h2>
								<p className="text-gray-400">{t.chooseBarberSub}</p>
							</div>
						</div>

						{barberList && barberList.length > 0 ? (
							<div className="grid grid-cols-2 gap-3">
								{barberList.map((barber) => (
									<button
										type="button"
										key={barber.id}
										onClick={() => setSelectedBarber(barber.id)}
										className={`p-4 rounded-2xl border-2 transition-all text-center relative overflow-hidden flex flex-col items-center ${
											selectedBarber === barber.id
												? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
												: "border-gray-800 bg-gray-900/60 hover:border-gray-700 active:scale-95"
										}`}
									>
										{barber.photoUrl ? (
											<img
												src={barber.photoUrl}
												alt={barber.name}
												className={`w-16 h-16 rounded-full object-cover mb-3 border-2 transition-all ${
													selectedBarber === barber.id
														? "border-amber-500"
														: "border-gray-700"
												}`}
											/>
										) : (
											<div
												className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${
													selectedBarber === barber.id
														? "bg-gradient-to-br from-amber-500 to-orange-600"
														: "bg-gradient-to-br from-amber-500/20 to-orange-600/20"
												}`}
											>
												<Scissors
													className={`w-7 h-7 ${
														selectedBarber === barber.id
															? "text-white"
															: "text-amber-400"
													}`}
												/>
											</div>
										)}
										<p className="text-white font-semibold text-base">
											{barber.name}
										</p>
										{barber.specialty && (
											<p className="text-xs text-gray-500 mt-0.5">
												{barber.specialty}
											</p>
										)}
										{selectedBarber === barber.id && (
											<div className="absolute top-3 right-3 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
												<Check className="w-4 h-4 text-white" />
											</div>
										)}
									</button>
								))}
							</div>
						) : (
							<div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
								<Scissors className="w-10 h-10 text-gray-600 mx-auto mb-3" />
								<p className="text-gray-500">{t.noBarbers}</p>
							</div>
						)}

						<button
							type="button"
							onClick={() => mutation.mutate()}
							disabled={!selectedBarber || mutation.isPending}
							className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg shadow-amber-500/20"
						>
							{mutation.isPending ? (
								<>
									<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									{t.registering}
								</>
							) : (
								<>
									{t.confirm}
									<Check className="w-5 h-5" />
								</>
							)}
						</button>

						{mutation.isError && (
							<p className="text-red-400 text-sm text-center">{t.error}</p>
						)}
					</div>
				)}

				{/* Step 3: Confirmation with Queue Position */}
				{step === 3 && result && (
					<QueueConfirmation result={result} lang={lang} />
				)}
			</div>

			{/* Footer */}
			<div className="border-t border-gray-800/50 py-3 text-center safe-bottom">
				<p className="text-xs text-gray-700">
					Powered by{" "}
					<span className="text-amber-600 font-semibold">Goolinext</span>
				</p>
			</div>
		</div>
	);
}

function QueueConfirmation({
	result,
	lang,
}: {
	result: {
		visitId: number;
		welcomeMessage: string | null;
		shopName: string | null;
		queuePosition: number;
		barberName: string;
	};
	lang: Lang;
}) {
	const t = reg[lang];
	const { data: posData } = useQuery({
		queryKey: ["queuePosition", result.visitId],
		queryFn: () => getQueuePosition({ data: { visitId: result.visitId } }),
		refetchInterval: 10000,
	});

	const currentPosition = posData?.position ?? result.queuePosition;
	const isDone = posData === null;

	const [pulse, setPulse] = useState(false);
	useEffect(() => {
		setPulse(true);
		const timer = setTimeout(() => setPulse(false), 600);
		return () => clearTimeout(timer);
	}, []);

	if (isDone) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in">
				<div className="relative">
					<div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30">
						<Check className="w-12 h-12 text-white" />
					</div>
				</div>
				<div>
					<h2 className="text-3xl font-bold text-white mb-2">{t.yourTurn}</h2>
					<p className="text-gray-400 text-lg">
						{t.goTo}{" "}
						<span className="text-amber-400 font-semibold">
							{result.barberName}
						</span>
					</p>
				</div>
				<div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 max-w-sm w-full">
					<p className="text-green-400 text-lg font-medium">
						{t.barberWaiting}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in">
			{/* Position Badge */}
			<div className="relative">
				<div
					className={`w-28 h-28 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30 transition-transform duration-300 ${pulse ? "scale-110" : "scale-100"}`}
				>
					<div className="text-center">
						<p className="text-white text-4xl font-black leading-none">
							#{currentPosition}
						</p>
					</div>
				</div>
				<div className="absolute -inset-2 bg-amber-500/15 rounded-full animate-pulse" />
			</div>

			<div>
				<h2 className="text-2xl font-bold text-white mb-1">{t.inLine}</h2>
				<p className="text-gray-400">
					{t.barber}{" "}
					<span className="text-amber-400 font-semibold">
						{result.barberName}
					</span>
				</p>
			</div>

			{/* Queue Info Card */}
			<div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-gray-400">
						<Users className="w-4 h-4" />
						<span className="text-sm">{t.position}</span>
					</div>
					<span className="text-amber-400 font-bold text-lg">
						#{currentPosition}
					</span>
				</div>
				{currentPosition === 1 ? (
					<div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
						<p className="text-green-400 text-sm font-medium flex items-center gap-2">
							<Check className="w-4 h-4" />
							{t.youreNext}
						</p>
					</div>
				) : (
					<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
						<p className="text-amber-400 text-sm font-medium flex items-center gap-2">
							<Clock className="w-4 h-4" />
							{t.peopleBefore(currentPosition - 1)}
						</p>
					</div>
				)}
			</div>

			{/* Welcome Message */}
			<div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-5 max-w-sm w-full">
				<p className="text-white leading-relaxed">
					{result.welcomeMessage || t.defaultWelcome}
				</p>
			</div>

			<div className="space-y-2">
				<p className="text-gray-500 text-sm flex items-center gap-1.5 justify-center">
					<Clock className="w-3.5 h-3.5" />
					{t.autoRefresh}
				</p>
				<p className="text-gray-600 text-xs">{t.dontClose}</p>
			</div>
		</div>
	);
}
