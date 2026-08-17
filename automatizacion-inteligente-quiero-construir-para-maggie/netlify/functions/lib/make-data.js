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
  return {
    holder: row[COLUMNS.holder],
    insured: row[COLUMNS.insured],
    birth_date: row[COLUMNS.birthDate],
    next_birthday: row[COLUMNS.nextBirthday],
    email: row[COLUMNS.email] || "",
    phone: row[COLUMNS.phone] || "",
    message: `Feliz cumpleaños, ${row[COLUMNS.holder]}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar. Con cariño, Finanzas Empower.`,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function birthdayHtml(report) {
  const cards = report.birthdays.map((row) => {
    const holder = escapeHtml(row[COLUMNS.holder]);
    const insured = escapeHtml(row[COLUMNS.insured]);
    const phone = escapeHtml(row[COLUMNS.phone]);
    const email = escapeHtml(row[COLUMNS.email]);

    return `
      <tr>
        <td style="padding: 0 0 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #eadfc9; border-radius: 14px; overflow: hidden; background: #fffaf0;">
            <tr>
              <td style="padding: 24px 26px; background: #7737b8; color: #ffffff;">
                <div style="font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Cumpleaños de hoy</div>
                <div style="font-size: 30px; line-height: 1.15; font-weight: 700; margin-top: 8px;">${holder}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 26px; color: #2d2438;">
                <p style="font-size: 17px; line-height: 1.55; margin: 0 0 18px;">
                  Feliz cumpleaños, ${holder}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar.
                </p>
                <p style="font-size: 15px; line-height: 1.5; margin: 0 0 22px; color: #6c6078;">
                  Con cariño,<br>
                  <strong>Finanzas Empower</strong>
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #5b5065;">
                  ${insured ? `<tr><td style="padding: 3px 12px 3px 0; font-weight: 700;">Asegurado</td><td style="padding: 3px 0;">${insured}</td></tr>` : ""}
                  ${phone ? `<tr><td style="padding: 3px 12px 3px 0; font-weight: 700;">Telefono</td><td style="padding: 3px 0;">${phone}</td></tr>` : ""}
                  ${email ? `<tr><td style="padding: 3px 12px 3px 0; font-weight: 700;">Email</td><td style="padding: 3px 0;">${email}</td></tr>` : ""}
                </table>
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
            <td align="center" style="padding: 28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px;">
                <tr>
                  <td style="padding: 0 0 18px; color: #2d2438;">
                    <div style="font-size: 14px; letter-spacing: 1.2px; text-transform: uppercase; color: #7737b8; font-weight: 700;">Finanzas Empower</div>
                    <h1 style="font-size: 26px; line-height: 1.25; margin: 8px 0 6px;">Cumpleaños para celebrar hoy</h1>
                    <p style="font-size: 15px; line-height: 1.5; margin: 0; color: #6c6078;">Lista deduplicada por contratante.</p>
                  </td>
                </tr>
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
