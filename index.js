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

    // Espera fuerte (Shiny es lento)
    await page.waitForTimeout(12000);

    console.log("Seteando fechas...");

    const inputs = await page.$$('input[type="date"]');

    if (inputs.length < 2) {
      throw new Error("No se encontraron inputs de fecha");
    }

    await inputs[0].fill(TARGET_DATE);
    await inputs[1].fill(TARGET_DATE);

    // Esperar que Shiny procese
    await page.waitForTimeout(6000);

    console.log("Esperando link de descarga...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    // 🔥 Esperar a que el href tenga contenido real
    await page.waitForFunction(() => {
      const el = document.querySelector('#DescargarStock');
      return el && el.href && el.href.includes('/download/');
    });

    const downloadUrl = await page.$eval('#DescargarStock', el => el.href);

    if (!downloadUrl) {
      throw new Error("No se pudo obtener URL de descarga");
    }

    console.log("URL de descarga:", downloadUrl);

    // 🔥 Descargar directo SIN click
    const response = await page.goto(downloadUrl);

    const buffer = await response.body();

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    fs.writeFileSync(filePath, buffer);

    console.log("Archivo descargado correctamente");

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
