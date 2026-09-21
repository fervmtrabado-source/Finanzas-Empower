const { buildReports, weeklyEmail } = require("./lib/policies");
const { getLatestPolicies, logNotification } = require("./lib/supabase");
const { sendEmail } = require("./lib/email");

exports.handler = async () => {
  try {
    const policies = await getLatestPolicies();
    const report = buildReports(policies, new Date());
    const email = report.weekly.length
      ? weeklyEmail(report)
      : {
          subject: "Prueba de correo Finanzas Empower",
          text: "Prueba correcta. El cartero Outlook SMTP está configurado, pero hoy no hay cobros semanales no automáticos.",
        };

    const result = await sendEmail({
      to: process.env.MAGGIE_EMAIL,
      subject: `[Prueba] ${email.subject}`,
      text: email.text,
    });

    await logNotification({
      job_name: "test-email",
      channel: "email",
      recipient: process.env.MAGGIE_EMAIL,
      subject: `[Prueba] ${email.subject}`,
      payload: { count: report.weekly.length },
      provider_id: result.id,
      status: "sent",
    });

    return json(200, { sent: true, to: process.env.MAGGIE_EMAIL, count: report.weekly.length });
  } catch (error) {
    return json(500, { error: error.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
