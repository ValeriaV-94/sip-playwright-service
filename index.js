const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();

app.get('/scrape', async (req, res) => {
  const TARGET_DATE = req.query.date;

  if (!TARGET_DATE) {
    return res.status(400).send("Falta fecha");
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    // 🔥 Esperar que Shiny cargue
    await page.waitForTimeout(15000);

    console.log("Inyectando fecha vía Shiny...");

    await page.evaluate((date) => {
      if (!window.Shiny) {
        throw new Error("Shiny no está disponible");
      }

      // 🔥 nombres reales (IMPORTANTE)
      Shiny.setInputValue('Fechasstock-date1', date);
      Shiny.setInputValue('Fechasstock-date2', date);
    }, TARGET_DATE);

    console.log("Esperando actualización...");

    await page.waitForTimeout(8000);

    console.log("Obteniendo link de descarga...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    const downloadUrl = await page.$eval('#DescargarStock', el => el.href);

    if (!downloadUrl || !downloadUrl.includes('/download/')) {
      throw new Error("El link de descarga no se generó correctamente");
    }

    console.log("URL:", downloadUrl);

    const response = await page.goto(downloadUrl);
    const buffer = await response.body();

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    fs.writeFileSync(filePath, buffer);

    await browser.close();

    console.log("Archivo descargado correctamente");

    return res.download(filePath);

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
