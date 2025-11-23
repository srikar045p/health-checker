// Simple client-side router
const router = {
    routes: {},
    init() {
        window.addEventListener('hashchange', () => this.loadRoute());
        this.loadRoute();
    },
    addRoute(name, handler) {
        this.routes[name] = handler;
    },
    loadRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';

        // Update active nav link
        document.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${hash}`) {
                link.classList.add('active');
            }
        });

        const handler = this.routes[hash];
        if (handler) {
            handler();
        } else {
            document.getElementById('app-root').innerHTML = '<h1>404 - Page not found</h1>';
        }
    }
};

async function renderHealth() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="health-page">
            <div class="card">
                <div id="header" class="header">
                    <h1>🏥 System Health Dashboard</h1>
                    <p>Status: <strong id="statusText">...</strong> | Last Update: <span id="lastUpdate">...</span></p>
                </div>
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
            </div>
            <div id="health-table-container">
                <!-- Details will be rendered here -->
            </div>
        </div>
    `;

    let healthInterval;
    let charts = {};

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function updateHealthData(data) {
        if (!data || !data.health || !data.history) {
            console.error("Invalid data structure for update.");
            return;
        }

        const { health, history } = data;
        const initialHistory = history.slice(-50);
        const latest = initialHistory.length > 0 ? initialHistory[initialHistory.length - 1] : {};

        // Update header using the 'health' object
        document.getElementById('statusText').textContent = health.status?.toUpperCase() ?? 'UNKNOWN';
        const lastUpdateTimestamp = health.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A';
        document.getElementById('lastUpdate').textContent = lastUpdateTimestamp;
        const header = document.getElementById('header');
        header.className = 'header status-' + (health.status || 'unknown');

        // Update charts
        const labels = initialHistory.map(h => formatTime(h.timestamp));
        charts.processMem.data.labels = labels;
        charts.processMem.data.datasets[0].data = initialHistory.map(h => h.memory.used);
        charts.processMem.update('none');

        charts.systemMem.data.labels = labels;
        charts.systemMem.data.datasets[0].data = initialHistory.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2));
        charts.systemMem.update('none');

        charts.cpu.data.labels = labels;
        charts.cpu.data.datasets[0].data = initialHistory.map(h => h.system.cpuPercent);
        charts.cpu.update('none');

        // Update tables
        document.getElementById('health-table-container').innerHTML = `
            <div class="grid details-grid">
                <div class="card">
                    <h3>⚙️ Process Info</h3>
                    <table id="processInfoTable">
                        <tr><th>PID</th><td>${latest.process?.pid ?? 'N/A'}</td></tr>
                        <tr><th>Uptime</th><td>${latest.process?.uptimeFormatted ?? 'N/A'}</td></tr>
                        <tr><th>Node.js</th><td>${latest.process?.version ?? 'N/A'}</td></tr>
                        <tr><th>Platform</th><td>${latest.process?.platform ?? 'N/A'}</td></tr>
                        <tr><th>Architecture</th><td>${latest.process?.arch ?? 'N/A'}</td></tr>
                        <tr><th>Active Handles</th><td>${latest.process?.activeHandles ?? 'N/A'}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>🌍 Environment</h3>
                    <table id="environmentInfoTable">
                        <tr><th>NODE_ENV</th><td>${latest.environment?.nodeEnv || 'development'}</td></tr>
                        <tr><th>Port</th><td>${latest.environment?.port ?? 'N/A'}</td></tr>
                        <tr><th>Puppeteer Cache</th><td>${latest.environment?.puppeteerCacheDir || 'Default'}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>💽 Disk Usage</h3>
                    <table id="diskUsageTable">
                        <thead><tr><th>Mount</th><th>Total</th><th>Used</th><th>Free</th><th>Usage %</th></tr></thead>
                        <tbody>
                        ${latest.disk && latest.disk.length > 0 ? latest.disk.map(d => `
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
                        ${latest.network ? Object.entries(latest.network).map(([name, interfaces]) =>
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
        `;
    }

    async function fetchInitialData() {
        try {
            const response = await fetch('/api/system-health?format=json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (!data || !data.health || !data.history) {
                throw new Error("Invalid data structure received from API.");
            }

            const initialHistory = data.history.slice(-50);

            charts.processMem = new Chart(document.getElementById('processMemChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'Process MB', data: initialHistory.map(h => h.memory.used), borderColor: '#3498db', fill: false, tension: 0.1 }]
                }
            });

            charts.systemMem = new Chart(document.getElementById('systemMemChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'System Used GB', data: initialHistory.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2)), borderColor: '#e67e22', fill: false, tension: 0.1 }]
                }
            });

            charts.cpu = new Chart(document.getElementById('cpuChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'CPU %', data: initialHistory.map(h => h.system.cpuPercent), borderColor: '#2ecc71', fill: false, tension: 0.1 }]
                }
            });

            updateHealthData(data);

            healthInterval = setInterval(async () => {
                const response = await fetch('/api/system-health?format=json');
                const data = await response.json();
                updateHealthData(data);
            }, 15000);

        } catch (error) {
            console.error('Error fetching or rendering system health:', error);
            appRoot.innerHTML = `<h2>Error loading system health.</h2><p>${error.message}</p>`;
        }
    }

    // Clear previous interval if it exists
    if (window.healthInterval) {
        clearInterval(window.healthInterval);
    }
    fetchInitialData();
    window.healthInterval = healthInterval;
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    router.addRoute('health', renderHealth);
    router.init();

    setInterval(() => router.loadRoute(), 90000); // Update every 90 seconds
});
