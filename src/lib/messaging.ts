// Twilio SMS sending utility — uses global Goolinext Twilio credentials

async function getGlobalTwilio() {
	const mod = await import("cloudflare:workers");
	const env = mod.env as Record<string, string>;
	return {
		sid: env.TWILIO_SID,
		token: env.TWILIO_TOKEN,
		phone: env.TWILIO_PHONE,
	};
}

export async function sendSMS(params: {
	to: string;
	body: string;
	// Legacy params (ignored if global credentials exist)
	twilioSid?: string;
	twilioToken?: string;
	twilioPhone?: string;
}): Promise<{ success: boolean; error?: string; sid?: string }> {
	try {
		// Always use global Goolinext Twilio credentials
		const twilio = await getGlobalTwilio();
		const sid = twilio.sid || params.twilioSid;
		const token = twilio.token || params.twilioToken;
		const phone = twilio.phone || params.twilioPhone;

		if (!sid || !token || !phone) {
			return { success: false, error: "Twilio credentials not configured" };
		}

		const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
		const auth = btoa(`${sid}:${token}`);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				To: params.to,
				From: phone,
				Body: params.body,
			}),
		});

		const data = (await response.json()) as any;

		if (!response.ok) {
			return {
				success: false,
				error: data.message || `HTTP ${response.status}`,
			};
		}

		return { success: true, sid: data.sid };
	} catch (e: any) {
		return { success: false, error: e.message };
	}
}

// Send SMS when barber calls client to the chair
export async function sendCalledToChairSMS(params: {
	clientPhone: string;
	clientName: string;
	barberName: string;
	shopName: string;
}): Promise<void> {
	await sendSMS({
		to: params.clientPhone,
		body: `Hi ${params.clientName}! 💈 ${params.barberName} is ready for you at ${params.shopName}. Please come to the chair now!`,
	});
}

// Send SMS 2.5-3 hours after visit - thank you + Google Review
export async function sendFollowUpSMS(params: {
	clientPhone: string;
	clientName: string;
	shopName: string;
	googleReviewLink?: string | null;
}): Promise<void> {
	const reviewPart = params.googleReviewLink
		? ` Leave us a review: ${params.googleReviewLink}`
		: "";
	await sendSMS({
		to: params.clientPhone,
		body: `Thank you for visiting ${params.shopName}, ${params.clientName}! 💈 We hope you loved your look.${reviewPart}`,
	});
}

// Send SMS 30 days after last visit
export async function sendReminderSMS(params: {
	clientPhone: string;
	clientName: string;
	shopName: string;
}): Promise<void> {
	await sendSMS({
		to: params.clientPhone,
		body: `Hey ${params.clientName}! 💈 It's been a while since your last visit at ${params.shopName}. We miss you! Come see us soon.`,
	});
}

// Send SMS when appointment is confirmed
export async function sendAppointmentConfirmationSMS(params: {
	clientPhone: string;
	clientName: string;
	barberName: string;
	shopName: string;
	date: string;
	time: string;
}): Promise<void> {
	await sendSMS({
		to: params.clientPhone,
		body: `✅ Appointment confirmed at ${params.shopName}!\n${params.clientName} with ${params.barberName}\n📅 ${params.date} at ${params.time}\nSee you soon! 💈`,
	});
}

// Send SMS 2 hours before appointment
export async function sendAppointmentReminderSMS(params: {
	clientPhone: string;
	clientName: string;
	barberName: string;
	shopName: string;
	time: string;
}): Promise<void> {
	await sendSMS({
		to: params.clientPhone,
		body: `⏰ Reminder: Your appointment at ${params.shopName} with ${params.barberName} is today at ${params.time}. See you soon! 💈`,
	});
}

// Send SMS to barber when new appointment is booked
export async function sendBarberNewAppointmentSMS(params: {
	barberPhone: string;
	barberName: string;
	clientName: string;
	date: string;
	time: string;
}): Promise<void> {
	await sendSMS({
		to: params.barberPhone,
		body: `📅 New appointment!\nClient: ${params.clientName}\n${params.date} at ${params.time}\nCheck your portal for details.`,
	});
}

// Send SMS to barber when appointment is cancelled
export async function sendBarberCancellationSMS(params: {
	barberPhone: string;
	barberName: string;
	clientName: string;
	date: string;
	time: string;
}): Promise<void> {
	await sendSMS({
		to: params.barberPhone,
		body: `❌ Appointment cancelled\nClient: ${params.clientName}\n${params.date} at ${params.time}`,
	});
}
