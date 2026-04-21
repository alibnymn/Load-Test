module.exports = { scenario };

async function scenario(requestParams, context, ee, next) {
  // 1. Definisikan URL dan Header
  const url = '/api/HashtagCatalog/get';
  const apiKey = '6e86cbd45483ef26a346d7f5e7982caf2a16bc81';

  try {
    // 2. Lakukan Request GET ke API
    const response = await context.request.get(url, {
      headers: {
        'api_key': apiKey,
        'Accept': 'application/json'
      }
    });

    // 3. Validasi Status Response
    if (response.ok()) {
      ee.emit('counter', 'api_get_hastag_sukses', 1);
      // console.log("✅ API Success: Data Kadar didapat.");
    } else {
      ee.emit('counter', 'api_get_hastag_error_status', 1);
      console.log(`❌ API Error Status: ${response.status()}`);
    }

  } catch (e) {
    ee.emit('counter', 'api_get_hastag_failed', 1);
    console.log(`❌ Connection Failed: ${e.message}`);
  }

  return next(); // Lanjut ke virtual user berikutnya
}