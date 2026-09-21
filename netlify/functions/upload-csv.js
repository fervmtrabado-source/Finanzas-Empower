const { parseCsv, toPolicyRecord } = require("./lib/policies");
const { supabaseFetch } = require("./lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido." });
  }

  try {
    const { fileName = "polizas.csv", csvText } = JSON.parse(event.body || "{}");
    if (!csvText) return json(400, { error: "Falta csvText." });

    const rows = parseCsv(csvText);
    const [upload] = await supabaseFetch("csv_uploads", {
      method: "POST",
      body: JSON.stringify({ file_name: fileName, row_count: rows.length }),
    });

    const records = rows.map((row) => toPolicyRecord(row, upload.id));
    for (let index = 0; index < records.length; index += 500) {
      await supabaseFetch("policies", {
        method: "POST",
        body: JSON.stringify(records.slice(index, index + 500)),
      });
    }

    return json(200, { uploadId: upload.id, rowCount: rows.length });
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
