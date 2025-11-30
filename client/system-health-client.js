(function(global) {
    const SystemHealthClient = {
        config: {
            apiEndpoint: '/_system-health',
            refreshInterval: 2000,
            chartColors: {
                cpu: '#2ecc71',
                memory: '#3498db',
                network: '#9b59b6',
                gpu: '#f1c40f'
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
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 25px; background: #f4f6f8; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2 style="margin: 0; color: #2c3e50; font-size: 1.8em;">System Health</h2>
                        <span id="shm-status" style="padding: 8px 15px; border-radius: 6px; background: #ddd; font-size: 1em; font-weight: 600;">Connecting...</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 30px;">
                        <!-- CPU Chart -->
                        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 400px; display: flex; flex-direction: column;">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3em; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px;">CPU Usage (%)</h3>
                            <div style="flex-grow: 1; position: relative;">
                                <canvas id="shm-cpu-chart"></canvas>
                            </div>
                        </div>

                        <!-- Memory Chart -->
                        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 400px; display: flex; flex-direction: column;">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3em; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px;">Memory Usage (GB)</h3>
                            <div style="flex-grow: 1; position: relative;">
                                <canvas id="shm-mem-chart"></canvas>
                            </div>
                        </div>

                        <!-- Network Chart -->
                        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 400px; display: flex; flex-direction: column;">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3em; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px;">Network Traffic (KB/s)</h3>
                            <div style="flex-grow: 1; position: relative;">
                                <canvas id="shm-net-chart"></canvas>
                            </div>
                        </div>

                        <!-- GPU / Info Chart -->
                        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 400px; display: flex; flex-direction: column;">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3em; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px;">GPU & System Info</h3>
                            <div id="shm-info-content" style="font-size: 1.1em; line-height: 1.8; color: #333; flex-grow: 1;">
                                Loading...
                            </div>
                            <!-- Placeholder for GPU Chart if we ever get real usage data -->
                            <!-- <div style="height: 150px; margin-top: 10px; border: 1px dashed #ddd; display: flex; align-items: center; justify-content: center; color: #aaa;">GPU Chart Placeholder</div> -->
                        </div>

                         <!-- Disk Panel -->
                        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); grid-column: 1 / -1;">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3em; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px;">Disk Usage</h3>
                            <div id="shm-disk-content" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
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
            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { labels: { font: { size: 14 } } }
                },
                scales: {
                    x: { ticks: { font: { size: 12 } } },
                    y: { ticks: { font: { size: 12 } }, beginAtZero: true }
                }
            };

            // CPU Chart
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
                    ...commonOptions,
                    scales: { ...commonOptions.scales, y: { beginAtZero: true, max: 100 } }
                }
            });

            // Memory Chart
            const ctxMem = document.getElementById('shm-mem-chart').getContext('2d');
            this.charts.memory = new Chart(ctxMem, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Used Memory (GB)',
                        data: [],
                        borderColor: this.config.chartColors.memory,
                        tension: 0.3,
                        fill: true,
                        backgroundColor: this.addAlpha(this.config.chartColors.memory, 0.1)
                    }]
                },
                options: commonOptions
            });

            // Network Chart
            const ctxNet = document.getElementById('shm-net-chart').getContext('2d');
            this.charts.network = new Chart(ctxNet, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Download (KB/s)',
                            data: [],
                            borderColor: '#3498db',
                            tension: 0.3,
                            fill: false
                        },
                        {
                            label: 'Upload (KB/s)',
                            data: [],
                            borderColor: '#e67e22',
                            tension: 0.3,
                            fill: false
                        }
                    ]
                },
                options: commonOptions
            });
        },

        startPolling: function() {
            const fetchMetrics = async () => {
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
                    const statusEl = document.getElementById('shm-status');
                    if(statusEl) {
                        statusEl.innerText = 'Offline';
                        statusEl.style.background = '#e74c3c';
                        statusEl.style.color = 'white';
                    }
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
            const metrics = data.data || data;
            const history = data.history || [];

            // Update Status
            const statusEl = document.getElementById('shm-status');
            if(statusEl) {
                statusEl.innerText = 'Live';
                statusEl.style.background = '#27ae60';
                statusEl.style.color = 'white';
            }

            // Update Info
            const infoEl = document.getElementById('shm-info-content');
            if (metrics.system && infoEl) {
                infoEl.innerHTML = `
                    <div style="margin-bottom: 10px;"><strong>OS:</strong> ${metrics.system.platform} ${metrics.system.osInfo?.raw || ''}</div>
                    <div style="margin-bottom: 10px;"><strong>Hostname:</strong> ${metrics.system.hostname}</div>
                    <div style="margin-bottom: 10px;"><strong>Uptime:</strong> ${metrics.system.uptimeFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>CPU Model:</strong> ${metrics.system.cpuModel}</div>
                    <div style="margin-bottom: 10px;"><strong>Cores:</strong> ${metrics.system.cpuCount}</div>
                    <div style="margin-bottom: 10px;"><strong>GPU:</strong> ${metrics.system.gpu ? metrics.system.gpu.join(', ') : 'N/A'}</div>
                `;
            }

            // Update Disk
            const diskEl = document.getElementById('shm-disk-content');
            if (metrics.disk && metrics.disk.length && diskEl) {
                diskEl.innerHTML = metrics.disk.map(d => `
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                            <strong style="font-size:1.1em;">${d.mount || d.drive}</strong>
                            <span style="color:#666;">${d.usagePercent}% Used</span>
                        </div>
                        <div style="background:#e0e0e0; height:10px; width:100%; border-radius:5px; overflow:hidden;">
                            <div style="background:${d.usagePercent > 80 ? '#e74c3c' : '#2ecc71'}; width:${d.usagePercent}%; height:100%;"></div>
                        </div>
                        <div style="margin-top: 8px; font-size: 0.9em; color: #777;">
                            ${d.used}GB used of ${d.total}GB
                        </div>
                    </div>
                `).join('');
            }

            // Update Charts
            const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());

            // CPU
            if (this.charts.cpu) {
                this.charts.cpu.data.labels = labels;
                this.charts.cpu.data.datasets[0].data = history.map(h => h.system.cpuPercent);
                this.charts.cpu.update('none');
            }

            // Memory
            if (this.charts.memory) {
                this.charts.memory.data.labels = labels;
                const memData = history.map(h => {
                    // Try to get system used memory if available, else heap
                    if (h.memory.systemTotal) {
                        return (h.memory.systemTotal - h.memory.systemFree).toFixed(2);
                    }
                    return (h.memory.heapUsed / 1024).toFixed(2);
                });
                this.charts.memory.data.datasets[0].data = memData;
                if (metrics.memory && metrics.memory.systemTotal) {
                     this.charts.memory.options.scales.y.max = metrics.memory.systemTotal;
                }
                this.charts.memory.update('none');
            }

            // Network
            if (this.charts.network) {
                this.charts.network.data.labels = labels;
                // Convert bytes/sec to KB/s
                const dlData = history.map(h => (h.network.speed ? (h.network.speed.rx_sec / 1024).toFixed(1) : 0));
                const ulData = history.map(h => (h.network.speed ? (h.network.speed.tx_sec / 1024).toFixed(1) : 0));

                this.charts.network.data.datasets[0].data = dlData;
                this.charts.network.data.datasets[1].data = ulData;
                this.charts.network.update('none');
            }
        },

        addAlpha: function(color, opacity) {
            if (color.startsWith('#')) {
                let r = parseInt(color.slice(1, 3), 16);
                let g = parseInt(color.slice(3, 5), 16);
                let b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            return color;
        }
    };

    global.SystemHealthClient = SystemHealthClient;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SystemHealthClient;
    }
})(typeof window !== 'undefined' ? window : this);
