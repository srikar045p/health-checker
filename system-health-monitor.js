/**
 * System Health Monitor
 * Comprehensive system monitoring with detailed file logging
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

const { exec } = require('child_process');
const { performance } = require('perf_hooks');
const { eventLoopUtilization } = performance;
class SystemHealthMonitor {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.healthHistory = [];
        this.maxHistorySize = 1000;
        this.monitoringInterval = null;
        this.alerts = [];
        this.prevElu = null; // Previous event loop utilization
        
        // Create logs directory if it doesn't exist
        this.initializeLogDirectory();
        
        // Prime the pump for initial metrics.
        setTimeout(() => this.collectHealthMetrics(), 100);

        // Start continuous monitoring
        this.startContinuousMonitoring();
    }

    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            console.log('📁 System health logs directory initialized');
        } catch (error) {
            console.error('❌ Failed to create logs directory:', error);
        }
    }

    /**
     * Start continuous system monitoring
     */
    startContinuousMonitoring() {
        // Monitor every 4 seconds
        this.monitoringInterval = setInterval(() => {
            this.collectHealthMetrics();
        }, 4000);

        console.log('🔄 Continuous system monitoring started');
    }

    /**
     * Stop continuous monitoring
     */
    stopContinuousMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('⏹️ Continuous system monitoring stopped');
        }
    }

    /**
     * Collect comprehensive health metrics
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

        // Log to file
        await this.logHealthMetrics(timestamp, metrics);
    }

    /**
     * Get detailed system health metrics
     */
    async getDetailedHealthMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        const systemUptime = os.uptime();
        
        // Calculate CPU percentage (approximation)
        // const cpuPercent = this.calculateCPUPercent(cpuUsage);
        const cpuPercent = await this.calculateCPUPercentAccurate();

        // Disk usage
        const diskUsage = await this.getDiskUsage();

        // Network info
        const networkInterfaces = os.networkInterfaces();

        // Load averages (Unix-like systems)
        const loadAvg = os.loadavg();
const elu = await this.calculateEventLoopUtilization();

        return {
            // Process metrics
            process: {
            startTime: new Date(Date.now() - uptime * 1000),
             uptime,
                uptimeFormatted: this.formatUptime(uptime),
                pid: process.pid,
                version: process.version,
                platform: process.platform,
                arch: process.arch,
             activeHandles: process._getActiveHandles().length,
            //  eventLoopUtilization: eventLoopUtilization(),
            eventLoopUtilization: {
                percent: elu.percent,
                raw: elu.raw
            },
            },
            
            // Memory metrics
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                external: Math.round(memoryUsage.external / 1024 / 1024), // MB
                arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024), // MB
                usagePercent: Math.round(
               (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
             ),             
            },

            // System metrics
            system: {
                totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
                freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
                uptime: systemUptime,
                uptimeFormatted: this.formatUptime(systemUptime),
                loadAverage: loadAvg,
                cpuCount: Array.isArray(os.cpus()) ? os.cpus().length : 0,
                cpuModel: os.cpus()[0]?.model || "Unknown",
                cpuPercent,
                hostname: os.hostname(),
                platform: os.platform(),
                release: os.release()
            },

            // Disk usage
            disk: diskUsage,

            // Network interfaces
            network: this.formatNetworkInterfaces(networkInterfaces),

            // Environment
            environment: {
                nodeEnv: process.env.NODE_ENV || "development",
                puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR,
                renderEnv: !!process.env.RENDER,
                port: process.env.PORT || 3000
            }
        };
    }
async calculateEventLoopUtilization() {
    if (!this.prevElu) {
        this.prevElu = eventLoopUtilization();
        return { raw: this.prevElu, percent: 0 };
    }
    const current = eventLoopUtilization();
    const delta = eventLoopUtilization(current, this.prevElu); // difference since last call
    this.prevElu = current;
    return {
        raw: current,
        percent: Math.round((delta.utilization || 0) * 10000) / 100 // percent
    };
}
    /**
     * Calculate approximate CPU usage percentage
     */
    calculateCPUPercent(cpuUsage) {
        if (!this.lastCPUUsage) {
            this.lastCPUUsage = cpuUsage;
            return 0;
        }

        const userDiff = cpuUsage.user - this.lastCPUUsage.user;
        const systemDiff = cpuUsage.system - this.lastCPUUsage.system;
        const totalDiff = userDiff + systemDiff;

        // Convert microseconds to percentage (rough approximation)
        const percent = Math.min(100, Math.round((totalDiff / 1000000) * 100 / 30)); // 30 second interval
        
        this.lastCPUUsage = cpuUsage;
        return percent;
    }

    /**
     * Accurate CPU usage calculation over 100ms
     */
    async calculateCPUPercentAccurate() {
        const startTime = performance.now();
        const startUsage = process.cpuUsage();
        await new Promise(res => setTimeout(res, 100)); // wait 100ms
        const elapTime = performance.now() - startTime;
        const elapUsage = process.cpuUsage(startUsage);
        const elapUserMS = elapUsage.user / 1000;
        const elapSystMS = elapUsage.system / 1000;
        const cpuPercent = ((elapUserMS + elapSystMS) / (elapTime * os.cpus().length)) * 100;
        return Math.round(cpuPercent * 100) / 100;
    }
    /**
     * Get disk usage for root path (cross-platform)
     */
    async getDiskUsage() {
        return new Promise((resolve) => {
            if (process.platform === 'win32') {
                // Windows: use 'wmic'
                exec('wmic logicaldisk get size,freespace,caption', (err, stdout) => {
                    if (err) return resolve({ error: err.message });
                    const lines = stdout.trim().split('\n').slice(1);
                    const disks = lines.map(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length < 3) return null;
                        const [caption, free, size] = parts;
                        const totalGB = size ? parseFloat((size / 1024 / 1024 / 1024).toFixed(2)) : null;
                        const freeGB = free ? parseFloat((free / 1024 / 1024 / 1024).toFixed(2)) : null;
                        const usedGB = (size && free) ? parseFloat(((size - free) / 1024 / 1024 / 1024).toFixed(2)) : null;
                        return {
                            drive: caption,
                            total: totalGB,
                            free: freeGB,
                            used: usedGB,
                            usagePercent: (size && free) ? Math.round(((size - free) / size) * 100) : null
                        };
                    }).filter(Boolean);
                    resolve(disks);
                });
            } else {
                // Linux / macOS: use 'df -k' (sizes are in KB)
                exec('df -k --output=target,size,used,avail,pcent -x tmpfs -x devtmpfs', (err, stdout) => {
                    if (err) return resolve({ error: err.message });
                    const lines = stdout.trim().split('\n').slice(1);
                    const disks = lines.map(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length < 5) return null;
                        const [mount, size, used, avail, pcent] = parts;
                        return {
                            mount,
                            total: parseFloat((size / 1024 / 1024).toFixed(2)), // KB to GB
                            used: parseFloat((used / 1024 / 1024).toFixed(2)), // KB to GB
                            available: parseFloat((avail / 1024 / 1024).toFixed(2)), // KB to GB
                            usagePercent: parseInt(pcent)
                        };
                    }).filter(Boolean);
                    resolve(disks);
                });
            }
        });
    }

    /**
     * Format network interfaces for logging
     */
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

    /**
     * Format uptime in human-readable format
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    }

    /**
     * Check for health alerts
     */
    checkHealthAlerts(metrics) {
        const alerts = [];

        // Memory usage alert
        if (metrics.memory.usagePercent > 85) {
            alerts.push({
                type: 'memory',
                level: 'warning',
                message: `High memory usage: ${metrics.memory.usagePercent}%`,
                value: metrics.memory.usagePercent
            });
        }

        // System memory alert
        const systemMemoryUsage = ((metrics.system.totalMemory - metrics.system.freeMemory) / metrics.system.totalMemory) * 100;
        if (systemMemoryUsage > 90) {
            alerts.push({
                type: 'system_memory',
                level: 'critical',
                message: `Critical system memory usage: ${systemMemoryUsage.toFixed(1)}%`,
                value: systemMemoryUsage
            });
        }

        // Load average alert (Unix-like systems)
        if (metrics.system.loadAverage[0] > metrics.system.cpuCount * 2) {
            alerts.push({
                type: 'load',
                level: 'warning',
                message: `High load average: ${metrics.system.loadAverage[0].toFixed(2)}`,
                value: metrics.system.loadAverage[0]
            });
        }

        // Update alerts
        this.alerts = alerts;

        // Log critical alerts immediately
        if (alerts.some(alert => alert.level === 'critical')) {
            this.logCriticalAlert(alerts.filter(alert => alert.level === 'critical'));
        }
    }

    /**
     * Log health metrics to file
     */
    async logHealthMetrics(timestamp, metrics) {
        const logEntry = {
            timestamp,
            metrics,
            alerts: this.alerts
        };

        const logFile = path.join(this.logDir, `health-${this.getDateString()}.log`);
        const logLine = JSON.stringify(logEntry) + '\n';

        try {
            await fs.appendFile(logFile, logLine, 'utf8');
        } catch (error) {
            console.error('❌ Failed to write health log:', error);
        }
    }

    /**
     * Log critical alerts
     */
    async logCriticalAlert(alerts) {
        const alertFile = path.join(this.logDir, 'critical-alerts.log');
        const alertEntry = {
            timestamp: new Date().toISOString(),
            alerts
        };

        try {
            await fs.appendFile(alertFile, JSON.stringify(alertEntry) + '\n', 'utf8');
            console.warn('🚨 Critical system alert logged:', alerts);
        } catch (error) {
            console.error('❌ Failed to write critical alert:', error);
        }
    }

    /**
     * Get date string for log file naming
     */
    getDateString() {
        const date = new Date();
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Get current health summary
     */
    getCurrentHealth() {
        if (!Array.isArray(this.healthHistory) || this.healthHistory.length === 0) {
            return { status: 'unknown', message: 'No health data available' };
        }
        const latest = this.healthHistory[this.healthHistory.length - 1];

        if (!latest) {
            return { status: 'unknown', message: 'No health data available' };
        }

        let status = 'healthy';
        let issues = [];

        // Check for issues
        if (latest.memory.usagePercent > 85) {
            status = 'warning';
            issues.push(`High memory usage: ${latest.memory.usagePercent}%`);
        }

        if (this.alerts.some(alert => alert.level === 'critical')) {
            status = 'critical';
            issues.push('Critical system alerts active');
        }

        return {
            status,
            issues,
            lastUpdate: latest.timestamp,
            alerts: this.alerts,
            summary: {
                memory: `${latest.memory.used}MB / ${latest.memory.total}MB (${latest.memory.usagePercent}%)`,
                uptime: latest.process.uptimeFormatted,
                systemLoad: latest.system.loadAverage[0]?.toFixed(2) || 'N/A'
            }
        };
    }

    /**
     * Get health history
     */
    getHealthHistory(limit = 100) {
        return this.healthHistory.slice(-limit);
    }

    /**
     * Export health data to file
     */
    async exportHealthData(filename = null) {
        if (!filename) {
            filename = `health-export-${Date.now()}.json`;
        }

        const exportFile = path.join(this.logDir, filename);
        const exportData = {
            exportTimestamp: new Date().toISOString(),
            currentHealth: this.getCurrentHealth(),
            history: this.healthHistory,
            alerts: this.alerts
        };

        try {
            await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2), 'utf8');
            return exportFile;
        } catch (error) {
            throw new Error(`Failed to export health data: ${error.message}`);
        }
    }
}

// Create singleton instance
const systemHealthMonitor = new SystemHealthMonitor();

// Graceful shutdown
process.on('SIGINT', () => {
    systemHealthMonitor.stopContinuousMonitoring();
    process.exit(0);
});

process.on('SIGTERM', () => {
    systemHealthMonitor.stopContinuousMonitoring();
    process.exit(0);
});

module.exports = { systemHealthMonitor, SystemHealthMonitor };