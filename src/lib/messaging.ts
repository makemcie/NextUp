// Twilio SMS sending utility

export async function sendSMS(params: {
	to: string;
	body: string;
	twilioSid: string;
	twilioToken: string;
	twilioPhone: string;
}): Promise<{ success: boolean; error?: string; sid?: string }> {
	try {
		const url = `https://api.twilio.com/2010-04-01/Accounts/${params.twilioSid}/Messages.json`;
		const auth = btoa(`${params.twilioSid}:${params.twilioToken}`);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				To: params.to,
				From: params.twilioPhone,
				Body: params.body,
			}),
		});

		const data = (await response.json()) as any;

		if (!response.ok) {
			return { success: false, error: data.message || `HTTP ${response.status}` };
		}

		return { success: true, sid: data.sid };
	} catch (e: any) {
		return { success: false, error: e.message };
	}
}
