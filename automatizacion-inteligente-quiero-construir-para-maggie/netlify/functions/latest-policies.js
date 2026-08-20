const { supabaseFetch } = require("./lib/supabase");

exports.handler = async () => {
  try {
    const uploads = await supabaseFetch("csv_uploads?select=id,file_name,row_count,uploaded_at&order=uploaded_at.desc&limit=1");
    if (!uploads.length) {
      return json(200, { upload: null, rows: [] });
    }

    const upload = uploads[0];
    const policies = await supabaseFetch(`policies?select=*&upload_id=eq.${upload.id}&order=holder.asc`);
    const rows = policies.map((policy) => policy.raw || toRawPolicy(policy));

    return json(200, { upload, rows });
  } catch (error) {
    return json(500, { error: error.message });
  }
};

function toRawPolicy(policy) {
  return {
    "Estatus": policy.status,
    "Nombre del Plan": policy.plan_name,
    "Número de Póliza": policy.policy_number,
    "Fecha de emisión": policy.issue_date,
    "Método de pago": policy.payment_method,
    "Tipo de Seguro": policy.insurance_type,
    "Forma de pago": policy.frequency,
    "Contratante": policy.holder,
    "Persona asegurada principal": policy.insured,
    "Información adicional - Próximo cumpleaños": policy.next_birthday,
    "Prima anual emitido (convertido)": policy.converted_premium,
    "Prima anual emitido": policy.annual_premium,
    "Información adicional - Email de preferencia": policy.email,
    "Información adicional - Teléfono de preferencia": policy.phone,
    "Información adicional - Fecha de nacimiento": policy.birth_date,
    "Fecha terminación de contrato": policy.contract_end_date,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
