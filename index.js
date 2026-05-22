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

    // 🔥 Esperar Shiny (MUY IMPORTANTE)
    await page.waitForTimeout(15000);

    console.log("Buscando inputs de fecha reales...");

    // 🔥 Buscar TODOS los inputs visibles
    const inputs = await page.locator('input').all();

    if (inputs.length < 2) {
      throw new Error("No hay suficientes inputs en la página");
    }

    // 🔥 Filtrar los que tienen formato fecha
    const dateInputs = [];

    for (const input of inputs) {
      const value = await input.inputValue().catch(() => null);
      const placeholder = await input.getAttribute('placeholder');

      if (
        (value && value.includes('-')) ||
        (placeholder && placeholder.includes('YYYY'))
      ) {
        dateInputs.push(input);
      }
    }

    if (dateInputs.length < 2) {
      throw new Error("No se encontraron inputs de fecha detectables");
    }

    console.log("Seteando fechas...");

    await dateInputs[0].fill(TARGET_DATE);
    await dateInputs[1].fill(TARGET_DATE);

    // 🔥 Esperar que Shiny actualice
    await page.waitForTimeout(6000);

    console.log("Buscando link de descarga...");

    await page.waitForSelector('#DescargarStock', { timeout: 20000 });

    await page.waitForFunction(() => {
      const el = document.querySelector('#DescargarStock');
      return el && el.href && el.href.includes('/download/');
    });

    const downloadUrl = await page.$eval('#DescargarStock', el => el.href);

    console.log("URL:", downloadUrl);

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
