const { schedule } = require("@netlify/functions");
const { buildReports, daysUntilNextMonth, monthlyEmail } = require("./lib/policies");
const { getLatestPolicies, logNotification } = require("./lib/supabase");
const { sendEmail } = require("./lib/resend");

async function handler() {
  try {
    const today = new Date();
    if (daysUntilNextMonth(today) !== 7) {
      return json(200, { sent: false, reason: "Aún no es una semana antes del mes siguiente." });
    }

    const policies = await getLatestPolicies();
    const report = buildReports(policies, today);
    if (!report.monthly.length) {
      return json(200, { sent: false, reason: "Sin cobros mensuales." });
    }

    const email = monthlyEmail(report);
    const result = await sendEmail({
      to: process.env.MAGGIE_EMAIL,
      subject: email.subject,
      text: email.text,
    });

    await logNotification({
      job_name: "monthly-report",
      channel: "email",
      recipient: process.env.MAGGIE_EMAIL,
      subject: email.subject,
      payload: { count: report.monthly.length },
      provider_id: result.id,
      status: "sent",
    });

    return json(200, { sent: true, count: report.monthly.length });
  } catch (error) {
    return json(500, { error: error.message });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = schedule("0 14 * * *", handler);
