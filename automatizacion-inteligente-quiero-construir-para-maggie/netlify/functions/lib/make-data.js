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
  const backgroundUrl = "https://intelligencefe.netlify.app/assets/birthday-card-bg.png";
  const cards = report.birthdays.map((row) => {
    const holder = escapeHtml(row[COLUMNS.holder]);

    return `
      <tr>
        <td align="center" style="padding: 0 0 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; min-height: 775px; border: 1px solid #d7b56d; border-radius: 18px; overflow: hidden; background-color: #f6fbff; background-image: url('${backgroundUrl}'); background-size: cover; background-position: center top;">
            <tr>
              <td align="center" style="padding: 68px 34px 52px;">
                <img src="${logoUrl}" width="300" alt="Finanzas Empower by Maggie Hernández" style="display: block; width: 300px; max-width: 78%; height: auto; margin: 0 auto 28px;">
                <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 54px; line-height: 0.98; font-style: italic; color: #082b57; margin: 0 0 24px;">
                  ¡Feliz<br>cumpleaños!
                </div>
                <div style="font-size: 22px; line-height: 1.25; letter-spacing: 1.5px; text-transform: uppercase; color: #2f7eb8; font-weight: 700; margin: 0 0 26px;">
                  ${holder}
                </div>
                <div style="width: 140px; height: 1px; background: #76b7e3; margin: 0 auto 24px;">&nbsp;</div>
                <p style="font-size: 20px; line-height: 1.45; margin: 0 auto 18px; max-width: 460px; color: #09264f;">
                  Hoy celebramos tu vida y te deseamos salud, alegría y tranquilidad.
                </p>
                <p style="font-size: 20px; line-height: 1.45; margin: 0 auto 30px; max-width: 460px; color: #09264f;">
                  Gracias por permitirnos acompañarte en la protección de lo que más importa.
                </p>
                <p style="font-size: 18px; line-height: 1.45; margin: 0; color: #09264f;">
                  Con cariño,
                </p>
                <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 35px; line-height: 1.1; font-style: italic; color: #082b57; margin: 4px 0 0;">
                  Maggie Hernández
                </div>
                <div style="font-size: 21px; line-height: 1.25; color: #2f7eb8; font-weight: 700; margin-top: 4px;">
                  Finanzas Empower
                </div>
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
