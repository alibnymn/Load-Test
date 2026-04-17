module.exports = { scenario };

async function scenario(page, context, events) {
  // 1. Setup Timeout & Headers
  await page.setDefaultNavigationTimeout(60000); 
  await page.setDefaultTimeout(60000);
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // 2. Ambil data dari CSV (pastiin di csv isinya standard_user & secret_sauce)
  const { username, password } = context.vars;

  try {
    // 3. Buka Halaman SauceDemo
    await page.goto('https://www.saucedemo.com/', { waitUntil: 'networkidle' });
    
    // 4. Isi Form pake selector data-test (Lebih Akurat)
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    
    events.emit('counter', 'percobaan_login', 1);
    await page.locator('[data-test="login-button"]').click();

    // 5. Validasi Berhasil Login
    // Di SauceDemo, setelah login biasanya muncul header "Products" atau "shopping_cart_container"
    await page.waitForSelector('.shopping_cart_container', { timeout: 15000 });
    events.emit('counter', 'login_sukses', 1);
    console.log(`✅ User ${username} berhasil login ke SauceDemo.`);

    // Jeda simulasi baca produk
    await page.waitForTimeout(3000);

    // 6. Proses Logout
    // Di SauceDemo harus buka burger menu dulu baru klik logout
    await page.click('#react-burger-menu-btn');
    await page.click('[data-test="logout-sidebar-link"]');
    
    console.log(`👋 User ${username} sudah logout.`);

  } catch (e) {
    events.emit('counter', 'login_gagal_timeout', 1);
    console.log(`❌ User ${username} gagal/timeout: ${e.message}`);
  }
}