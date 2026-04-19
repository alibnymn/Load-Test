module.exports = { scenario };

async function scenario(page, context, events) {
  await page.setDefaultNavigationTimeout(60000); 
  await page.setDefaultTimeout(60000);
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const { username, password } = context.vars;

  try {
    await page.goto('https://www.saucedemo.com/', { waitUntil: 'networkidle' });
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    
    events.emit('counter', 'percobaan_login', 1);
    await page.locator('[data-test="login-button"]').click();

    await page.waitForSelector('.shopping_cart_container', { timeout: 15000 });
    events.emit('counter', 'login_sukses', 1);
    console.log(`✅ User ${username} berhasil login ke SauceDemo.`);

    await page.waitForTimeout(3000);

    await page.click('#react-burger-menu-btn');
    await page.click('[data-test="logout-sidebar-link"]');
    
    console.log(`👋 User ${username} sudah logout.`);

  } catch (e) {
    events.emit('counter', 'login_gagal_timeout', 1);
    console.log(`❌ User ${username} gagal/timeout: ${e.message}`);
  }
}