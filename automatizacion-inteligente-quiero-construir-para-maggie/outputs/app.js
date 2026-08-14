const state = {
  rows: [],
  filteredRows: [],
  sourceName: "muestra-polizas-sanitizada.csv",
};

const columns = {
  status: "Estatus",
  planName: "Nombre del Plan",
  policy: "Número de Póliza",
  issueDate: "Fecha de emisión",
  paymentMethod: "Método de pago",
  frequency: "Forma de pago",
  holder: "Contratante",
  insured: "Persona asegurada principal",
  nextBirthday: "Información adicional - Próximo cumpleaños",
  birthDate: "Información adicional - Fecha de nacimiento",
  phone: "Información adicional - Teléfono de preferencia",
  email: "Información adicional - Email de preferencia",
  premium: "Prima anual emitido",
  premiumConverted: "Prima anual emitido (convertido)",
};

const frequencyMonths = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const paymentsPerYear = {
  MENSUAL: 12,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

const automaticMethods = new Set([
  "CARGO AUTOMATICO A TARJ CRED",
  "TDD",
]);

const els = {
  csvInput: document.querySelector("#csvInput"),
  workDate: document.querySelector("#workDate"),
  fileStatus: document.querySelector("#fileStatus"),
  totalPolicies: document.querySelector("#totalPolicies"),
  monthlyCount: document.querySelector("#monthlyCount"),
  weeklyCount: document.querySelector("#weeklyCount"),
  birthdayCount: document.querySelector("#birthdayCount"),
  monthlyRows: document.querySelector("#monthlyRows"),
  weeklyRows: document.querySelector("#weeklyRows"),
  allRows: document.querySelector("#allRows"),
  birthdayCards: document.querySelector("#birthdayCards"),
  monthlyTitle: document.querySelector("#monthlyTitle"),
  weeklyTitle: document.querySelector("#weeklyTitle"),
  birthdayTitle: document.querySelector("#birthdayTitle"),
  searchBox: document.querySelector("#searchBox"),
  syncStatus: document.querySelector("#syncStatus"),
  toast: document.querySelector("#toast"),
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  const headerIndex = rows.findIndex((candidate) =>
    candidate.includes(columns.policy) && candidate.includes(columns.holder)
  );

  if (headerIndex === -1) {
    throw new Error("No encontré las columnas esperadas del archivo de pólizas.");
  }

  const headers = rows[headerIndex].map((header) => header.trim());
  return rows.slice(headerIndex + 1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });
    return record;
  }).filter((record) => record[columns.policy] || record[columns.holder]);
}

function parseDate(value) {
  const isoMatch = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = String(value || "").match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function todayInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseNumber(value) {
  const number = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatAmount(value) {
  const number = parseNumber(value);
  if (!Number.isFinite(number) || number === 0) return "";
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function getByAliases(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((key) => normalize(key) === normalize(alias));
    if (match && row[match]) return row[match];
  }
  return "";
}

function getByHeaderPattern(row, includes, excludes = []) {
  const keys = Object.keys(row);
  const match = keys.find((key) => {
    const normalized = normalize(key);
    return includes.every((part) => normalized.includes(normalize(part))) &&
      excludes.every((part) => !normalized.includes(normalize(part)));
  });
  return match ? row[match] : "";
}

function getAnnualPremium(row) {
  return row[columns.premium] || getByAliases(row, [
    "Prima anual emitido",
    "Prima anual emitida",
    "Prima anual",
    "Prima emitido",
    "Prima emitida",
  ]) || getByHeaderPattern(row, ["prima", "anual"], ["convert"]);
}

function getConvertedPremium(row) {
  return row[columns.premiumConverted] || getByAliases(row, [
    "Prima a pagar convertida",
    "Prima a pagar (convertida)",
    "Prima anual emitido (convertido)",
    "Prima anual emitida (convertida)",
  ]) || getByHeaderPattern(row, ["prima", "convert"]);
}

function getPlanCurrency(row) {
  const converted = parseNumber(getConvertedPremium(row));
  const annual = parseNumber(getAnnualPremium(row));
  if (!converted || !annual) return "No disponible";
  const ratio = converted / annual;
  if (Math.abs(ratio - 1) < 0.0001) return "PESOS";
  if (ratio >= 12) return "DÓLARES";
  if (ratio > 0 && ratio < 12) return "UDI";
  return "No disponible";
}

function getPaymentPremium(row) {
  const annual = parseNumber(getAnnualPremium(row));
  const divisor = paymentsPerYear[normalize(row[columns.frequency])];
  if (!annual || !divisor) return "";
  return annual / divisor;
}

function isSinglePremium(row) {
  return normalize(row[columns.planName]).includes("PRIMA UNICA") ||
    normalize(row[columns.frequency]).includes("PRIMA UNICA");
}

function isReportablePolicy(row) {
  return normalize(row[columns.status]) === "EN VIGOR" && !isSinglePremium(row);
}

function dedupeByHolder(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalize(row[columns.holder]);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBasePaymentDate(row) {
  const explicitPaymentColumn = Object.keys(row).find((key) =>
    normalize(key).includes("FECHA") && normalize(key).includes("PAGO")
  );
  return parseDate(explicitPaymentColumn ? row[explicitPaymentColumn] : "") || parseDate(row[columns.issueDate]);
}

function getOccurrencesInRange(row, start, end) {
  const baseDate = getBasePaymentDate(row);
  const frequency = normalize(row[columns.frequency]);
  const interval = frequencyMonths[frequency];
  if (!baseDate || !interval) return [];

  const occurrences = [];
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    const monthDistance = (cursor.getFullYear() - baseDate.getFullYear()) * 12 + cursor.getMonth() - baseDate.getMonth();
    if (monthDistance < 0 || monthDistance % interval !== 0) continue;
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(baseDate.getDate(), lastDay);
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    if (occurrence >= start && occurrence <= end) occurrences.push(occurrence);
  }
  return occurrences;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function nextMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59, 999);
  return { start, end };
}

function isAutomatic(row) {
  return automaticMethods.has(normalize(row[columns.paymentMethod]));
}

function getBirthdayMonthDay(row) {
  const birthday = row[columns.nextBirthday] || row[columns.birthDate];
  const parsed = parseDate(birthday);
  if (!parsed) return null;
  return { day: parsed.getDate(), month: parsed.getMonth() };
}

function buildReports(workDate) {
  const activeRows = state.rows.filter(isReportablePolicy);
  const monthlyRange = nextMonthRange(workDate);
  const weeklyStart = startOfWeek(workDate);
  const weeklyEnd = endOfWeek(workDate);

  const monthly = activeRows.flatMap((row) => {
    const frequency = normalize(row[columns.frequency]);
    if (frequency !== "SEMESTRAL" && frequency !== "ANUAL") return [];
    return getOccurrencesInRange(row, monthlyRange.start, monthlyRange.end).map((date) => ({ row, date }));
  }).sort((a, b) => a.date - b.date || a.row[columns.holder].localeCompare(b.row[columns.holder]));

  const weekly = activeRows.flatMap((row) => {
    if (isAutomatic(row)) return [];
    return getOccurrencesInRange(row, weeklyStart, weeklyEnd).map((date) => ({ row, date }));
  }).sort((a, b) => a.date - b.date || a.row[columns.holder].localeCompare(b.row[columns.holder]));

  const birthdays = dedupeByHolder(activeRows.filter((row) => {
    const birthday = getBirthdayMonthDay(row);
    return birthday && birthday.day === workDate.getDate() && birthday.month === workDate.getMonth();
  })).sort((a, b) => a[columns.holder].localeCompare(b[columns.holder]));

  return { activeRows, monthly, weekly, birthdays, monthlyRange, weeklyStart, weeklyEnd };
}

function rowHtml(cells) {
  return `<tr>${cells.map((cell) => `<td>${cell || ""}</td>`).join("")}</tr>`;
}

function emptyHtml(message, colSpan) {
  return `<tr><td class="empty" colspan="${colSpan}">${message}</td></tr>`;
}

function render() {
  const workDate = parseDate(els.workDate.value) || new Date();
  const reports = buildReports(workDate);
  state.filteredRows = reports.activeRows;

  els.totalPolicies.textContent = reports.activeRows.length;
  els.monthlyCount.textContent = reports.monthly.length;
  els.weeklyCount.textContent = reports.weekly.length;
  els.birthdayCount.textContent = reports.birthdays.length;
  els.monthlyTitle.textContent = `Cobros de ${new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(reports.monthlyRange.start)}`;
  els.weeklyTitle.textContent = `${formatDate(reports.weeklyStart)} al ${formatDate(reports.weeklyEnd)}`;
  els.birthdayTitle.textContent = `Cumpleaños del ${formatDate(workDate)}`;

  els.monthlyRows.innerHTML = reports.monthly.length ? reports.monthly.map(({ row, date }) => rowHtml([
    formatDate(date),
    row[columns.holder],
    row[columns.policy],
    row[columns.planName],
    getPlanCurrency(row),
    `<span class="pill rose">${row[columns.frequency]}</span>`,
    row[columns.paymentMethod],
    formatAmount(getPaymentPremium(row)),
  ])).join("") : emptyHtml("No hay pólizas semestrales o anuales para el mes siguiente.", 8);

  els.weeklyRows.innerHTML = reports.weekly.length ? reports.weekly.map(({ row, date }) => rowHtml([
    formatDate(date),
    row[columns.holder],
    row[columns.policy],
    row[columns.planName],
    getPlanCurrency(row),
    `<span class="pill">${row[columns.frequency]}</span>`,
    row[columns.paymentMethod],
    formatAmount(getPaymentPremium(row)),
  ])).join("") : emptyHtml("No hay cobros no automáticos para esta semana.", 8);

  renderAllRows();
  renderBirthdays(reports.birthdays);
}

function renderAllRows() {
  const query = normalize(els.searchBox.value);
  const workDate = parseDate(els.workDate.value) || new Date();
  const lookAheadEnd = new Date(workDate);
  lookAheadEnd.setMonth(lookAheadEnd.getMonth() + 13);
  const rows = state.filteredRows.filter((row) => {
    const haystack = normalize([
      row[columns.holder],
      row[columns.policy],
      row[columns.paymentMethod],
      row[columns.frequency],
    ].join(" "));
    return haystack.includes(query);
  }).slice(0, 180);

  els.allRows.innerHTML = rows.length ? rows.map((row) => {
    const next = getOccurrencesInRange(row, workDate, lookAheadEnd)[0];
    const birthday = getBirthdayMonthDay(row);
    return rowHtml([
      row[columns.holder],
      row[columns.policy],
      row[columns.planName],
      getPlanCurrency(row),
      row[columns.status],
      row[columns.frequency],
      isAutomatic(row) ? `<span class="pill">Cargo automático</span>` : `<span class="pill rose">${row[columns.paymentMethod]}</span>`,
      formatAmount(getPaymentPremium(row)),
      next ? formatDate(next) : "",
      birthday ? `${String(birthday.day).padStart(2, "0")}/${String(birthday.month + 1).padStart(2, "0")}` : "",
    ]);
  }).join("") : emptyHtml("No encontré resultados con esa búsqueda.", 10);
}

function renderBirthdays(rows) {
  els.birthdayCards.innerHTML = rows.length ? rows.map((row) => `
    <article class="birthday-card">
      <div>
        <p class="eyebrow">Tarjeta lista para WhatsApp</p>
        <strong>${row[columns.holder]}</strong>
        <p>Que este nuevo año llegue con salud, calma y muchas razones para celebrar.</p>
      </div>
      <div class="signature">Con cariño, Finanzas Empower</div>
    </article>
  `).join("") : `<div class="empty">Hoy no hay cumpleaños registrados.</div>`;
}

function buildEmailText(type) {
  const workDate = parseDate(els.workDate.value) || new Date();
  const reports = buildReports(workDate);
  if (type === "monthly") {
    return [
      `Maggie, estos son los cobros semestrales y anuales de ${new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(reports.monthlyRange.start)}:`,
      "",
      ...reports.monthly.map(({ row, date }) => `- ${formatDate(date)} | ${row[columns.holder]} | ${row[columns.policy]} | ${row[columns.planName]} | ${getPlanCurrency(row)} | ${row[columns.frequency]} | ${row[columns.paymentMethod]} | ${formatAmount(getPaymentPremium(row))}`),
    ].join("\n");
  }
  if (type === "weekly") {
    return [
      `Maggie, estos son los cobros no automáticos de la semana ${formatDate(reports.weeklyStart)} al ${formatDate(reports.weeklyEnd)}:`,
      "",
      ...reports.weekly.map(({ row, date }) => `- ${formatDate(date)} | ${row[columns.holder]} | ${row[columns.policy]} | ${row[columns.planName]} | ${getPlanCurrency(row)} | ${row[columns.frequency]} | ${row[columns.paymentMethod]} | ${formatAmount(getPaymentPremium(row))}`),
    ].join("\n");
  }
  return reports.birthdays.map((row) => `Feliz cumpleaños, ${row[columns.holder]}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar. Con cariño, Finanzas Empower.`).join("\n\n");
}

async function copyText(type) {
  const text = buildEmailText(type);
  const safeText = text || "Sin registros para este reporte.";
  fallbackCopy(safeText);
  showToast("Texto copiado.");
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

async function loadCsvText(text, name) {
  state.rows = parseCsv(text);
  state.sourceName = name;
  els.fileStatus.textContent = `${name}: ${state.rows.length} registros detectados. Puedes subir una versión nueva cuando quieras.`;
  render();
}

async function loadRows(rows, name, uploadedAt) {
  state.rows = rows;
  state.sourceName = name;
  const uploaded = uploadedAt ? ` Última actualización: ${formatDate(new Date(uploadedAt))}.` : "";
  els.fileStatus.textContent = `${name}: ${rows.length} registros guardados.${uploaded}`;
  els.syncStatus.textContent = "Información cargada desde la última actualización guardada. Solo sube un CSV cuando quieras reemplazarla.";
  render();
}

async function syncCsvToBackend(text, name) {
  els.syncStatus.textContent = "Guardando CSV para los avisos automáticos...";
  try {
    const response = await fetch("/.netlify/functions/upload-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name, csvText: text }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No se pudo guardar el CSV.");
    els.syncStatus.textContent = `CSV guardado para automatizaciones: ${body.rowCount} registros.`;
  } catch (error) {
    els.syncStatus.textContent = "Vista local activa. Cuando esté desplegada con Supabase, el CSV se guardará para los avisos automáticos.";
  }
}

async function loadLatestSavedData() {
  const response = await fetch("/.netlify/functions/latest-policies");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "No se pudo cargar la última información guardada.");
  if (!body.rows?.length || !body.upload) return false;
  await loadRows(body.rows, body.upload.file_name || "Último CSV guardado", body.upload.uploaded_at);
  return true;
}

function setupEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("is-active"));
      button.classList.add("is-active");
      document.querySelector(`#${button.dataset.tab}Panel`).classList.add("is-active");
    });
  });

  els.csvInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const text = await file.text();
    await loadCsvText(text, file.name);
    await syncCsvToBackend(text, file.name);
  });

  els.workDate.addEventListener("change", render);
  els.searchBox.addEventListener("input", renderAllRows);
  document.querySelector("#copyMonthly").addEventListener("click", () => copyText("monthly"));
  document.querySelector("#copyWeekly").addEventListener("click", () => copyText("weekly"));
  document.querySelector("#copyBirthdays").addEventListener("click", () => copyText("birthdays"));
}

async function boot() {
  setupEvents();
  els.workDate.value = todayInputValue();
  try {
    if (await loadLatestSavedData()) return;
  } catch (error) {
    els.syncStatus.textContent = "No pude leer Supabase en este momento. Muestro la demo hasta que subas o recargues el CSV.";
  }

  try {
    const response = await fetch("data/muestra-polizas-sanitizada.csv");
    await loadCsvText(await response.text(), "muestra-polizas-sanitizada.csv");
  } catch (error) {
    els.fileStatus.textContent = "Sube un CSV para comenzar.";
  }
}

boot();
