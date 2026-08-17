function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.handler = async (event) => {
  const name = String(event.queryStringParameters?.name || "Cliente").trim() || "Cliente";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tarjeta de cumpleaños - ${escapeHtml(name)}</title>
  <style>
    :root {
      color-scheme: light;
      --navy: #082b57;
      --blue: #3f8fc5;
      --soft: #f3f8fd;
      --line: #d8b76f;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: #eef5fb;
      color: var(--navy);
      font-family: Arial, Helvetica, sans-serif;
      display: grid;
      place-items: center;
      padding: 18px;
    }

    main {
      width: min(100%, 540px);
      display: grid;
      gap: 12px;
    }

    canvas {
      width: 100%;
      height: auto;
      display: block;
      background: white;
      border-radius: 8px;
      box-shadow: 0 18px 42px rgba(8, 43, 87, 0.18);
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    button, a {
      border: 0;
      border-radius: 6px;
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--navy);
      color: white;
      font: 700 15px/1 Arial, Helvetica, sans-serif;
      text-decoration: none;
      cursor: pointer;
    }

    a { background: var(--blue); }

    .status {
      min-height: 18px;
      margin: 0;
      color: #52667a;
      font-size: 13px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main>
    <canvas id="card" width="1122" height="1402" aria-label="Tarjeta de cumpleaños para ${escapeHtml(name)}"></canvas>
    <div class="actions">
      <button type="button" id="copy">Copiar imagen</button>
      <a id="download" download="cumpleanos-${encodeURIComponent(name).replace(/%20/g, "-")}.png">Descargar PNG</a>
    </div>
    <p class="status" id="status"></p>
  </main>

  <script>
    const name = ${JSON.stringify(name)};
    const canvas = document.getElementById("card");
    const ctx = canvas.getContext("2d");
    const status = document.getElementById("status");
    const download = document.getElementById("download");
    const background = new Image();
    const logo = new Image();

    background.src = "/assets/birthday-card-bg.png";
    logo.src = "/assets/finanzas-empower-logo.jpg";

    function fitText(text, maxWidth, baseSize, minSize, family) {
      let size = baseSize;
      do {
        ctx.font = family(size);
        if (ctx.measureText(text).width <= maxWidth) return size;
        size -= 2;
      } while (size >= minSize);
      return minSize;
    }

    function drawCenteredLines(lines, y, size, lineHeight, color, family, maxWidth) {
      ctx.fillStyle = color;
      lines.forEach((line, index) => {
        const lineSize = maxWidth ? fitText(line, maxWidth, size, Math.max(28, size - 24), family) : size;
        ctx.font = family(lineSize);
        ctx.textAlign = "center";
        ctx.fillText(line, canvas.width / 2, y + index * lineHeight);
      });
    }

    function drawCard() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

      const logoWidth = 520;
      const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
      ctx.drawImage(logo, (canvas.width - logoWidth) / 2, 138, logoWidth, logoHeight);

      drawCenteredLines(["¡Feliz", "cumpleaños!"], 548, 112, 112, "#082b57", (size) => "italic " + size + "px Georgia, serif", 760);

      const displayName = name.toUpperCase();
      const nameSize = fitText(displayName, 760, 45, 32, (size) => "700 " + size + "px Arial, sans-serif");
      ctx.font = "700 " + nameSize + "px Arial, sans-serif";
      ctx.fillStyle = "#2f7eb8";
      ctx.textAlign = "center";
      ctx.fillText(displayName, canvas.width / 2, 785);

      ctx.strokeStyle = "#76b7e3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(410, 842);
      ctx.lineTo(712, 842);
      ctx.stroke();
      ctx.fillStyle = "#76b7e3";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 842, 6, 0, Math.PI * 2);
      ctx.fill();

      drawCenteredLines(["Hoy celebramos tu vida y te", "deseamos salud, alegría y tranquilidad."], 935, 37, 48, "#09264f", (size) => "400 " + size + "px Arial, sans-serif", 760);
      drawCenteredLines(["Gracias por permitirnos acompañarte", "en la protección de lo que más importa."], 1085, 37, 48, "#09264f", (size) => "400 " + size + "px Arial, sans-serif", 760);
      drawCenteredLines(["Con cariño,"], 1215, 32, 40, "#09264f", (size) => "400 " + size + "px Arial, sans-serif");
      drawCenteredLines(["Maggie Hernández"], 1272, 56, 58, "#082b57", (size) => "italic " + size + "px Georgia, serif", 760);
      drawCenteredLines(["Finanzas Empower"], 1328, 36, 42, "#2f7eb8", (size) => "700 " + size + "px Arial, sans-serif");

      download.href = canvas.toDataURL("image/png");
    }

    async function loadImage(image) {
      if (image.complete) return;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
    }

    async function init() {
      await Promise.all([loadImage(background), loadImage(logo)]);
      drawCard();
    }

    document.getElementById("copy").addEventListener("click", async () => {
      try {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        status.textContent = "Imagen copiada. Ahora pégala en WhatsApp.";
      } catch (error) {
        status.textContent = "Si tu navegador no permite copiar, usa Descargar PNG.";
      }
    });

    init().catch(() => {
      status.textContent = "No se pudo cargar la tarjeta. Intenta recargar la página.";
    });
  </script>
</body>
</html>`,
  };
};
