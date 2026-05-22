const express = require('express');
const { chromium } = require('playwright');

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

    const context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    console.log("Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(6000);

    console.log("Seteando fechas...");

    const inputs = await page.$$('input[type="date"]');

    if (inputs.length < 2) {
      throw new Error("No se encontraron inputs de fecha");
    }

    await inputs[0].fill(TARGET_DATE);
    await inputs[1].fill(TARGET_DATE);

    console.log("Buscando botón descargar...");

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('text=Descargar').click()
    ]);

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    await download.saveAs(filePath);

    console.log("Archivo descargado");

    await browser.close();

    return res.download(filePath);

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
