const fs = require('fs');

const jsonFileName = 'report.json';
const yamlFileName = 'load-test.yaml'; 

try {
    if (!fs.existsSync(jsonFileName)) throw new Error(`File ${jsonFileName} tidak ditemukan!`);
    
    const data = JSON.parse(fs.readFileSync(jsonFileName, 'utf8'));
    const aggregate = data.aggregate || {};
    const counters = aggregate.counters || {};
    const config = data.config || {};
    const intermediate = data.intermediate || [];

    // --- 1. DATA CALCULATION (FIXED LOGIC) ---
    const vCreated = counters["vusers.created"] || 0;
    const vCompleted = counters["vusers.completed"] || 0;
    const vFailed = counters["vusers.failed"] || 0;
    
    // Hitung persentase jujur terhadap populasi vusers
    const completedPercent = vCreated > 0 ? ((vCompleted / vCreated) * 100).toFixed(1) : 0;
    const failedPercent = vCreated > 0 ? ((vFailed / vCreated) * 100).toFixed(1) : 0;

    const successReq = counters["browser.page.codes.200"] || counters["http.codes.200"] || 0;
    const totalReq = counters["browser.http_requests"] || counters["http.requests"] || 0;
    const reqSuccessPercent = totalReq > 0 ? ((successReq / totalReq) * 100).toFixed(1) : 0;
    
    const durationSec = Math.floor((aggregate.period / 1000000000) || 1);
    const avgRps = (totalReq / durationSec).toFixed(1);
    const peakRps = (Math.max(...intermediate.map(s => (s.counters?.["browser.http_requests"] || 0) / 10)) || 0).toFixed(1);

    // --- 2. APDEX LOGIC (MATCH TERMINAL) ---
    const apdexScoreRaw = aggregate.apdex?.score || 0;
    const apdexScore = Math.round(apdexScoreRaw * 100);

    let apdexStatus = "Fair";
    let apdexColor = "text-orange-400";
    let apdexStroke = "stroke-orange-400";
    if (apdexScore >= 94) { 
        apdexStatus = "Excellent"; apdexColor = "text-emerald-500"; apdexStroke = "stroke-emerald-500";
    } else if (apdexScore >= 75) { 
        apdexStatus = "Good"; apdexColor = "text-blue-400"; apdexStroke = "stroke-blue-400";
    }

    const errors = Object.keys(counters)
        .filter(k => (k.includes('error') || k.includes('timeout') || k.includes('401') || k.includes('ETIMEDOUT')) && counters[k] > 0 && k !== 'vusers.failed')
        .map(k => ({ name: k.replace('errors.', '').replace('plugins.metrics-by-endpoint.', ''), count: counters[k] }));

    const labels = intermediate.map((_, i) => (i * 10) + "s");
    const vUsersSeries = intermediate.map(s => s.counters?.["vusers.created"] || 0);
    const latencySeries = intermediate.map(s => s.summaries?.["browser.page.FCP.https://www.saucedemo.com/"]?.p95 || s.summaries?.["http.response_time"]?.p95 || 0);

    let yamlSource = "File YAML tidak ditemukan.";
    if (fs.existsSync(yamlFileName)) yamlSource = fs.readFileSync(yamlFileName, 'utf8');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>QA Load Test Reporting Local</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #0d1117; color: #c9d1d9; }
            .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; height: 100%; }
            .label-title { font-size: 11px; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: 0.1em; }
            .mono { font-family: 'JetBrains Mono', monospace; }
        </style>
    </head>
    <body class="p-8 space-y-6">

        <header class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white">QA</div>
                <h1 class="text-white font-extrabold text-xl tracking-tight uppercase">QA Load Test Reporting <span class="text-blue-500">Local</span></h1>
            </div>
        </header>

        <div class="grid grid-cols-4 gap-6">
            <div class="card p-6">
                <p class="label-title mb-4">Checks</p>
                <div class="space-y-3">
                    <div class="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-black font-bold">✓</div>
                            <span class="text-emerald-400 text-[11px] font-bold mono">page.codes.200</span>
                        </div>
                        <span class="text-white font-bold text-xs">${successReq}</span>
                    </div>
                    <div class="px-1 flex justify-between text-[10px] font-bold uppercase">
                        <span class="text-zinc-500">Success Rate</span>
                        <span class="${reqSuccessPercent < 100 ? 'text-orange-400' : 'text-emerald-500'}">${reqSuccessPercent}%</span>
                    </div>
                </div>
            </div>

            <div class="card p-6 flex flex-col items-center justify-center">
                <p class="label-title self-start mb-4">Apdex</p>
                <div class="relative flex items-center justify-center mb-2">
                    <svg class="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="#21262d" stroke-width="6" fill="transparent" />
                        <circle cx="48" cy="48" r="40" stroke="currentColor" class="${apdexStroke}" stroke-width="6" fill="transparent" stroke-dasharray="251" stroke-dashoffset="${251 - (251 * apdexScore / 100)}" stroke-linecap="round" />
                    </svg>
                    <span class="absolute text-2xl font-black text-white">${apdexScore}</span>
                </div>
                <p class="text-[10px] font-bold uppercase tracking-widest ${apdexColor}">${apdexStatus}</p>
            </div>

            <div class="card p-6">
                <p class="label-title mb-3">Errors</p>
                <div class="space-y-1 max-h-[100px] overflow-y-auto">
                    ${errors.length > 0 ? errors.map(e => `
                        <div class="flex justify-between text-[10px] mono text-red-400 border-b border-zinc-800 pb-1">
                            <span class="truncate pr-2">${e.name}</span><b>${e.count}</b>
                        </div>
                    `).join('') : '<p class="text-zinc-600 italic text-[10px] text-center mt-6">Clean run, no errors.</p>'}
                </div>
            </div>

            <div class="card p-6">
                <p class="label-title mb-4">Metadata</p>
                <div class="text-[11px] space-y-3 text-zinc-400">
                    <div class="flex justify-between"><span>Date</span><span class="text-white">${new Date().toLocaleDateString()}</span></div>
                    <div class="flex justify-between"><span>Duration</span><span class="text-white">${Math.floor(durationSec/60)}m ${durationSec%60}s</span></div>
                    <div class="flex justify-between"><span>Total VU</span><span class="text-white">${vCreated}</span></div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-6">
            <div class="col-span-9 card p-8">
                <p class="label-title mb-8">Load Summary</p>
                
                <div class="grid grid-cols-4 gap-0 mb-12 border-b border-zinc-800 pb-8">
                    <div class="text-center border-r border-zinc-800">
                        <p class="text-4xl font-black text-white">${vCreated}</p>
                        <p class="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-tighter">vusers created</p>
                    </div>
                    
                    <div class="px-8 border-r border-zinc-800">
                        <div class="flex justify-between items-end mb-2">
                            <p class="text-xl font-bold text-white">${vCompleted} <span class="text-xs font-normal text-zinc-500 italic">completed</span></p>
                            <span class="text-[10px] font-bold text-blue-400">${completedPercent}%</span>
                        </div>
                        <div class="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div class="bg-blue-500 h-full shadow-[0_0_10px_rgba(59,130,246,0.4)]" style="width: ${completedPercent}%"></div>
                        </div>
                        <div class="flex justify-between mt-2">
                            <p class="text-[10px] text-zinc-500 font-mono">${vFailed} failed</p>
                            <p class="text-[10px] text-red-400 font-mono">${failedPercent}%</p>
                        </div>
                    </div>

                    <div class="text-center border-r border-zinc-800">
                        <p class="text-4xl font-black text-white">${avgRps}</p>
                        <p class="text-[10px] text-zinc-500 font-bold mt-2 uppercase">avg req/s</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl font-black text-white">${peakRps}</p>
                        <p class="text-[10px] text-zinc-500 font-bold mt-2 uppercase">peak req/s</p>
                    </div>
                </div>

                <div id="mainChart" class="w-full"></div>
            </div>

            <div class="col-span-3 card p-6">
                <p class="label-title mb-6">Test Config</p>
                <div class="bg-black/40 rounded-lg p-4 border border-zinc-800 overflow-hidden h-[500px]">
                    <pre class="text-[10px] text-blue-300 mono whitespace-pre-wrap leading-relaxed h-full overflow-y-auto">${yamlSource.replace(/</g, "&lt;")}</pre>
                </div>
            </div>
        </div>

        <script>
            new ApexCharts(document.querySelector("#mainChart"), {
                series: [
                    { name: 'VUsers', type: 'area', data: ${JSON.stringify(vUsersSeries)} },
                    { name: 'P95 Latency', type: 'line', data: ${JSON.stringify(latencySeries)} }
                ],
                chart: { height: 380, type: 'line', toolbar: { show: false }, background: 'transparent' },
                colors: ['#e3b341', '#3b82f6'],
                stroke: { width: [2, 3], curve: 'smooth' },
                xaxis: { 
                    categories: ${JSON.stringify(labels)}, 
                    labels: { style: { colors: '#6b7280', fontSize: '10px' } }
                },
                yaxis: [
                    { labels: { style: { colors: '#e3b341' } }, title: { text: 'VUsers' } },
                    { opposite: true, labels: { style: { colors: '#3b82f6' } }, title: { text: 'Latency (ms)' } }
                ],
                grid: { borderColor: '#1f2937' },
                theme: { mode: 'dark' }
            }).render();
        </script>
    </body>
    </html>
    `;

    fs.writeFileSync('performance-report.html', htmlContent);
    console.log('✅ BERHASIL! Report sudah jujur sesuai data terminal.');
} catch (e) {
    console.error('❌ Error:', e.message);
}