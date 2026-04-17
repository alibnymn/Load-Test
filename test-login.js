module.exports = { scenario };

async function scenario(page, context, events) {
  await page.setDefaultNavigationTimeout(60000); 
  await page.setDefaultTimeout(60000);
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const { username, password } = context.vars;

  try {
    await page.goto('http://192.168.0.14:21210/Login', { waitUntil: 'networkidle' });
    
    // 4. Isi Form
    await page.getByRole('textbox', { name: 'Username *' }).fill(username);
    await page.getByRole('textbox', { name: 'Password *' }).fill(password);
    
    events.emit('counter', 'percobaan_login', 1);
    await page.getByRole('button', { name: 'Masuk' }).click();

    await page.waitForSelector('#select_3', { timeout: 20000 });
    events.emit('counter', 'login_sukses', 1);
    console.log(`✅ User ${username} berhasil login.`);

    await page.waitForTimeout(3000);

    await page.getByText('Logout').click();
    console.log(`👋 User ${username} sudah logout.`);

  } catch (e) {
    events.emit('counter', 'login_gagal_timeout', 1);
    console.log(`❌ User ${username} gagal/timeout: ${e.message}`);
  }
}