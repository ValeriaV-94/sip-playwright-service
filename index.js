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

console.log("Esperando carga de filtros...");

// Esperar que cargue la página dinámica
await page.waitForSelector('input', { timeout: 15000 });

console.log("Seteando fecha vía JavaScript...");

// Forzar fecha en TODOS los inputs
await page.evaluate((date) => {
  const inputs = document.querySelectorAll('input');

  inputs.forEach(input => {
    try {
      input.value = date;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  });
}, TARGET_DATE);

console.log("Fecha seteada");

    console.log("Buscando botón descargar...");

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      console.log("Buscando botón descargar...");

await page.waitForSelector('button', { timeout: 15000 });

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText.includes('Descargar'));

    if (btn) {
      btn.click();
    } else {
      throw new Error("Botón Descargar no encontrado");
    }
  })
]);
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
