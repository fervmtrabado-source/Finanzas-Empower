const {
  COLUMNS,
  birthdayText,
  buildMonthlyForRange,
  buildReports,
  currentMonthRange,
  daysUntilNextMonth,
  formatAmount,
  formatDate,
  formatIsoDate,
  getPaymentPremium,
  getPlanCurrency,
  monthlyEmail,
  weeklyEmail,
} = require("./policies");
const {
  getLatestPolicies,
  getMonthlyContactTasks,
  markMonthlyContacted,
} = require("./supabase");

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

function getPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getTaskKey({ row, date }) {
  return [
    getPeriod(date),
    row[COLUMNS.policy],
    formatIsoDate(date),
  ].map((part) => String(part || "").trim()).join("|");
}

function getContactUrl(item, baseUrl = "https://intelligencefe.netlify.app") {
  const params = new URLSearchParams({
    key: getTaskKey(item),
    period: getPeriod(item.date),
    payment_date: formatIsoDate(item.date),
    policy_number: item.row[COLUMNS.policy] || "",
    holder: item.row[COLUMNS.holder] || "",
    plan_name: item.row[COLUMNS.planName] || "",
  });
  return `${baseUrl}/.netlify/functions/mark-monthly-contacted?${params.toString()}`;
}

function monthlyTaskItem(item, baseUrl) {
  return {
    ...paymentItem(item),
    task_key: getTaskKey(item),
    period: getPeriod(item.date),
    contact_url: getContactUrl(item, baseUrl),
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

function monthlyText(items, month, baseUrl) {
  return [
    `Maggie, estos son los cobros semestrales y anuales de ${month}:`,
    "",
    ...items.map((item) => {
      const premium = getPaymentPremium(item.row);
      return [
        `- ${formatDate(item.date)} | ${item.row[COLUMNS.holder]} | ${item.row[COLUMNS.policy]} | ${item.row[COLUMNS.planName]} | ${getPlanCurrency(item.row)} | ${item.row[COLUMNS.frequency]} | ${item.row[COLUMNS.paymentMethod]} | ${formatAmount(premium)}`,
        `  Marcar contactado: ${getContactUrl(item, baseUrl)}`,
      ].join("\n");
    }),
  ].join("\n");
}

function paymentRowsHtml(items, baseUrl, showContactButton) {
  return items.map((item) => {
    const premium = getPaymentPremium(item.row);
    const contactUrl = getContactUrl(item, baseUrl);
    const button = showContactButton
      ? `<div style="margin-top: 12px;"><a href="${contactUrl}" style="display: inline-block; background: #0a2b52; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 10px 14px; border-radius: 6px;">Marcar como contactado</a></div>`
      : "";

    return `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #dce8f3;">
          <div style="font-size: 17px; line-height: 1.25; color: #0a2b52; font-weight: 800;">${escapeHtml(item.row[COLUMNS.holder])}</div>
          <div style="font-size: 14px; line-height: 1.45; color: #26364a; margin-top: 5px;">
            ${escapeHtml(formatDate(item.date))} | Poliza ${escapeHtml(item.row[COLUMNS.policy])} | ${escapeHtml(item.row[COLUMNS.planName])}
          </div>
          <div style="font-size: 13px; line-height: 1.45; color: #637083; margin-top: 4px;">
            ${escapeHtml(getPlanCurrency(item.row))} | ${escapeHtml(item.row[COLUMNS.frequency])} | ${escapeHtml(item.row[COLUMNS.paymentMethod])} | ${escapeHtml(formatAmount(premium))}
          </div>
          ${button}
        </td>
      </tr>
    `;
  }).join("");
}

function emailShell(title, subtitle, rows) {
  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f4f7fb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f4f7fb;">
          <tr>
            <td align="center" style="padding: 24px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 720px; background: #ffffff; border: 1px solid #dce8f3; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px 26px 8px;">
                    <div style="font-size: 22px; line-height: 1.25; color: #0a2b52; font-weight: 800;">${escapeHtml(title)}</div>
                    <div style="font-size: 15px; line-height: 1.5; color: #637083; margin-top: 6px;">${escapeHtml(subtitle)}</div>
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

function monthlyHtml(items, month, baseUrl) {
  return emailShell(
    `Cobros semestrales y anuales de ${month}`,
    "Marca como contactado a cada cliente cuando ya quede atendido.",
    paymentRowsHtml(items, baseUrl, true)
  );
}

function pendingText(items, month, baseUrl) {
  return [
    `Maggie, aun estan pendientes de contactar estos clientes del reporte mensual de ${month}:`,
    "",
    ...items.map((item) => [
      `- ${formatDate(item.date)} | ${item.row[COLUMNS.holder]} | ${item.row[COLUMNS.policy]} | ${item.row[COLUMNS.planName]} | ${getPlanCurrency(item.row)} | ${item.row[COLUMNS.frequency]} | ${item.row[COLUMNS.paymentMethod]} | ${formatAmount(getPaymentPremium(item.row))}`,
      `  Marcar contactado: ${getContactUrl(item, baseUrl)}`,
    ].join("\n")),
  ].join("\n");
}

function pendingHtml(items, month, baseUrl) {
  return emailShell(
    `Pendientes de contactar de ${month}`,
    "Estos son los clientes del reporte mensual que aun no estan marcados como contactados.",
    paymentRowsHtml(items, baseUrl, true)
  );
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
    policies,
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

  const baseUrl = getBaseUrl(event);
  const email = monthlyEmail(result.report);
  const month = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(result.report.monthlyRange.start);
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
    text: monthlyText(result.report.monthly, month, baseUrl),
    html: monthlyHtml(result.report.monthly, month, baseUrl),
    items: result.report.monthly.map((item) => monthlyTaskItem(item, baseUrl)),
  });
}

async function monthlyPendingData(event) {
  const result = await getReport(event);
  if (result.unauthorized) return result.unauthorized;

  const baseUrl = getBaseUrl(event);
  const monthlyRange = currentMonthRange(result.workDate);
  const period = getPeriod(monthlyRange.start);
  const month = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(monthlyRange.start);
  const monthly = buildMonthlyForRange(result.policies, monthlyRange);
  const completed = await getMonthlyContactTasks(period);
  const completedKeys = new Set(completed.map((task) => task.task_key));
  const pending = monthly.filter((item) => !completedKeys.has(getTaskKey(item)));

  return json(200, {
    type: "monthly_pending",
    generated_at: result.generatedAt,
    work_date: formatIsoDate(result.workDate),
    should_send_today: result.workDate.getDay() === 5,
    period: {
      key: period,
      start: formatIsoDate(monthlyRange.start),
      end: formatIsoDate(monthlyRange.end),
    },
    total_count: monthly.length,
    completed_count: completedKeys.size,
    count: pending.length,
    subject: `Pendientes de contactar de ${month}`,
    text: pendingText(pending, month, baseUrl),
    html: pendingHtml(pending, month, baseUrl),
    items: pending.map((item) => monthlyTaskItem(item, baseUrl)),
  });
}

async function markMonthlyContactedData(event) {
  const params = event.queryStringParameters || {};
  const required = ["key", "period", "payment_date", "policy_number", "holder"];
  const missing = required.filter((key) => !params[key]);
  if (missing.length) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: "Faltan datos para marcar este cliente como contactado.",
    };
  }

  await markMonthlyContacted({
    task_key: params.key,
    period: params.period,
    payment_date: params.payment_date,
    policy_number: params.policy_number,
    holder: params.holder,
    plan_name: params.plan_name || "",
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cliente contactado</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f7fb; color: #0a2b52; font-family: Arial, Helvetica, sans-serif; padding: 24px; }
    main { width: min(100%, 520px); background: #fff; border: 1px solid #dce8f3; border-radius: 8px; padding: 28px; box-shadow: 0 18px 42px rgba(8, 43, 87, 0.12); }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0; color: #52667a; font-size: 16px; line-height: 1.5; }
    strong { color: #0a2b52; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }
    button { border: 0; border-radius: 6px; background: #0a2b52; color: #fff; cursor: pointer; font-size: 15px; font-weight: 700; padding: 12px 16px; }
    button.secondary { background: #e9f2fb; color: #0a2b52; }
    .hint { display: none; margin-top: 14px; font-size: 14px; color: #637083; }
    .hint.is-visible { display: block; }
  </style>
</head>
<body>
  <main>
    <h1>Listo, cliente marcado como contactado</h1>
    <p><strong>${escapeHtml(params.holder)}</strong><br>Poliza ${escapeHtml(params.policy_number)}<br>${escapeHtml(params.plan_name || "")}</p>
    <div class="actions">
      <button type="button" onclick="closePage()">Cerrar ventana</button>
      <button class="secondary" type="button" onclick="history.back()">Regresar</button>
    </div>
    <p class="hint" id="close-hint">Si la ventana no se cierra sola, puedes cerrarla manualmente. El cliente ya quedo marcado.</p>
  </main>
  <script>
    function closePage() {
      window.close();
      setTimeout(function () {
        document.getElementById("close-hint").className = "hint is-visible";
      }, 350);
    }
  </script>
</body>
</html>`,
  };
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

module.exports = {
  birthdayData,
  markMonthlyContactedData,
  monthlyData,
  monthlyPendingData,
  weeklyData,
};
