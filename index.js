const express = require('express');
const { chromium } = require('playwright');

const fs = require('fs');

const app = express();

app.get('/scrape', async (req, res) => {
  const TARGET_DATE = req.query.date;

  if (!TARGET_DATE) {
    return res.status(400).send("Falta fecha ?date=YYYY-MM-DD");
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    console.log("🌐 Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    // ⏳ Esperar carga completa de Shiny
    await page.waitForTimeout(15000);

    console.log("📅 Seteando fechas...");

    await page.evaluate((date) => {
      if (!window.Shiny) {
        throw new Error("Shiny no está disponible");
      }

      // 🔥 IMPORTANTE: dateRangeInput → array
      Shiny.setInputValue('Fechasstock', [date, date], { priority: "event" });

    }, TARGET_DATE);

    console.log("⏳ Esperando procesamiento...");

    await page.waitForTimeout(8000);

    console.log("🔍 Esperando botón descargar...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    console.log("⬇️ Ejecutando descarga real...");

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#DescargarStock')
    ]);

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    await download.saveAs(filePath);

    console.log("✅ Archivo descargado correctamente");

    await browser.close();

    return res.download(filePath);

  } catch (error) {
    console.error("❌ ERROR:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("🚀 Servidor corriendo en puerto 3000");
});
