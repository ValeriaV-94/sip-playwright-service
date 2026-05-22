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

    await page.waitForTimeout(15000);

    console.log("Seteando fechas con Shiny...");

    await page.evaluate((date) => {
      if (!window.Shiny) {
        throw new Error("Shiny no cargó");
      }

      Shiny.setInputValue('Fechasstock-date1', date, { priority: "event" });
      Shiny.setInputValue('Fechasstock-date2', date, { priority: "event" });
    }, TARGET_DATE);

    console.log("Esperando actualización del botón...");

    // 🔥 CLAVE: esperar que el href cambie
    await page.waitForFunction(() => {
      const btn = document.querySelector('#DescargarStock');
      return btn && btn.href && btn.href.includes('download') && btn.href.includes('session');
    }, { timeout: 20000 });

    const downloadUrl = await page.$eval('#DescargarStock', el => el.href);

    console.log("Nueva URL:", downloadUrl);

    if (!downloadUrl.includes('download')) {
      throw new Error("El link no es válido");
    }

    console.log("Descargando archivo...");

    const response = await page.goto(downloadUrl);
    const buffer = await response.body();

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    fs.writeFileSync(filePath, buffer);

    await browser.close();

    console.log("Archivo OK");

    return res.download(filePath);

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
