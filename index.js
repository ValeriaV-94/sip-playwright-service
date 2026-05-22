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

    console.log("🌐 Entrando...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(15000);

    console.log("📅 Buscando inputs reales...");

    const inputs = await page.locator('input');

    const count = await inputs.count();

    console.log("Inputs encontrados:", count);

    if (count < 2) {
      throw new Error("No se encontraron inputs");
    }

    // 🔥 usar los últimos 2 inputs (los de fecha)
    const inputStart = inputs.nth(count - 2);
    const inputEnd = inputs.nth(count - 1);

    await inputStart.fill(TARGET_DATE);
    await inputEnd.fill(TARGET_DATE);

    // 🔥 disparar eventos reales
    await inputStart.dispatchEvent('change');
    await inputEnd.dispatchEvent('change');

    console.log("⏳ Esperando que Shiny procese...");

    await page.waitForTimeout(10000);

    console.log("⬇️ Intentando descarga...");

    await page.waitForSelector('#DescargarStock');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#DescargarStock')
    ]);

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    await download.saveAs(filePath);

    console.log("✅ Descarga OK");

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
