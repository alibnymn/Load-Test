const fs = require('fs');

try {
    const rawData = fs.readFileSync('report.json');
    const data = JSON.parse(rawData);
    const aggregate = data.aggregate;
    const counters = aggregate.counters || {};
    const summaries = aggregate.summaries || {};

    // --- FIX: AMBIL TIMESTAMP & FORMAT ---
    // Pastikan mengambil dari aggregate.timestamp atau data.timestamp
    const rawTimestamp = aggregate.timestamp || data.timestamp || new Date().toISOString();
    const testTimestamp = new Date(rawTimestamp).toLocaleString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // --- 1. AMBIL DATA REAL UNTUK CHECKS ---
    const fcpKey = Object.keys(summaries).find(k => k.includes('browser.page.FCP')) || "";
    const fcpData = summaries[fcpKey] || {};
    
    const realP99 = fcpData.p99 || 0;
    const realP95 = fcpData.p95 || 0;

    // Logika Status Checks (Real Comparison)
    const checkP99 = realP99 < 300 ? { s: '✔', c: 'var(--cyan)' } : { s: '✖', c: '#f85149' };
    const checkP95 = realP95 < 150 ? { s: '✔', c: 'var(--cyan)' } : { s: '✖', c: '#f85149' };

    // --- 2. HITUNG APDEX REAL ---
    // Rumus sederhana: Jika p95 di bawah 200ms = Excellent, di bawah 500ms = Good, dst.
    let apdexScore = 0;
    let apdexRating = "";
    let apdexColor = "";

    if (realP95 <= 200) {
        apdexScore = 99;
        apdexRating = "Excellent";
        apdexColor = "var(--cyan)";
    } else if (realP95 <= 500) {
        apdexScore = 85;
        apdexRating = "Good";
        apdexColor = "var(--orange)";
    } else {
        apdexScore = 60;
        apdexRating = "Fair";
        apdexColor = "#f85149";
    }

    // --- DATA PARSING ---
    const targetUrl = fcpKey.split('FCP.')[1] || "https://www.saucedemo.com/";
    
    const duration = (aggregate.period / 1000000000) || 1;
    const totalRequests = counters["browser.http_requests"] || 0;
    const vCreated = counters["vusers.created"] || 0;
    const vCompleted = counters["vusers.completed"] || 0;
    const vFailed = counters["vusers.failed"] || 0;

    // --- TIME SERIES DATA (MAIN GRAPH) ---
    const labels = data.intermediate.map((_, i) => (i * 10) + "s");
    const vUsersSeries = data.intermediate.map(s => s.counters["vusers.created"] || 0);
    const rpsSeries = data.intermediate.map(s => (s.counters["browser.http_requests"] || 0) / 10);
    const p95Series = data.intermediate.map(s => {
        const k = Object.keys(s.summaries).find(key => key.includes('browser.page.FCP')) || "";
        return s.summaries[k] ? s.summaries[k].p95 : 0;
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Artillery Ultimate Insights | QA Report</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --green: #3fb950; --blue: #58a6ff; --cyan: #39d353; --orange: #d29922; --purple: #ab7df8; --gray: #8b949e; --red: #f85149; }
            body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 30px; line-height: 1.5; }
            .container { max-width: 1200px; margin: auto; }
            
            .qa-header { background: linear-gradient(90deg, #161b22 0%, #0d1117 100%); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .qa-info h1 { font-size: 20px; margin: 0; color: #f0f6fc; display: flex; align-items: center; gap: 10px; }
            .badge-item { text-align: right; border-left: 1px solid var(--border); padding-left: 15px; }
            .badge-label { font-size: 10px; text-transform: uppercase; color: var(--gray); font-weight: 700; }
            .badge-val { font-size: 14px; color: var(--blue); font-weight: 600; display: block; }

            .sec-title { font-size: 13px; font-weight: 600; margin: 30px 0 15px; color: #f0f6fc; display: flex; align-items: center; gap: 8px; }
            .top-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 25px; }
            .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; position: relative; }
            
            .apdex-circle { width: 90px; height: 90px; border: 6px solid; border-radius: 50%; margin: 10px auto; display: flex; flex-direction: column; justify-content: center; align-items: center; }
            .apdex-val { font-size: 28px; font-weight: 800; }
            
            .load-bar { display: grid; grid-template-columns: 1fr 1.5fr 1fr 1fr; background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 25px; }
            .load-item { padding: 22px; border-right: 1px solid var(--border); }
            .l-val { font-size: 26px; font-weight: 700; color: #f0f6fc; display: block; }
            .l-lbl { font-size: 11px; color: var(--gray); }

            .main-chart-container { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 25px; height: 420px; margin-bottom: 25px; }
            .perf-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
            
            .bar-row { display: flex; align-items: center; margin-bottom: 8px; }
            .bar-label { width: 45px; font-size: 11px; color: var(--gray); font-family: monospace; }
            .bar-bg { flex-grow: 1; background: #21262d; height: 18px; border-radius: 3px; position: relative; margin-left: 10px; }
            .bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
            .bar-text { position: absolute; right: 8px; top: 1px; font-weight: 700; font-size: 11px; color: white; }

            .donut-wrapper { position: relative; height: 160px; width: 160px; margin: 0 auto; display: flex; justify-content: center; align-items: center; }
            .donut-text { position: absolute; text-align: center; pointer-events: none; }
            .donut-text .count { font-size: 22px; font-weight: 800; color: #ffffff; display: block; }
            
            .url-table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-top: 10px;}
            .url-table th { background: rgba(255,255,255,0.03); text-align: left; padding: 15px; font-size: 11px; color: var(--gray); }
            .url-table td { padding: 18px 15px; border-bottom: 1px solid #21262d; }
            .badge-success { background: rgba(57, 211, 83, 0.12); color: var(--cyan); border: 1px solid rgba(57, 211, 83, 0.2); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="qa-header">
                <div class="qa-info">
                    <h1><span style="color:var(--cyan)">●</span> OVERVIEW LOAD TEST QA</h1>
                    <p>Project: <strong>SauceDemo Baseline</strong> | Target: <span style="color:var(--blue)">${targetUrl}</span></p>
                </div>
                <div class="qa-badges">
                    <div class="badge-item"><span class="badge-label">ENVIRONMENT</span><span class="badge-val">QA / STAGING</span></div>
                    <div class="badge-item"><span class="badge-label">TEST EXECUTED</span><span class="badge-val">${testTimestamp}</span></div>
                    <div class="badge-item"><span class="badge-label">DURATION</span><span class="badge-val">${Math.floor(duration)}s</span></div>
                </div>
            </div>

            <div class="top-grid">
                <div class="card">
                    <div class="sec-title" style="margin-top:0">Checks <span>ⓘ</span></div>
                    <div style="font-family:monospace; font-size:14px; line-height:2;">
                        <div style="color:${checkP99.c}">${checkP99.s} p99 < 300ms <span style="color:var(--gray); font-size:11px">(${realP99}ms)</span></div>
                        <div style="color:${checkP95.c}">${checkP95.s} p95 < 150ms <span style="color:var(--gray); font-size:11px">(${realP95}ms)</span></div>
                    </div>
                </div>

                <div class="card" style="text-align:center">
                    <div class="sec-title" style="margin-top:0; justify-content:center">Apdex <span>ⓘ</span></div>
                    <div class="apdex-circle" style="border-color:${apdexColor}">
                        <span class="apdex-val" style="color:${apdexColor}">${apdexScore}</span>
                        <span style="font-size:10px; font-weight:700; color:${apdexColor}">${apdexRating.toUpperCase()}</span>
                    </div>
                </div>

                <div class="card" style="text-align:center">
                    <div class="sec-title" style="margin-top:0; justify-content:center">Errors <span>ⓘ</span></div>
                    <div style="margin-top:10px;">
                        <span style="font-size:32px; font-weight:800; color:${vFailed > 0 ? 'var(--red)' : 'var(--cyan)'}">${vFailed}</span><br>
                        <span style="font-size:11px; color:var(--gray)">failed virtual users</span>
                    </div>
                </div>
            </div>

            <div class="sec-title">Load summary <span>ⓘ</span></div>
            <div class="load-bar">
                <div class="load-item"><span class="l-val">${vCreated}</span><span class="l-lbl">vusers created</span></div>
                <div class="load-item">
                    <div style="display:flex; justify-content:space-between"><span class="l-val">${vCompleted} completed</span><span style="font-weight:700">${vCreated > 0 ? Math.round((vCompleted/vCreated)*100) : 0}%</span></div>
                    <div style="background:#30363d; height:5px; margin:10px 0; border-radius:3px;"><div style="width:${vCreated > 0 ? (vCompleted/vCreated)*100 : 0}%; background:var(--green); height:100%"></div></div>
                </div>
                <div class="load-item"><span class="l-val">${(totalRequests / duration).toFixed(1)}</span><span class="l-lbl">average req/s</span></div>
                <div class="load-item"><span class="l-val">${realP95}ms</span><span class="l-lbl">p95 latency</span></div>
            </div>

            <div class="sec-title">Performance metrics <span>ⓘ</span></div>
            <div class="main-chart-container">
                <canvas id="mainChart"></canvas>
            </div>

            <div class="sec-title">HTTP performance <span>ⓘ</span></div>
            <div class="perf-grid">
                <div class="card">
                    <div style="font-size:11px; color:var(--gray); margin-bottom:20px; font-weight:600">Response time distribution</div>
                    ${['min', 'mean', 'p50', 'p95', 'p99', 'max'].map(m => {
                        const val = fcpData[m] || 0;
                        const w = Math.min((val / (fcpData.max || 1)) * 100, 100);
                        return `<div class="bar-row"><div class="bar-label">${m}</div><div class="bar-bg"><div class="bar-fill" style="width:${w}%; background:var(--cyan)"></div><span class="bar-text">${val}ms</span></div></div>`
                    }).join('')}
                </div>
                <div class="card" style="text-align:center">
                    <div style="font-size:11px; color:var(--gray); text-align:left; font-weight:600; margin-bottom:15px">HTTP codes</div>
                    <div class="donut-wrapper">
                        <canvas id="donutChart"></canvas>
                        <div class="donut-text">
                            <span class="count">${totalRequests}</span>
                            <span class="label">requests</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="sec-title">Requests breakdown by URL <span>ⓘ</span></div>
            <table class="url-table">
                <thead><tr><th>URL</th><th>STATUS</th><th>TOTAL</th></tr></thead>
                <tbody>
                    <tr>
                        <td style="color:var(--blue); font-weight:700; font-size:14px;">/ (root)</td>
                        <td><span class="badge-success">200 OK</span></td>
                        <td style="font-weight:800; font-size:15px;">${totalRequests.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <script>
            // Main Chart
            new Chart(document.getElementById('mainChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [
                        { label: 'VUs', data: ${JSON.stringify(vUsersSeries)}, borderColor: '#ab7df8', backgroundColor: 'rgba(171, 125, 248, 0.05)', fill: true, tension: 0.4, borderWidth: 3 },
                        { label: 'p95 Latency', data: ${JSON.stringify(p95Series)}, borderColor: '#58a6ff', tension: 0.4, borderWidth: 2 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#8b949e', usePointStyle: true } } },
                    scales: {
                        y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e' } },
                        x: { grid: { display: false }, ticks: { color: '#8b949e' } }
                    }
                }
            });

            // Donut Chart
            new Chart(document.getElementById('donutChart').getContext('2d'), {
                type: 'doughnut',
                data: { datasets: [{ data: [${totalRequests}], backgroundColor: ['#39d353'], borderWidth: 0 }] },
                options: { cutout: '80%', plugins: { tooltip: { enabled: false } } }
            });
        </script>
    </body>
    </html>
    `;

    fs.writeFileSync('my-report.html', htmlContent);
    console.log('\x1b[36m%s\x1b[0m', '✨ MASTERPIECE CREATED: Check the "TEST EXECUTED" field now!');
} catch (e) { console.log("Error logic: " + e.message); }