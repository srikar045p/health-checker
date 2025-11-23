(function(global) {
    const SystemHealthClient = {
        config: {
            apiEndpoint: '/_system-health',
            refreshInterval: 2000,
            chartColors: {
                cpu: '#2ecc71',
                memory: '#3498db',
                disk: '#9b59b6'
            }
        },
        charts: {},
        intervalId: null,

        initMonitor: function(containerId, options = {}) {
            // Merge options
            this.config = { ...this.config, ...options };

            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`SystemHealthMonitor: Container #${containerId} not found.`);
                return;
            }

            // Load Chart.js if needed
            if (typeof Chart === 'undefined') {
                this.loadChartJS(() => this.renderDashboard(container));
            } else {
                this.renderDashboard(container);
            }
        },

        loadChartJS: function(callback) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = callback;
            document.head.appendChild(script);
        },

        renderDashboard: function(container) {
            container.innerHTML = `
                <div style="font-family: sans-serif; padding: 20px; background: #f4f6f8; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0; color: #2c3e50;">System Health</h2>
                        <span id="shm-status" style="padding: 5px 10px; border-radius: 4px; background: #ddd; font-size: 0.9em;">Connecting...</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                        <!-- CPU Chart -->
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <h3 style="margin: 0 0 10px 0; font-size: 1.1em; color: #555;">CPU Usage (%)</h3>
                            <canvas id="shm-cpu-chart"></canvas>
                        </div>

                        <!-- Memory Chart -->
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <h3 style="margin: 0 0 10px 0; font-size: 1.1em; color: #555;">Memory Usage (GB)</h3>
                            <canvas id="shm-mem-chart"></canvas>
                        </div>

                        <!-- Info Panel -->
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <h3 style="margin: 0 0 10px 0; font-size: 1.1em; color: #555;">System Info</h3>
                            <div id="shm-info-content" style="font-size: 0.9em; line-height: 1.6; color: #333;">
                                Loading...
                            </div>
                        </div>
                         <!-- Disk Panel -->
                        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <h3 style="margin: 0 0 10px 0; font-size: 1.1em; color: #555;">Disk Usage</h3>
                            <div id="shm-disk-content" style="font-size: 0.9em; line-height: 1.6; color: #333;">
                                Loading...
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.setupCharts();
            this.startPolling();
        },

        setupCharts: function() {
            const ctxCpu = document.getElementById('shm-cpu-chart').getContext('2d');
            this.charts.cpu = new Chart(ctxCpu, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'CPU %',
                        data: [],
                        borderColor: this.config.chartColors.cpu,
                        tension: 0.3,
                        fill: true,
                        backgroundColor: this.addAlpha(this.config.chartColors.cpu, 0.1)
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true, max: 100 } },
                    animation: false
                }
            });

            const ctxMem = document.getElementById('shm-mem-chart').getContext('2d');
            this.charts.memory = new Chart(ctxMem, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Used Memory',
                        data: [],
                        borderColor: this.config.chartColors.memory,
                        tension: 0.3,
                        fill: true,
                         backgroundColor: this.addAlpha(this.config.chartColors.memory, 0.1)
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true } },
                    animation: false
                }
            });
        },

        startPolling: function() {
            const fetchMetrics = async () => {
                // Check if container still exists
                if (!document.getElementById('shm-cpu-chart')) {
                    this.stop();
                    return;
                }

                try {
                    const res = await fetch(this.config.apiEndpoint);
                    if (!res.ok) throw new Error('API Error');
                    const data = await res.json();

                    this.updateDashboard(data);
                } catch (err) {
                    console.warn('System Health Monitor: Fetch error', err);
                    document.getElementById('shm-status').innerText = 'Offline';
                    document.getElementById('shm-status').style.background = '#e74c3c';
                    document.getElementById('shm-status').style.color = 'white';
                }
            };

            fetchMetrics();
            this.intervalId = setInterval(fetchMetrics, this.config.refreshInterval);
        },

        stop: function() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },

        updateDashboard: function(data) {
            // Expecting data to contain { currentHealth: { data: ... }, history: [...] } or just the latest object
            // Based on our backend, `getCurrentHealth()` returns { data: latest } and we also have `getHealthHistory`

            // Let's assume the API returns the format from system-health-monitor.js `getCurrentHealth` + history
            // We might need to adjust the backend to return exactly what we need in one go.

            const metrics = data.data || data; // Handle different potential structures
            const history = data.history || [];

            // Update Status
            const statusEl = document.getElementById('shm-status');
            statusEl.innerText = 'Live';
            statusEl.style.background = '#27ae60';
            statusEl.style.color = 'white';

            // Update Info
            const infoEl = document.getElementById('shm-info-content');
            if (metrics.system) {
                infoEl.innerHTML = `
                    <strong>OS:</strong> ${metrics.system.platform} ${metrics.system.osInfo?.raw || ''}<br>
                    <strong>Hostname:</strong> ${metrics.system.hostname}<br>
                    <strong>Uptime:</strong> ${metrics.system.uptimeFormatted}<br>
                    <strong>CPU Model:</strong> ${metrics.system.cpuModel} (${metrics.system.cpuCount} cores)<br>
                    <strong>GPU:</strong> ${metrics.system.gpu ? metrics.system.gpu.join(', ') : 'N/A'}<br>
                `;
            }

            // Update Disk
            const diskEl = document.getElementById('shm-disk-content');
            if (metrics.disk && metrics.disk.length) {
                diskEl.innerHTML = metrics.disk.map(d => `
                    <div style="margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                        <strong>${d.mount || d.drive}:</strong> ${d.usagePercent}% used (${d.used}GB / ${d.total}GB)
                        <div style="background:#eee; height:5px; width:100%; margin-top:3px; border-radius:2px;">
                            <div style="background:${d.usagePercent > 80 ? '#e74c3c' : '#2ecc71'}; width:${d.usagePercent}%; height:100%; border-radius:2px;"></div>
                        </div>
                    </div>
                `).join('');
            } else {
                diskEl.innerText = 'No disk info available';
            }

            // Update Charts
            // If history is provided, we can repopulate completely, otherwise we push
            const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());
            const cpuData = history.map(h => h.system.cpuPercent);
            const memData = history.map(h => h.memory.systemTotal - h.memory.systemFree); // Used system memory

            if (this.charts.cpu) {
                this.charts.cpu.data.labels = labels;
                this.charts.cpu.data.datasets[0].data = cpuData;
                this.charts.cpu.update('none'); // 'none' mode for performance
            }

            if (this.charts.memory) {
                this.charts.memory.data.labels = labels;
                this.charts.memory.data.datasets[0].data = memData;
                // Update Max dynamically if needed
                if (metrics.memory && metrics.memory.systemTotal) {
                     this.charts.memory.options.scales.y.max = metrics.memory.systemTotal;
                }
                this.charts.memory.update('none');
            }
        },

        addAlpha: function(color, opacity) {
            // Simple hex to rgba conversion
            if (color.startsWith('#')) {
                let r = parseInt(color.slice(1, 3), 16);
                let g = parseInt(color.slice(3, 5), 16);
                let b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            return color;
        }
    };

    // Export to global scope
    global.SystemHealthClient = SystemHealthClient;

    // Also support CommonJS/ES Module environments if bundled
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SystemHealthClient;
    }
})(typeof window !== 'undefined' ? window : this);
