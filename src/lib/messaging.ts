// Twilio SMS — uses global Goolinext credentials passed from server functions

export async function sendSMS(params: {
	to: string;
	body: string;
	sid: string;
	token: string;
	phone: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const url = `https://api.twilio.com/2010-04-01/Accounts/${params.sid}/Messages.json`;
		const auth = btoa(`${params.sid}:${params.token}`);
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				To: params.to,
				From: params.phone,
				Body: params.body,
			}),
		});
		const data = (await response.json()) as { message?: string };
		if (!response.ok) return { success: false, error: data.message };
		return { success: true };
	} catch (e: any) {
		return { success: false, error: e.message };
	}
}
