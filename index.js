const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();

app.get('/scrape', async (req, res) => {
  const TARGET_DATE = req.query.date;

  if (!TARGET_DATE) {
    return res.status(400).send("Falta fecha");
  }

  let browser;

  try {
    console.log("Lanzando navegador...");

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    console.log("Entrando al portal...");

    await page.goto('https://sip.gdu.com.uy/SIP/', {
      waitUntil: 'domcontentloaded'
    });

    await page.waitForTimeout(8000);

    console.log("Seteando fecha...");

    await page.evaluate((date) => {
      const inputs = document.querySelectorAll('input');

      inputs.forEach(input => {
        try {
          input.value = date;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      });
    }, TARGET_DATE);

    console.log("Buscando botón descargar...");
    const botones = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.innerText,
    html: b.outerHTML
  }));
});

console.log("BOTONES EN LA PAGINA:", botones);

    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/debug.png' });

return res.send("Revisar logs y screenshot");

    const filePath = `/tmp/stock_${TARGET_DATE}.csv`;

    console.log("Guardando archivo...");

    await download.saveAs(filePath);

    console.log("Enviando archivo...");

    res.download(filePath, () => {
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error("ERROR REAL:", error);

    return res.status(500).send(`
      ERROR:
      ${error.message}
    `);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.get('/', (req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
