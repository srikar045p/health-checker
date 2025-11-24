/**
 * System Health Monitor
 * Comprehensive system monitoring with detailed file logging
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const { eventLoopUtilization } = performance;

// Platform specific monitors
const windowsMonitor = require('./lib/platform/windows');
const linuxMonitor = require('./lib/platform/linux');
const macosMonitor = require('./lib/platform/macos');

class SystemHealthMonitor {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.healthHistory = [];
        this.maxHistorySize = 1000;
        this.monitoringInterval = null;
        this.alerts = [];
        this.prevElu = null; // Previous event loop utilization
        
        // Select platform monitor
        switch (process.platform) {
            case 'win32':
                this.platformMonitor = windowsMonitor;
                break;
            case 'linux':
                this.platformMonitor = linuxMonitor;
                break;
            case 'darwin':
                this.platformMonitor = macosMonitor;
                break;
            default:
                console.warn('⚠️ Unsupported platform for advanced metrics, falling back to basic Node.js metrics.');
                this.platformMonitor = linuxMonitor; // Fallback to linux-like generic commands or just fail gracefully
        }
    }

    /**
     * Initialize logging
     */
    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('❌ Failed to create logs directory:', error);
        }
    }

    /**
     * Start continuous system monitoring
     * @param {number} intervalMs - Interval in milliseconds (default 4000)
     */
    start(intervalMs = 4000) {
        if (this.monitoringInterval) return;

        this.initializeLogDirectory();

        // Initial collection
        this.collectHealthMetrics();

        this.monitoringInterval = setInterval(() => {
            this.collectHealthMetrics();
        }, intervalMs);

        console.log('🔄 System Health Monitor started');
    }

    /**
     * Stop continuous monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('⏹️ System Health Monitor stopped');
        }
    }

    /**
     * Collect comprehensive health metrics and store in history
     */
    async collectHealthMetrics() {
        const timestamp = new Date().toISOString();
        const metrics = await this.getDetailedHealthMetrics();
        
        // Add to history
        this.healthHistory.push({
            timestamp,
            ...metrics
        });

        // Rotate history if needed
        if (this.healthHistory.length > this.maxHistorySize) {
            this.healthHistory.shift();
        }

        // Check for alerts
        this.checkHealthAlerts(metrics);

        // Log to file (optional, maybe make configurable?)
        // For now, we keep it but handle errors silently if dir not exists
        await this.logHealthMetrics(timestamp, metrics);
    }

    /**
     * Get detailed system health metrics combining Node.js and OS Command Line Tools
     */
    async getDetailedHealthMetrics() {
        const uptime = process.uptime();
        const systemUptime = os.uptime();
        
        // 1. Get OS-specific metrics via CLI tools (Requirements)
        const [diskUsage, osCpu, osMem, osGpu, osInfo] = await Promise.all([
            this.platformMonitor.getDiskUsage(),
            this.platformMonitor.getCPUInfo(),
            this.platformMonitor.getMemoryInfo(),
            this.platformMonitor.getGPUInfo(),
            this.platformMonitor.getOSInfo()
        ]);

        // 2. Fallback / Complementary Node.js Metrics
        const elu = this.calculateEventLoopUtilization();
        const memoryUsage = process.memoryUsage();

        // Use CLI CPU info if available, else Node.js fallback
        let cpuPercent = osCpu;
        if (cpuPercent === null) {
            cpuPercent = await this.calculateCPUPercentAccurate();
        }

        return {
            // Process metrics (Node.js specific)
            process: {
                uptime,
                uptimeFormatted: this.formatUptime(uptime),
                pid: process.pid,
                version: process.version,
                platform: process.platform,
                arch: process.arch,
                activeHandles: process._getActiveHandles ? process._getActiveHandles().length : 0,
                eventLoopUtilization: {
                    percent: elu.percent
                },
            },
            
            // Memory metrics
            memory: {
                // Node Process Memory
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memoryUsage.rss / 1024 / 1024),

                // System Memory (From CLI if available, else Node os)
                systemFree: osMem ? osMem.free : Math.round(os.freemem() / 1024 / 1024),
                systemTotal: osMem ? osMem.total : Math.round(os.totalmem() / 1024 / 1024),
                usagePercent: osMem && osMem.total ? Math.round(((osMem.total - osMem.free) / osMem.total) * 100) : 0
            },

            // System metrics
            system: {
                uptime: systemUptime,
                uptimeFormatted: this.formatUptime(systemUptime),
                loadAverage: os.loadavg(),
                cpuCount: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || "Unknown",
                cpuPercent: cpuPercent, // From CLI or Node
                hostname: os.hostname(),
                platform: os.platform(),
                osInfo: osInfo,
                gpu: osGpu
            },

            // Disk usage (From CLI)
            disk: diskUsage,

            // Network info (Node.js API is excellent for this)
            network: this.formatNetworkInterfaces(os.networkInterfaces()),
        };
    }

    calculateEventLoopUtilization() {
        if (!this.prevElu) {
            this.prevElu = eventLoopUtilization();
            return { percent: 0 };
        }
        const current = eventLoopUtilization();
        const delta = eventLoopUtilization(current, this.prevElu);
        this.prevElu = current;
        return {
            percent: Math.round((delta.utilization || 0) * 10000) / 100
        };
    }

    async calculateCPUPercentAccurate() {
        const startTime = performance.now();
        const startUsage = process.cpuUsage();
        await new Promise(res => setTimeout(res, 100));
        const elapTime = performance.now() - startTime;
        const elapUsage = process.cpuUsage(startUsage);
        const elapUserMS = elapUsage.user / 1000;
        const elapSystMS = elapUsage.system / 1000;
        const cpuPercent = ((elapUserMS + elapSystMS) / (elapTime * os.cpus().length)) * 100;
        return Math.round(cpuPercent * 100) / 100;
    }

    formatNetworkInterfaces(interfaces) {
        const formatted = {};
        for (const [name, addresses] of Object.entries(interfaces)) {
            if (!Array.isArray(addresses)) continue;
            formatted[name] = addresses
                .filter(addr => !addr.internal)
                .map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    mac: addr.mac
                }));
        }
        return formatted;
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    }

    checkHealthAlerts(metrics) {
        const alerts = [];
        // Alert logic...
        if (metrics.memory.usagePercent > 90) {
            alerts.push({ type: 'memory', level: 'warning', message: `High system memory: ${metrics.memory.usagePercent}%` });
        }
        this.alerts = alerts;
    }

    async logHealthMetrics(timestamp, metrics) {
        // Simplified logging for this version
        const logFile = path.join(this.logDir, `health-${this.getDateString()}.log`);
        const logEntry = JSON.stringify({ timestamp, metrics }) + '\n';
        try {
            await fs.appendFile(logFile, logEntry, 'utf8');
        } catch (e) { /* ignore */ }
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    getCurrentHealth() {
        const latest = this.healthHistory[this.healthHistory.length - 1];
        if (!latest) return null;
        return {
            status: this.alerts.length > 0 ? 'warning' : 'healthy',
            alerts: this.alerts,
            data: latest
        };
    }

    getHealthHistory(limit = 50) {
        return this.healthHistory.slice(-limit);
    }

    /**
     * Generate a complete HTML page with embedded client script
     * @param {string} apiEndpoint - The endpoint where metrics are served
     * @returns {string} HTML content
     */
    getSystemHealthUI(apiEndpoint = '/_system-health') {
        // Read client script synchronously since this is usually called once or rarely
        let clientScript = '';
        try {
            clientScript = fsSync.readFileSync(path.join(__dirname, 'client/system-health-client.js'), 'utf8');
        } catch (e) {
            console.error('Failed to read client script', e);
            clientScript = '// Error loading client script';
        }

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Health Dashboard</title>
</head>
<body style="margin: 0; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
        <div id="health-dashboard-container"></div>
    </div>
    <script>
        ${clientScript}
    </script>
    <script>
        window.addEventListener('load', function() {
            if (typeof SystemHealthClient !== 'undefined') {
                SystemHealthClient.initMonitor('health-dashboard-container', {
                    apiEndpoint: '${apiEndpoint}'
                });
            } else {
                document.body.innerHTML = '<h1>Error: System Health Client failed to load.</h1>';
            }
        });
    </script>
</body>
</html>`;
    }
}

// Export Singleton
const monitor = new SystemHealthMonitor();
module.exports = monitor;
