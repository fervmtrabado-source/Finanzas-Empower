async function sendEmail({ to, subject, text }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY.");
  if (!process.env.MAIL_FROM) throw new Error("Falta MAIL_FROM.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.message || `Resend error ${response.status}`);
  }
  return body;
}

module.exports = { sendEmail };
