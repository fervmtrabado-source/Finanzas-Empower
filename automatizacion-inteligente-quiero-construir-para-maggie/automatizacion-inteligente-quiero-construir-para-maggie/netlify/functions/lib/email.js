const net = require("net");
const tls = require("tls");

async function sendEmail({ to, subject, text }) {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");
  const from = requiredEnv("MAIL_FROM");

  const client = await SmtpClient.connect({ host, port });
  try {
    await client.expect(220);
    await client.command(`EHLO ${host}`, 250);
    await client.command("STARTTLS", 220);
    await client.startTls(host);
    await client.command(`EHLO ${host}`, 250);
    await client.command("AUTH LOGIN", 334);
    await client.command(Buffer.from(user).toString("base64"), 334);
    await client.command(Buffer.from(pass).toString("base64"), 235);
    await client.command(`MAIL FROM:<${extractEmail(from)}>`, 250);
    await client.command(`RCPT TO:<${to}>`, 250);
    await client.command("DATA", 354);
    await client.sendData(buildMessage({ from, to, subject, text }));
    await client.expect(250);
    await client.command("QUIT", 221);
    return { id: `smtp-${Date.now()}` };
  } finally {
    client.close();
  }
}

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`Falta ${name}.`);
  return process.env[name];
}

function extractEmail(value) {
  const match = String(value).match(/<([^>]+)>/);
  return match ? match[1] : value;
}

function buildMessage({ from, to, subject, text }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    ".",
    "",
  ];
  return lines.join("\r\n");
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

class SmtpClient {
  static connect({ host, port }) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, host);
      socket.once("error", reject);
      socket.once("connect", () => resolve(new SmtpClient(socket)));
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
  }

  startTls(host) {
    return new Promise((resolve, reject) => {
      this.socket = tls.connect({
        socket: this.socket,
        servername: host,
      }, () => {
        this.buffer = "";
        resolve();
      });
      this.socket.once("error", reject);
    });
  }

  command(command, expectedCode) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expectedCode);
  }

  sendData(data) {
    this.socket.write(data);
  }

  expect(expectedCode) {
    return new Promise((resolve, reject) => {
      const onData = (chunk) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1] || "";
        if (!/^\d{3} /.test(last)) return;
        this.socket.off("data", onData);
        const code = Number(last.slice(0, 3));
        const response = lines.join("\n");
        this.buffer = "";
        if (code === expectedCode) resolve(response);
        else reject(new Error(`SMTP ${code}: ${response}`));
      };
      this.socket.on("data", onData);
    });
  }

  close() {
    this.socket.destroy();
  }
}

module.exports = { sendEmail };
