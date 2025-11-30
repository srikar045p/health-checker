const { exec } = require('child_process');

class MacOSMonitor {
    async getDiskUsage() {
        return new Promise((resolve) => {
            exec('df -h', (err, stdout) => {
                if (err) return resolve([]);
                const lines = stdout.trim().split('\n').slice(1);
                const disks = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 9) return null;
                    const size = parts[1];
                    const used = parts[2];
                    const avail = parts[3];
                    const capacity = parts[4];
                    const mount = parts.slice(8).join(' ');

                    return {
                        mount,
                        total: size,
                        used: used,
                        available: avail,
                        usagePercent: parseInt(capacity)
                    };
                }).filter(Boolean);
                resolve(disks);
            });
        });
    }

    async getCPUInfo() {
         return null;
    }

    async getMemoryInfo() {
        return null;
    }

    async getGPUInfo() {
        return new Promise(resolve => {
            exec('system_profiler SPDisplaysDataType', (err, stdout) => {
                if (err) return resolve([]);
                const match = stdout.match(/Chipset Model: (.*)/);
                if (match && match[1]) return resolve([match[1]]);
                return resolve([]);
            });
        });
    }

    async getOSInfo() {
        return new Promise(resolve => {
            exec('sw_vers', (err, stdout) => {
                 if (err) return resolve({});
                 const info = {};
                 const lines = stdout.trim().split('\n');
                 lines.forEach(line => {
                     const parts = line.split(':');
                     if (parts.length >= 2) {
                         info[parts[0].trim()] = parts[1].trim();
                     }
                 });
                 resolve({ raw: `${info.ProductName || ''} ${info.ProductVersion || ''}`.trim() });
            });
        });
    }

    async getNetworkStats() {
        // MacOS netstat -ib is complex to parse reliably without a lot of regex work.
        // Returning null will skip the chart, which is acceptable fallback.
        return null;
    }
}

module.exports = new MacOSMonitor();
