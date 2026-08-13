async function supabaseFetch(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.message || `Supabase error ${response.status}`);
  }
  return body;
}

async function getLatestPolicies() {
  const uploads = await supabaseFetch("csv_uploads?select=id&order=uploaded_at.desc&limit=1");
  if (!uploads.length) return [];
  return supabaseFetch(`policies?select=*&upload_id=eq.${uploads[0].id}&order=holder.asc`);
}

async function logNotification(entry) {
  return supabaseFetch("notification_log", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

module.exports = { supabaseFetch, getLatestPolicies, logNotification };
