async function sendWhatsApp(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.MAGGIE_WHATSAPP_TO;
  if (!sid || !token || !from || !to) {
    return { skipped: true, reason: "WhatsApp no configurado." };
  }

  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || `Twilio error ${response.status}`);
  return payload;
}

module.exports = { sendWhatsApp };
