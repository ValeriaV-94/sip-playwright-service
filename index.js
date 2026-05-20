const express = require('express');
const { chromium } = require('playwright');

const app = express();

// 👉 Endpoint TEST
app.get('/test', async (req, res) => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://example.com');

    const title = await page.title();

    await browser.close();

    res.json({
      success: true,
      title: title
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// 👉 Endpoint raíz (opcional pero útil)
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

// IMPORTANTE PARA RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});