const { schedule } = require("@netlify/functions");
const { buildReports, birthdayText } = require("./lib/policies");
const { getLatestPolicies, logNotification } = require("./lib/supabase");
const { sendWhatsApp } = require("./lib/twilio");

async function handler() {
  try {
    const policies = await getLatestPolicies();
    const report = buildReports(policies, new Date());
    if (!report.birthdays.length) {
      return json(200, { sent: false, reason: "Sin cumpleaños hoy." });
    }

    const message = birthdayText(report);
    const result = await sendWhatsApp(message);
    await logNotification({
      job_name: "birthday-report",
      channel: "whatsapp",
      recipient: process.env.MAGGIE_WHATSAPP_TO || "sin-configurar",
      subject: "Cumpleaños de hoy",
      payload: { count: report.birthdays.length, skipped: result.skipped || false },
      provider_id: result.sid || null,
      status: result.skipped ? "skipped" : "sent",
      error: result.reason || null,
    });

    return json(200, { sent: !result.skipped, count: report.birthdays.length, result });
  } catch (error) {
    return json(500, { error: error.message });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = schedule("0 15 * * *", handler);
