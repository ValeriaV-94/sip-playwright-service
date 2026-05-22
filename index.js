const express = require('express');
const { chromium } = require('playwright');

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

    console.log("🌐 Entrando...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(15000);

    console.log("📅 Seteando fechas...");

    await page.evaluate((date) => {
      if (!window.Shiny) {
        throw new Error("Shiny no cargó");
      }

      // 🔥 set correcto
      Shiny.setInputValue('Fechasstock', [date, date], { priority: 'event' });

      // 🔥 FORZAR evento extra (CLAVE)
      document.dispatchEvent(new Event('change'));

    }, TARGET_DATE);

    console.log("⏳ Esperando procesamiento...");

    await page.waitForTimeout(10000);

    console.log("🔁 Forzando refresh interno...");

    // 🔥 ESTE ES EL FIX FINAL
    await page.evaluate(() => {
      if (window.Shiny) {
        Shiny.onInputChange('refresh', Math.random());
      }
    });

    await page.waitForTimeout(8000);

    console.log("🔍 Esperando botón...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    console.log("⬇️ Ejecutando descarga REAL...");

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#DescargarStock')
    ]);

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    await download.saveAs(filePath);

    console.log("✅ DESCARGA COMPLETA");

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
