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

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("🌐 Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    // ⏳ Esperar a que cargue Shiny
    await page.waitForTimeout(15000);

    console.log("📅 Seteando fechas en Shiny...");

    await page.evaluate((date) => {
      if (!window.Shiny) {
        throw new Error("Shiny no está disponible");
      }

      // 🔥 CLAVE: dateRangeInput → array
      Shiny.setInputValue('Fechasstock', [date, date], { priority: "event" });

    }, TARGET_DATE);

    console.log("⏳ Esperando que Shiny procese...");

    await page.waitForTimeout(8000);

    console.log("🔍 Buscando botón de descarga...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    const downloadUrl = await page.$eval('#DescargarStock', el => el.href);

    console.log("🔗 URL de descarga:", downloadUrl);

    if (!downloadUrl || !downloadUrl.includes('download')) {
      throw new Error("El link de descarga no es válido");
    }

    console.log("⬇️ Descargando archivo...");

    const response = await page.goto(downloadUrl);

    if (!response || response.status() !== 200) {
      throw new Error("Error al descargar archivo");
    }

    const buffer = await response.body();

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    fs.writeFileSync(filePath, buffer);

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
