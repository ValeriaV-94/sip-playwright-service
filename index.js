const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const app = express();

app.get('/scrape', async (req, res) => {
  const TARGET_DATE = req.query.date;

  if (!TARGET_DATE) {
    return res.status(400).send("Falta ?date=YYYY-MM-DD");
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("🌐 Entrando...");
    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(15000);

    console.log("📅 Seteando fechas REAL...");

    await page.evaluate((date) => {
      if (!window.Shiny) throw new Error("Shiny no cargó");

      // SETEAR RANGO DE FECHAS CORRECTAMENTE
      Shiny.setInputValue('Fechasstock', [date, date], { priority: 'event' });
    }, TARGET_DATE);

    console.log("⏳ Esperando que Shiny procese...");
    await page.waitForTimeout(12000);

    console.log("🔍 Buscando link de descarga REAL...");

    // 🔥 ESTE ES EL FIX CLAVE
    const downloadUrl = await page.evaluate(() => {
      const link = document.querySelector('#DescargarStock');
      if (!link) throw new Error("No existe botón");

      return link.href; // 👈 ACA ESTA LA CLAVE
    });

    console.log("📥 URL de descarga:", downloadUrl);

    if (!downloadUrl.includes("download")) {
      throw new Error("Shiny no generó archivo todavía");
    }

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    console.log("⬇️ Descargando archivo MANUALMENTE...");

    // 🔥 Descargar manual con cookies de sesión
    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const file = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      const request = https.get(downloadUrl, {
        headers: {
          Cookie: cookieHeader
        }
      }, response => {
        if (response.statusCode !== 200) {
          reject(new Error("Respuesta no válida"));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      });

      request.on('error', reject);
    });

    console.log("✅ Archivo descargado correctamente");

    await browser.close();

    return res.download(filePath);

  } catch (error) {
    console.error("❌ ERROR:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("🚀 Server listo");
});
