const { schedule } = require("@netlify/functions");
const { buildReports, weeklyEmail } = require("./lib/policies");
const { getLatestPolicies, logNotification } = require("./lib/supabase");
const { sendEmail } = require("./lib/resend");

async function handler() {
  try {
    const policies = await getLatestPolicies();
    const report = buildReports(policies, new Date());
    if (!report.weekly.length) {
      return json(200, { sent: false, reason: "Sin cobros semanales." });
    }

    const email = weeklyEmail(report);
    const result = await sendEmail({
      to: process.env.MAGGIE_EMAIL,
      subject: email.subject,
      text: email.text,
    });

    await logNotification({
      job_name: "weekly-report",
      channel: "email",
      recipient: process.env.MAGGIE_EMAIL,
      subject: email.subject,
      payload: { count: report.weekly.length },
      provider_id: result.id,
      status: "sent",
    });

    return json(200, { sent: true, count: report.weekly.length });
  } catch (error) {
    return json(500, { error: error.message });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = schedule("0 14 * * 1", handler);
