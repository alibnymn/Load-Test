module.exports = { scenario };

async function scenario(page, context, events) {
 
  await page.setDefaultNavigationTimeout(30000);
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  try {
    await page.goto('https://alibnymn.github.io', { waitUntil: 'domcontentloaded' });
    events.emit('counter', 'homepage_akses_sukses', 1);

    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(2000); 

    console.log("✅ Satu user berhasil eksplor porto.");

  } catch (e) {
    events.emit('counter', 'homepage_akses_gagal', 1);
    console.log(`❌ Gagal akses porto: ${e.message}`);
  }
}