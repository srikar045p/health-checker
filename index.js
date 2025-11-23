const express = require('express');
const path = require('path');
const { systemHealthMonitor } = require('./system-health-monitor');

const app = express();
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ System Health Dashboard
app.get('/api/system-health', (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const currentHealth = systemHealthMonitor.getCurrentHealth();
        const healthHistory = systemHealthMonitor.getHealthHistory(50);
        
        if (format === 'html') {
            const initialHistory = healthHistory.slice(-50);
            const latest = initialHistory.length > 0 ? initialHistory[initialHistory.length - 1] : null;

            const bodyContent = `
                <div id="header" class="header status-${currentHealth.status}">
                    <h1>🏥 System Health Dashboard</h1>
                    <p>Status: <strong id="statusText">${currentHealth.status.toUpperCase()}</strong> | Last Update: <span id="lastUpdate">${currentHealth.lastUpdate || 'Never'}</span></p>
                </div>

                <div class="grid">
                    <div class="card">
                        <h3>💾 Process Memory (MB)</h3>
                        <canvas id="processMemChart"></canvas>
                    </div>
                    <div class="card">
                        <h3>🖥️ System Memory (GB)</h3>
                        <canvas id="systemMemChart"></canvas>
                    </div>
                    <div class="card">
                        <h3>⚡ CPU Usage (%)</h3>
                        <canvas id="cpuChart"></canvas>
                    </div>
                    <div class="card">
                        <h3>⚙️ Process Info</h3>
                        <table id="processInfoTable">
                            ${latest ? `
                            <tr><th>PID</th><td>${latest.process.pid}</td></tr>
                            <tr><th>Uptime</th><td>${latest.process.uptimeFormatted}</td></tr>
                            <tr><th>Node.js</th><td>${latest.process.version}</td></tr>
                            <tr><th>Platform</th><td>${latest.process.platform}</td></tr>
                            <tr><th>Architecture</th><td>${latest.process.arch}</td></tr>
                            <tr><th>Active Handles</th><td>${latest.process.activeHandles}</td></tr>
                            ` : '<tr><td>Loading...</td></tr>'}
                        </table>
                    </div>
                    <div class="card">
                        <h3>🌍 Environment</h3>
                        <table id="environmentInfoTable">
                            ${latest ? `
                            <tr><th>NODE_ENV</th><td>${latest.environment.nodeEnv}</td></tr>
                            <tr><th>Port</th><td>${latest.environment.port}</td></tr>
                            <tr><th>Puppeteer Cache</th><td>${latest.environment.puppeteerCacheDir || 'Default'}</td></tr>
                            ` : '<tr><td>Loading...</td></tr>'}
                        </table>
                    </div>
                    <div class="card">
                        <h3>💽 Disk Usage</h3>
                        <table id="diskUsageTable">
                            <thead><tr><th>Mount</th><th>Total</th><th>Used</th><th>Free</th><th>Usage %</th></tr></thead>
                            <tbody>
                            ${latest && latest.disk && latest.disk.length > 0 ? latest.disk.map(d => `
                                <tr>
                                    <td>${d.mount || d.drive}</td>
                                    <td>${d.total} GB</td>
                                    <td>${d.used} GB</td>
                                    <td>${d.available || d.free} GB</td>
                                    <td>${d.usagePercent}%</td>
                                </tr>
                            `).join('') : '<tr><td colspan="5">No disk data</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <div class="card">
                        <h3>📡 Network Info</h3>
                        <table id="networkInfoTable">
                            <thead><tr><th>Interface</th><th>IP</th><th>MAC</th><th>Family</th></tr></thead>
                            <tbody>
                            ${latest ? Object.entries(latest.network).map(([name, interfaces]) =>
                                interfaces.map(iface => `
                                <tr>
                                    <td>${name}</td>
                                    <td>${iface.address}</td>
                                    <td>${iface.mac}</td>
                                    <td>${iface.family}</td>
                                </tr>
                                `).join('')
                            ).join('') : '<tr><td colspan="4">No network data</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

            <script>
                const history = ${JSON.stringify(initialHistory)};

                function formatTime(ts) {
                    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }

                const processMemChart = new Chart(document.getElementById('processMemChart'), {
                    type: 'line',
                    data: {
                        labels: history.map(h => formatTime(h.timestamp)),
                        datasets: [{ label: 'Process MB', data: history.map(h => h.memory.used), borderColor: '#3498db', fill: false, tension: 0.1 }]
                    }
                });

                const systemMemChart = new Chart(document.getElementById('systemMemChart'), {
                    type: 'line',
                    data: {
                        labels: history.map(h => formatTime(h.timestamp)),
                        datasets: [{ label: 'System Used GB', data: history.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2)), borderColor: '#e67e22', fill: false, tension: 0.1 }]
                    }
                });

                const cpuChart = new Chart(document.getElementById('cpuChart'), {
                    type: 'line',
                    data: {
                        labels: history.map(h => formatTime(h.timestamp)),
                        datasets: [{ label: 'CPU %', data: history.map(h => h.system.cpuPercent), borderColor: '#2ecc71', fill: false, tension: 0.1 }]
                    }
                });

                async function updateCharts() {
                    try {
                        const res = await fetch('/metrics');
                        const data = await res.json();
                        const latestHistory = data.history.slice(-50);
                        const latest = latestHistory.length > 0 ? latestHistory[latestHistory.length - 1] : null;

                        if (!latest) return;

                        // Update charts
                        const labels = latestHistory.map(h => formatTime(h.timestamp));
                        processMemChart.data.labels = labels;
                        processMemChart.data.datasets[0].data = latestHistory.map(h => h.memory.used);
                        processMemChart.update('none');

                        systemMemChart.data.labels = labels;
                        systemMemChart.data.datasets[0].data = latestHistory.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2));
                        systemMemChart.update('none');

                        const cpuData = latestHistory.map(h => h.system.cpuPercent);
                        const cpuColor = cpuData[cpuData.length - 1] > 80 ? '#e74c3c' : cpuData[cpuData.length - 1] > 60 ? '#f39c12' : '#2ecc71';
                        cpuChart.data.labels = labels;
                        cpuChart.data.datasets[0].data = cpuData;
                        cpuChart.data.datasets[0].borderColor = cpuColor;
                        cpuChart.update('none');

                        // Update header
                        document.getElementById('statusText').textContent = latest.status?.toUpperCase() || 'UNKNOWN';
                        document.getElementById('lastUpdate').textContent = new Date(latest.timestamp).toLocaleString();
                        const header = document.getElementById('header');
                        header.className = 'header status-' + (latest.status || 'unknown');

                        // Update tables
                        document.getElementById('processInfoTable').innerHTML = \`
                            <tr><th>PID</th><td>\${latest.process.pid}</td></tr>
                            <tr><th>Uptime</th><td>\${latest.process.uptimeFormatted}</td></tr>
                            <tr><th>Node.js</th><td>\${latest.process.version}</td></tr>
                            <tr><th>Platform</th><td>\${latest.process.platform}</td></tr>
                            <tr><th>Architecture</th><td>\${latest.process.arch}</td></tr>
                            <tr><th>Active Handles</th><td>\${latest.process.activeHandles}</td></tr>
                        \`;
                        document.getElementById('environmentInfoTable').innerHTML = \`
                            <tr><th>NODE_ENV</th><td>\${latest.environment.nodeEnv}</td></tr>
                            <tr><th>Port</th><td>\${latest.environment.port}</td></tr>
                            <tr><th>Puppeteer Cache</th><td>\${latest.environment.puppeteerCacheDir || 'Default'}</td></tr>
                        \`;
                        document.getElementById('diskUsageTable').innerHTML = \`
                            <thead><tr><th>Mount</th><th>Total</th><th>Used</th><th>Free</th><th>Usage %</th></tr></thead>
                            <tbody>\${latest.disk.map(d => \`
                                <tr>
                                    <td>\${d.mount || d.drive}</td>
                                    <td>\${d.total} GB</td>
                                    <td>\${d.used} GB</td>
                                    <td>\${d.available || d.free} GB</td>
                                    <td>\${d.usagePercent}%</td>
                                </tr>
                            \`).join('')}</tbody>
                        \`;
                        document.getElementById('networkInfoTable').innerHTML = \`
                            <thead><tr><th>Interface</th><th>IP</th><th>MAC</th><th>Family</th></tr></thead>
                            <tbody>\${Object.entries(latest.network).map(([name, interfaces]) =>
                                interfaces.map(iface => \`
                                <tr>
                                    <td>\${name}</td>
                                    <td>\${iface.address}</td>
                                    <td>\${iface.mac}</td>
                                    <td>\${iface.family}</td>
                                </tr>
                                \`).join('')
                            ).join('')}</tbody>
                        \`;

                    } catch (err) {
                        console.error('Error updating charts:', err);
                    }
                }

                setInterval(updateCharts, 5000);
            </script>
            `;
            return res.send(generateDashboardHTML('System Health Dashboard', bodyContent));
        }
        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            health: currentHealth,
            history: healthHistory,
            helpText: 'Add ?format=html for web dashboard view'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
function generateDashboardHTML(title, content) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; color: #333; }
        .dashboard { max-width: 1600px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header h1 { margin: 0; font-size: 2em; }
        .header p { margin: 5px 0 0; font-size: 1.2em; opacity: 0.9; }
        .status-healthy { border-left: 8px solid #27ae60; }
        .status-warning { border-left: 8px solid #f39c12; }
        .status-critical { border-left: 8px solid #e74c3c; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 35px; }
        .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); }
        .card h3 { margin-top: 0; font-size: 1.5em; color: #2c3e50; border-bottom: 2px solid #f0f2f5; padding-bottom: 12px; }
        canvas { max-width: 100%; height: 280px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { text-align: left; padding: 14px 10px; border-bottom: 1px solid #eee; }
        th { font-size: 0.95em; color: #555; text-transform: uppercase; cursor: pointer; }
        td { font-family: 'Menlo', 'Consolas', monospace; font-size: 1em; }
        td:first-child { font-weight: bold; color: #000; }
        .log-entry { margin: 10px 0; padding: 15px; background: #fff; border-radius: 8px; border-left: 5px solid #555; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .log-error { border-left-color: #e74c3c; }
        .log-warn { border-left-color: #f39c12; }
        .log-info { border-left-color: #3498db; }
        .log-step { border-left-color: #27ae60; }
        .log-debug { border-left-color: #95a5a6; }
        .log-data { background: #ecf0f1; padding: 10px; margin-top: 10px; border-radius: 5px; font-size: 0.9em; overflow-x: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="dashboard">
        ${content}
    </div>
</body>
</html>`;
}

// Start the server on port 3000 (or any port you prefer)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}/ui`);
});