process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const app = express();

app.get('/scrape', async (req, res) => {
  const TARGET_DATE = req.query.date;

  if (!TARGET_DATE) {
    return res.status(400).send("Falta parámetro ?date=YYYY-MM-DD");
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    console.log("Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'networkidle'
    });

    // ⏳ esperar a que Shiny renderice TODO
    await page.waitForTimeout(8000);

    console.log("Buscando contenedor de fechas...");

    await page.waitForSelector('#Fechasstock', { timeout: 15000 });

    console.log("Seteando fechas via JS...");

    // ⚠️ FORZAMOS valores dentro del contenedor Shiny
    await page.evaluate((date) => {
      const container = document.querySelector('#Fechasstock');
      if (!container) throw new Error("No existe #Fechasstock");

      const inputs = container.querySelectorAll('input');

      if (inputs.length < 2) {
        throw new Error("No hay suficientes inputs de fecha");
      }

      inputs[0].value = date;
      inputs[1].value = date;

      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
    }, TARGET_DATE);

    console.log("Esperando que Shiny procese cambios...");
    await page.waitForTimeout(5000);

    console.log("Obteniendo link de descarga...");

    await page.waitForSelector('#DescargarStock', { timeout: 15000 });

    const downloadUrl = await page.evaluate(() => {
      const link = document.querySelector('#DescargarStock');
      if (!link) throw new Error("No existe botón descargar");

      return link.href;
    });

    console.log("URL descarga:", downloadUrl);

    console.log("Obteniendo cookies...");

    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    console.log("Descargando archivo REAL...");

    const file = fs.createWriteStream(filePath);

    https.get(downloadUrl, {
      headers: {
        Cookie: cookieHeader
      },
      rejectUnauthorized: false
    }, response => {

      if (response.statusCode !== 200) {
        console.log("STATUS ERROR:", response.statusCode);
        return res.status(500).send("Error descargando archivo");
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log("Archivo descargado correctamente");

        browser.close();
        return res.download(filePath);
      });

    }).on('error', err => {
      console.error("ERROR HTTPS:", err);
      browser.close();
      return res.status(500).send(err.toString());
    });

  } catch (error) {
    console.error("ERROR GENERAL:", error);
    return res.status(500).send(error.toString());
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
