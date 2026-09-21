const COLUMNS = {
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

const FREQUENCY_MONTHS = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const PAYMENTS_PER_YEAR = {
  MENSUAL: 12,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

const AUTOMATIC_METHODS = new Set([
  "CARGO AUTOMATICO A TARJ CRED",
  "TDD",
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseDate(value) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (!match) return null;
  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  return validDate(year, Number(match[2]) - 1, Number(match[1]));
}

function validDate(year, month, day) {
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

function formatIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
  return row[COLUMNS.premium] || getByAliases(row, [
    "Prima anual emitido",
    "Prima anual emitida",
    "Prima anual",
    "Prima emitido",
    "Prima emitida",
  ]) || getByHeaderPattern(row, ["prima", "anual"], ["convert"]);
}

function getConvertedPremium(row) {
  return row[COLUMNS.premiumConverted] || getByAliases(row, [
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
  const divisor = PAYMENTS_PER_YEAR[normalize(row[COLUMNS.frequency])];
  if (!annual || !divisor) return "";
  return annual / divisor;
}

function hasSinglePremiumText(value) {
  const text = normalize(value);
  return text.includes("PRIMA UNICA") || /\bPU\b/.test(text);
}

function isSinglePremium(row) {
  return hasSinglePremiumText(row[COLUMNS.planName]) ||
    hasSinglePremiumText(row[COLUMNS.frequency]);
}

function isActivePolicy(row) {
  return normalize(row[COLUMNS.status]) === "EN VIGOR";
}

function isReportablePolicy(row) {
  return isActivePolicy(row) && !isSinglePremium(row);
}

function dedupeByHolder(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalize(row[COLUMNS.holder]);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    candidate.includes(COLUMNS.policy) && candidate.includes(COLUMNS.holder)
  );
  if (headerIndex === -1) throw new Error("CSV sin columnas de pólizas reconocibles.");

  const headers = rows[headerIndex].map((header) => header.trim());
  return rows.slice(headerIndex + 1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });
    return record;
  }).filter((record) => record[COLUMNS.policy] || record[COLUMNS.holder]);
}

function toPolicyRecord(row, uploadId) {
  return {
    upload_id: uploadId,
    status: row[COLUMNS.status] || "",
    plan_name: row[COLUMNS.planName] || "",
    plan_currency: getPlanCurrency(row),
    advisor_key: row["Clave de asesor"] || "",
    advisor_name: row["Nombre del Asesor"] || "",
    policy_number: row[COLUMNS.policy] || "",
    issue_date: row[COLUMNS.issueDate] || "",
    payment_date: getExplicitPaymentDate(row),
    payment_method: row[COLUMNS.paymentMethod] || "",
    insurance_type: row["Tipo de Seguro"] || "",
    frequency: row[COLUMNS.frequency] || "",
    holder: row[COLUMNS.holder] || "",
    insured: row[COLUMNS.insured] || "",
    next_birthday: row[COLUMNS.nextBirthday] || "",
    annual_premium: getAnnualPremium(row),
    converted_premium: getConvertedPremium(row),
    payment_premium: String(getPaymentPremium(row) || ""),
    email: row[COLUMNS.email] || "",
    phone: row[COLUMNS.phone] || "",
    birth_date: row[COLUMNS.birthDate] || "",
    contract_end_date: row["Fecha terminación de contrato"] || "",
    raw: row,
  };
}

function fromPolicyRecord(record) {
  const premiumRow = {
    [COLUMNS.premium]: record.annual_premium,
    [COLUMNS.premiumConverted]: record.converted_premium,
    [COLUMNS.frequency]: record.frequency,
  };
  return {
    [COLUMNS.status]: record.status,
    [COLUMNS.planName]: record.plan_name,
    [COLUMNS.policy]: record.policy_number,
    [COLUMNS.issueDate]: record.issue_date,
    FechaPago: record.payment_date,
    [COLUMNS.paymentMethod]: record.payment_method,
    [COLUMNS.frequency]: record.frequency,
    [COLUMNS.holder]: record.holder,
    [COLUMNS.insured]: record.insured,
    [COLUMNS.nextBirthday]: record.next_birthday,
    [COLUMNS.birthDate]: record.birth_date,
    [COLUMNS.phone]: record.phone,
    [COLUMNS.email]: record.email,
    [COLUMNS.premium]: record.annual_premium,
    [COLUMNS.premiumConverted]: record.converted_premium,
    "Moneda del Plan": record.plan_currency || getPlanCurrency(premiumRow),
    PrimaPago: record.payment_premium || String(getPaymentPremium(premiumRow) || ""),
  };
}

function getExplicitPaymentDate(row) {
  const key = Object.keys(row).find((candidate) =>
    normalize(candidate).includes("FECHA") && normalize(candidate).includes("PAGO")
  );
  return key ? row[key] : "";
}

function getBasePaymentDate(row) {
  return parseDate(row.FechaPago) || parseDate(row[COLUMNS.issueDate]);
}

function getOccurrencesInRange(row, start, end) {
  const baseDate = getBasePaymentDate(row);
  const interval = FREQUENCY_MONTHS[normalize(row[COLUMNS.frequency])];
  if (!baseDate || !interval) return [];

  const occurrences = [];
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    const monthDistance = (cursor.getFullYear() - baseDate.getFullYear()) * 12 + cursor.getMonth() - baseDate.getMonth();
    if (monthDistance < 0 || monthDistance % interval !== 0) continue;
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(baseDate.getDate(), lastDay));
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

function currentMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function daysUntilNextMonth(date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((nextMonth - current) / 86400000);
}

function isAutomatic(row) {
  return AUTOMATIC_METHODS.has(normalize(row[COLUMNS.paymentMethod]));
}

function getBirthdayMonthDay(row) {
  const parsed = parseDate(row[COLUMNS.nextBirthday] || row[COLUMNS.birthDate]);
  if (!parsed) return null;
  return { day: parsed.getDate(), month: parsed.getMonth() };
}

function buildReports(policyRecords, workDate = new Date()) {
  const rows = policyRecords.map(fromPolicyRecord);
  const activeRows = rows.filter(isActivePolicy);
  const reportableRows = activeRows.filter((row) => !isSinglePremium(row));
  const monthlyRange = nextMonthRange(workDate);
  const weeklyStart = startOfWeek(workDate);
  const weeklyEnd = endOfWeek(workDate);

  const monthly = reportableRows.flatMap((row) => {
    const frequency = normalize(row[COLUMNS.frequency]);
    if (frequency !== "SEMESTRAL" && frequency !== "ANUAL") return [];
    return getOccurrencesInRange(row, monthlyRange.start, monthlyRange.end).map((date) => ({ row, date }));
  }).sort((a, b) => a.date - b.date || a.row[COLUMNS.holder].localeCompare(b.row[COLUMNS.holder]));

  const weekly = reportableRows.flatMap((row) => {
    if (isAutomatic(row)) return [];
    return getOccurrencesInRange(row, weeklyStart, weeklyEnd).map((date) => ({ row, date }));
  }).sort((a, b) => a.date - b.date || a.row[COLUMNS.holder].localeCompare(b.row[COLUMNS.holder]));

  const birthdays = dedupeByHolder(activeRows.filter((row) => {
    const birthday = getBirthdayMonthDay(row);
    return birthday && birthday.day === workDate.getDate() && birthday.month === workDate.getMonth();
  })).sort((a, b) => a[COLUMNS.holder].localeCompare(b[COLUMNS.holder]));

  return { activeRows, monthly, weekly, birthdays, monthlyRange, weeklyStart, weeklyEnd };
}

function buildMonthlyForRange(policyRecords, range) {
  const rows = policyRecords.map(fromPolicyRecord);
  const reportableRows = rows.filter(isReportablePolicy);
  return reportableRows.flatMap((row) => {
    const frequency = normalize(row[COLUMNS.frequency]);
    if (frequency !== "SEMESTRAL" && frequency !== "ANUAL") return [];
    return getOccurrencesInRange(row, range.start, range.end).map((date) => ({ row, date }));
  }).sort((a, b) => a.date - b.date || a.row[COLUMNS.holder].localeCompare(b.row[COLUMNS.holder]));
}

function monthlyEmail(report) {
  const month = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(report.monthlyRange.start);
  return {
    subject: `Cobros semestrales y anuales de ${month}`,
    text: [
      `Maggie, estos son los cobros semestrales y anuales de ${month}:`,
      "",
      ...report.monthly.map(({ row, date }) => `- ${formatDate(date)} | ${row[COLUMNS.holder]} | ${row[COLUMNS.policy]} | ${row[COLUMNS.planName]} | ${getPlanCurrency(row)} | ${row[COLUMNS.frequency]} | ${row[COLUMNS.paymentMethod]} | ${formatAmount(getPaymentPremium(row))}`),
    ].join("\n"),
  };
}

function weeklyEmail(report) {
  return {
    subject: `Cobros no automáticos: ${formatDate(report.weeklyStart)} al ${formatDate(report.weeklyEnd)}`,
    text: [
      "Maggie, estos son los cobros en modo directo y agente de esta semana:",
      "",
      ...report.weekly.map(({ row, date }) => `- ${formatDate(date)} | ${row[COLUMNS.holder]} | ${row[COLUMNS.policy]} | ${row[COLUMNS.planName]} | ${getPlanCurrency(row)} | ${row[COLUMNS.frequency]} | ${row[COLUMNS.paymentMethod]} | ${formatAmount(getPaymentPremium(row))}`),
    ].join("\n"),
  };
}

function birthdayText(report) {
  const firstName = (value) => String(value || "").trim().split(/\s+/)[0] || "";
  return report.birthdays.map((row) =>
    `Hoy cumple años ${row[COLUMNS.holder]}. Mensaje sugerido: Feliz cumpleaños, ${firstName(row[COLUMNS.holder])}. Que este nuevo año llegue con salud, calma y muchas razones para celebrar. Con cariño, Maggie Hernández. Finanzas Empower.`
  ).join("\n\n");
}

module.exports = {
  COLUMNS,
  parseCsv,
  toPolicyRecord,
  buildReports,
  buildMonthlyForRange,
  currentMonthRange,
  daysUntilNextMonth,
  formatAmount,
  formatDate,
  formatIsoDate,
  getPaymentPremium,
  getPlanCurrency,
  monthlyEmail,
  weeklyEmail,
  birthdayText,
};
