const {
  COLUMNS,
  birthdayText,
  buildReports,
  daysUntilNextMonth,
  formatAmount,
  formatDate,
  formatIsoDate,
  getPaymentPremium,
  getPlanCurrency,
  monthlyEmail,
  weeklyEmail,
} = require("./policies");
const { getLatestPolicies } = require("./supabase");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function authorizeMake(event) {
  const expected = process.env.MAKE_SHARED_SECRET;
  if (!expected) return null;

  const headers = event.headers || {};
  const provided = headers["x-make-secret"] ||
    headers["X-Make-Secret"] ||
    event.queryStringParameters?.secret;

  if (provided !== expected) {
    return json(401, { error: "No autorizado." });
  }

  return null;
}

function getWorkDate(event) {
  const raw = event.queryStringParameters?.date;
  if (!raw) return new Date();

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("La fecha debe venir en formato YYYY-MM-DD.");

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function paymentItem({ row, date }) {
  const premium = getPaymentPremium(row);
  return {
    payment_date: formatIsoDate(date),
    payment_date_label: formatDate(date),
    holder: row[COLUMNS.holder],
    policy_number: row[COLUMNS.policy],
    plan_name: row[COLUMNS.planName],
    currency: row["Moneda del Plan"] || getPlanCurrency(row),
    frequency: row[COLUMNS.frequency],
    payment_method: row[COLUMNS.paymentMethod],
    premium_due: premium || null,
    premium_due_label: formatAmount(premium),
    email: row[COLUMNS.email] || "",
    phone: row[COLUMNS.phone] || "",
  };
}

function birthdayItem(row) {
  const firstName = getFirstName(row[COLUMNS.holder]);
  return {
    holder: row[COLUMNS.holder],
    insured: row[COLUMNS.insured],
    birth_date: row[COLUMNS.birthDate],
    next_birthday: row[COLUMNS.nextBirthday],
    email: row[COLUMNS.email] || "",
    phone: row[COLUMNS.phone] || "",
    message: `Feliz cumpleaños, ${firstName}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar. Con cariño, Maggie Hernández. Finanzas Empower.`,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFirstName(value) {
  return String(value || "").trim().split(/\s+/)[0] || "";
}

function birthdayHtml(report) {
  const logoUrl = "https://intelligencefe.netlify.app/assets/finanzas-empower-logo.jpg";
  const cards = report.birthdays.map((row) => {
    const holder = escapeHtml(row[COLUMNS.holder]);
    const firstName = escapeHtml(getFirstName(row[COLUMNS.holder]));

    return `
      <tr>
        <td align="center" style="padding: 0 0 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; border: 1px solid #eadfc9; border-radius: 18px; overflow: hidden; background: #fffaf0;">
            <tr>
              <td align="center" style="padding: 26px 26px 10px; background: #fffaf0;">
                <img src="${logoUrl}" width="150" alt="Finanzas Empower" style="display: block; width: 150px; max-width: 70%; height: auto; margin: 0 auto;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 0 24px 10px; background: #fffaf0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="font-size: 0; line-height: 0; padding: 4px 0 12px;">
                      <span style="display: inline-block; width: 12px; height: 12px; background: #7a35bc; border-radius: 50%; margin: 0 8px 0 0;">&nbsp;</span>
                      <span style="display: inline-block; width: 36px; height: 6px; background: #f1b82d; border-radius: 8px; margin: 0 8px 4px 0;">&nbsp;</span>
                      <span style="display: inline-block; width: 10px; height: 10px; background: #1fb7a6; border-radius: 2px; margin: 0 8px 0 0;">&nbsp;</span>
                      <span style="display: inline-block; width: 28px; height: 6px; background: #e85d75; border-radius: 8px; margin: 0 8px 4px 0;">&nbsp;</span>
                    </td>
                    <td align="right" style="font-size: 0; line-height: 0; padding: 4px 0 12px;">
                      <span style="display: inline-block; width: 28px; height: 6px; background: #1fb7a6; border-radius: 8px; margin: 0 0 4px 8px;">&nbsp;</span>
                      <span style="display: inline-block; width: 10px; height: 10px; background: #f1b82d; border-radius: 2px; margin: 0 0 0 8px;">&nbsp;</span>
                      <span style="display: inline-block; width: 12px; height: 12px; background: #e85d75; border-radius: 50%; margin: 0 0 0 8px;">&nbsp;</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 28px 22px; background: #7737b8; color: #ffffff;">
                <div style="font-size: 31px; line-height: 1.14; font-weight: 700; text-align: center;">${holder}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 30px 30px; color: #2d2438;">
                <p style="font-size: 20px; line-height: 1.55; margin: 0 0 24px; text-align: center;">
                  Feliz cumpleaños, ${firstName}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar.
                </p>
                <p style="font-size: 16px; line-height: 1.55; margin: 0; color: #6c6078; text-align: center;">
                  Con cariño,<br>
                  <strong style="color: #2d2438;">Maggie Hernández</strong><br>
                  Finanzas Empower
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f4f1ea; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f4f1ea;">
          <tr>
            <td align="center" style="padding: 18px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px;">
                ${cards}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function getReport(event) {
  const unauthorized = authorizeMake(event);
  if (unauthorized) return { unauthorized };

  const workDate = getWorkDate(event);
  const policies = await getLatestPolicies();
  return {
    report: buildReports(policies, workDate),
    workDate,
    generatedAt: new Date().toISOString(),
  };
}

async function weeklyData(event) {
  const result = await getReport(event);
  if (result.unauthorized) return result.unauthorized;

  const email = weeklyEmail(result.report);
  return json(200, {
    type: "weekly",
    generated_at: result.generatedAt,
    work_date: formatIsoDate(result.workDate),
    period: {
      start: formatIsoDate(result.report.weeklyStart),
      end: formatIsoDate(result.report.weeklyEnd),
    },
    count: result.report.weekly.length,
    subject: email.subject,
    text: email.text,
    items: result.report.weekly.map(paymentItem),
  });
}

async function monthlyData(event) {
  const result = await getReport(event);
  if (result.unauthorized) return result.unauthorized;

  const email = monthlyEmail(result.report);
  return json(200, {
    type: "monthly",
    generated_at: result.generatedAt,
    work_date: formatIsoDate(result.workDate),
    should_send_today: daysUntilNextMonth(result.workDate) === 7,
    days_until_next_month: daysUntilNextMonth(result.workDate),
    period: {
      start: formatIsoDate(result.report.monthlyRange.start),
      end: formatIsoDate(result.report.monthlyRange.end),
    },
    count: result.report.monthly.length,
    subject: email.subject,
    text: email.text,
    items: result.report.monthly.map(paymentItem),
  });
}

async function birthdayData(event) {
  const result = await getReport(event);
  if (result.unauthorized) return result.unauthorized;

  return json(200, {
    type: "birthday",
    generated_at: result.generatedAt,
    work_date: formatIsoDate(result.workDate),
    count: result.report.birthdays.length,
    subject: "Cumpleaños de hoy",
    text: birthdayText(result.report),
    html: birthdayHtml(result.report),
    items: result.report.birthdays.map(birthdayItem),
  });
}

module.exports = { birthdayData, monthlyData, weeklyData };
