const { exec } = require('child_process');

class MacOSMonitor {
    async getDiskUsage() {
        return new Promise((resolve) => {
            exec('df -h', (err, stdout) => {
                if (err) return resolve([]);
                const lines = stdout.trim().split('\n').slice(1);
                const disks = lines.map(line => {
                    // Filesystem      Size   Used  Avail Capacity iused      ifree %iused  Mounted on
                    // /dev/disk1s1s1 460Gi   10Gi  297Gi     4%  366k 3117466540    0%   /
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 9) return null;
                    // This parsing is brittle on Mac because of spaces in "Mounted on"
                    // But standard df -h usually works for main volumes
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
         // Return null so the main monitor falls back to Node.js generic calculation
         // Implementing accurate MacOS CPU CLI usage is complex (needs top/ps parsing)
         return null;
    }

    async getMemoryInfo() {
        // Return null so the main monitor falls back to Node.js generic calculation (os.freemem)
        return null;
    }

    async getGPUInfo() {
        return new Promise(resolve => {
            exec('system_profiler SPDisplaysDataType', (err, stdout) => {
                if (err) return resolve([]);
                // Extracting just the Chipset Model line for brevity if possible, else just first line
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
                 // Combine for display
                 resolve({ raw: `${info.ProductName || ''} ${info.ProductVersion || ''}`.trim() });
            });
        });
    }
}

module.exports = new MacOSMonitor();
