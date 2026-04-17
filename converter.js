const fs = require('fs');

try {
    const rawData = fs.readFileSync('report.json');
    const data = JSON.parse(rawData);
    const aggregate = data.aggregate;
    const counters = aggregate.counters || {};
    const summaries = aggregate.summaries || {};

    // 1. Deteksi Target URL
    const fcpKey = Object.keys(summaries).find(k => k.includes('browser.page.FCP')) || "";
    const targetUrl = fcpKey.split('FCP.')[1] || "Target URL Not Found";
    const fcpData = summaries[fcpKey] || {};

    // 2. Data Grafik
    const labels = data.intermediate.map((_, i) => `${(i + 1) * 10}s`);
    const latencyHistory = data.intermediate.map(step => {
        const s = step.summaries;
        const key = Object.keys(s).find(k => k.includes('browser.page.FCP')) || "";
        return s[key] ? s[key].p95 : 0;
    });
    const rpsHistory = data.intermediate.map(step => {
        const reqs = step.counters["browser.http_requests"] || 0;
        return (reqs / 10).toFixed(1);
    });

    // 3. Kalkulasi Metrik Utama (LOAD SUMMARY)
    const testDuration = aggregate.period / 1000000000;
    const totalRequests = counters["browser.http_requests"] || 0;
    const peakRps = Math.max(...data.intermediate.map(step => (step.counters["browser.http_requests"] || 0) / 10));

    const summary = {
        totalVUsers: counters["vusers.created"] || 0,
        successRate: (((counters["vusers.completed"] || 0) / (counters["vusers.created"] || 1)) * 100).toFixed(1),
        avgRps: (totalRequests / testDuration).toFixed(1),
        peakRps: peakRps.toFixed(1),
        min: fcpData.min || 0,
        max: fcpData.max || 0,
        mean: (fcpData.mean || 0).toFixed(1),
        p95: fcpData.p95 || 0,
        p99: fcpData.p99 || 0,
        failed: counters["vusers.failed"] || 0
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>QA Load Test Insights</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --blue: #58a6ff; --green: #3fb950; --yellow: #d29922; --red: #f85149; }
            body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 30px; }
            .container { max-width: 1100px; margin: auto; }
            
            /* Top Load Summary Bar */
            .summary-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
            .summary-item { background: var(--card); border: 1px solid var(--border); padding: 25px 15px; border-radius: 12px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
            .summary-item .val { font-size: 36px; font-weight: 800; display: block; color: #f0f6fc; line-height: 1; }
            .summary-item .lbl { font-size: 11px; color: #8b949e; text-transform: uppercase; margin-top: 10px; letter-spacing: 1px; font-weight: 600; }

            /* Target URL Header */
            .header-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding: 0 5px; }
            .url-tag { background: #0f1d31; color: var(--blue); border: 1px solid rgba(88,166,255,0.3); padding: 6px 15px; border-radius: 6px; font-family: monospace; font-size: 14px; }

            /* Detailed Performance Section */
            .section { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin-bottom: 30px; }
            .section-title { font-size: 15px; font-weight: 700; margin-bottom: 20px; color: #f0f6fc; display: flex; align-items: center; gap: 10px; }
            .section-title::before { content: ""; width: 4px; height: 16px; background: var(--blue); border-radius: 10px; }

            /* Metrics Grid (Card Style) */
            .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .m-card { background: #0d1117; border: 1px solid var(--border); padding: 18px; border-radius: 8px; transition: 0.2s; }
            .m-card:hover { border-color: #444; }
            .m-label { font-size: 10px; color: #8b949e; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
            .m-value { font-size: 20px; font-weight: 700; color: #f0f6fc; }
            .m-unit { font-size: 12px; color: #8b949e; margin-left: 3px; font-weight: 400; }

            /* Glossary Table */
            .glossary-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px; font-size: 13px; color: #8b949e; }
            .glossary-item { padding: 5px 0; border-bottom: 1px solid #21262d; display: flex; justify-content: space-between; }
            .glossary-item b { color: var(--blue); }

            canvas { width: 100% !important; max-height: 280px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header-info">
                <h2 style="margin:0; font-size: 20px;">PERFORMANCE LOAD TEST SUMMARY QA WITH ARTILERY</h2>
                <div class="url-tag">${targetUrl}</div>
            </div>

            <div class="summary-bar">
                <div class="summary-item">
                    <span class="val">${summary.totalVUsers}</span>
                    <span class="lbl">VUsers Created</span>
                </div>
                <div class="summary-item">
                    <span class="val" style="color: var(--green)">${summary.successRate}%</span>
                    <span class="lbl">Success Rate</span>
                </div>
                <div class="summary-item">
                    <span class="val" style="color: var(--blue)">${summary.avgRps}</span>
                    <span class="lbl">Avg Req/s</span>
                </div>
                <div class="summary-item">
                    <span class="val">${summary.peakRps}</span>
                    <span class="lbl">Peak Req/s</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Performance Metrics Detail</div>
                <div class="metrics-grid">
                    <div class="m-card"><div class="m-label">Min Response</div><div class="m-value">${summary.min}<span class="m-unit">ms</span></div></div>
                    <div class="m-card"><div class="m-label">Avg Response</div><div class="m-value" style="color: var(--blue)">${summary.mean}<span class="m-unit">ms</span></div></div>
                    <div class="m-card"><div class="m-label">Max Response</div><div class="m-value">${summary.max}<span class="m-unit">ms</span></div></div>
                    
                    <div class="m-card"><div class="m-label">p95 Latency</div><div class="m-value" style="color: var(--yellow)">${summary.p95}<span class="m-unit">ms</span></div></div>
                    <div class="m-card"><div class="m-label">p99 Latency</div><div class="m-value" style="color: var(--red)">${summary.p99}<span class="m-unit">ms</span></div></div>
                    <div class="m-card"><div class="m-label">Failed VUsers</div><div class="m-value" style="color: var(--red)">${summary.failed}</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Latency Trend (p95 Over Time)</div>
                <canvas id="latencyChart"></canvas>
            </div>

            <div class="section">
                <div class="section-title">RPS Throughput (Over Time)</div>
                <canvas id="rpsChart"></canvas>
            </div>

            <div class="section">
                <div class="section-title">Glossarium & Definisi</div>
                <div class="glossary-list">
                    <div class="glossary-item"><span><b>VUsers</b></span> <span>Simulasi total pengguna</span></div>
                    <div class="glossary-item"><span><b>Avg Req/s</b></span> <span>Rata-rata request per detik</span></div>
                    <div class="glossary-item"><span><b>Peak Req/s</b></span> <span>Puncak trafik tertinggi</span></div>
                    <div class="glossary-item"><span><b>p95 Latency</b></span> <span>Batas waktu 95% user</span></div>
                    <div class="glossary-item"><span><b>Success Rate</b></span> <span>Persentase user berhasil</span></div>
                    <div class="glossary-item"><span><b>p99 Latency</b></span> <span>Batas waktu 1% user paling lambat</span></div>
                </div>
            </div>
        </div>

        <script>
            const createChart = (id, data, color) => {
                const ctx = document.getElementById(id).getContext('2d');
                const grad = ctx.createLinearGradient(0, 0, 0, 400);
                grad.addColorStop(0, color.replace('1)', '0.2)'));
                grad.addColorStop(1, color.replace('1)', '0)'));

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(labels)},
                        datasets: [{
                            data: data,
                            borderColor: color,
                            backgroundColor: grad,
                            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e' } },
                            x: { grid: { display: false }, ticks: { color: '#8b949e' } }
                        }
                    }
                });
            };
            createChart('latencyChart', ${JSON.stringify(latencyHistory)}, 'rgba(210, 153, 34, 1)');
            createChart('rpsChart', ${JSON.stringify(rpsHistory)}, 'rgba(88, 166, 255, 1)');
        </script>
    </body>
    </html>
    `;

    fs.writeFileSync('my-report.html', htmlContent);
    console.log('✅ DASHBOARD SIAP: Load Summary sudah di paling atas!');
} catch (e) { console.log(e); }