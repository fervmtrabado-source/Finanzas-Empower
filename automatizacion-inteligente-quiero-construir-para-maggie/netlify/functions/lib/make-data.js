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

function birthdayItem(row, baseUrl) {
  const firstName = getFirstName(row[COLUMNS.holder]);
  return {
    holder: row[COLUMNS.holder],
    first_name: firstName,
    insured: row[COLUMNS.insured],
    birth_date: row[COLUMNS.birthDate],
    next_birthday: row[COLUMNS.nextBirthday],
    email: row[COLUMNS.email] || "",
    phone: row[COLUMNS.phone] || "",
    card_url: getBirthdayCardUrl(firstName, baseUrl),
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

function getBaseUrl(event) {
  const headers = event.headers || {};
  const host = headers.host || headers.Host;
  if (host) return `https://${host}`;
  return "https://intelligencefe.netlify.app";
}

function getBirthdayCardUrl(firstName, baseUrl = "https://intelligencefe.netlify.app") {
  const params = new URLSearchParams({ name: firstName || "Cliente" });
  return `${baseUrl}/.netlify/functions/birthday-card?${params.toString()}`;
}

function birthdayHtml(report, baseUrl) {
  const rows = report.birthdays.map((row) => {
    const holder = escapeHtml(row[COLUMNS.holder]);
    const firstName = getFirstName(row[COLUMNS.holder]);
    const cardUrl = getBirthdayCardUrl(firstName, baseUrl);
    const phone = escapeHtml(row[COLUMNS.phone] || "Sin teléfono");
    const email = escapeHtml(row[COLUMNS.email] || "Sin email");

    return `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #dce8f3;">
          <div style="font-size: 19px; line-height: 1.25; color: #0a2b52; font-weight: 700;">${holder}</div>
          <div style="font-size: 14px; line-height: 1.5; color: #637083; margin: 5px 0 14px;">Tel: ${phone} &nbsp;|&nbsp; Email: ${email}</div>
          <a href="${cardUrl}" style="display: inline-block; background: #0a2b52; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 12px 18px; border-radius: 6px;">Abrir tarjeta para WhatsApp</a>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f4f7fb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f4f7fb;">
          <tr>
            <td align="center" style="padding: 24px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 650px; background: #ffffff; border: 1px solid #dce8f3; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px 26px 8px;">
                    <div style="font-size: 22px; line-height: 1.25; color: #0a2b52; font-weight: 800;">Cumpleaños de hoy</div>
                    <div style="font-size: 15px; line-height: 1.5; color: #637083; margin-top: 6px;">Maggie, abre cada tarjeta, revísala y copia o descarga la imagen para enviarla por WhatsApp.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 26px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${rows}
                    </table>
                  </td>
                </tr>
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

  const baseUrl = getBaseUrl(event);
  return json(200, {
    type: "birthday",
    generated_at: result.generatedAt,
    work_date: formatIsoDate(result.workDate),
    count: result.report.birthdays.length,
    subject: "Cumpleaños de hoy: tarjetas para WhatsApp",
    text: birthdayText(result.report),
    html: birthdayHtml(result.report, baseUrl),
    items: result.report.birthdays.map((row) => birthdayItem(row, baseUrl)),
  });
}

module.exports = { birthdayData, monthlyData, weeklyData };
