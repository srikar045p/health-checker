const { exec } = require('child_process');

class LinuxMonitor {
    async getDiskUsage() {
        return new Promise((resolve) => {
            exec('df -k --output=target,size,used,avail,pcent -x tmpfs -x devtmpfs', (err, stdout) => {
                if (err) return resolve([]);
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
        });
    }

    // Fallback CPU/Memory if Node APIs aren't enough, but for now Node APIs are good cross-platform baselines for these.
    // However, the user asked specifically for command line tools.

    async getCPUInfo() {
        // 'top' is hard to parse in non-interactive mode across all distros.
        // using 'mpstat' or 'vmstat' or just reading /proc/stat is better.
        // Let's try reading /proc/stat directly for "instant" cpu usage since boot, or just use `ps`.
        // Actually, simple `top -bn1` grep Cpu is standard-ish.
        return new Promise((resolve) => {
             exec('top -bn1 | grep "Cpu(s)"', (err, stdout) => {
                 if (err) return resolve(null);
                 // %Cpu(s):  0.3 us,  0.2 sy,  0.0 ni, 99.5 id...
                 const parts = stdout.match(/(\d+\.\d+)\s+id/);
                 if (parts) {
                     resolve(100 - parseFloat(parts[1]));
                 } else {
                     resolve(null);
                 }
             });
        });
    }

    async getMemoryInfo() {
         return new Promise((resolve) => {
             exec('free -m', (err, stdout) => {
                 if (err) return resolve(null);
                 //               total        used        free      shared  buff/cache   available
                 // Mem:           7961        4285         425         206        3250        3201
                 const lines = stdout.trim().split('\n');
                 const memLine = lines.find(l => l.startsWith('Mem:'));
                 if (memLine) {
                     const parts = memLine.split(/\s+/);
                     resolve({
                         total: parseInt(parts[1]),
                         used: parseInt(parts[2]),
                         free: parseInt(parts[3]),
                         available: parseInt(parts[6] || parts[3])
                     });
                 } else {
                     resolve(null);
                 }
             });
         });
    }

    async getGPUInfo() {
        return new Promise(resolve => {
            exec('lspci | grep -i vga', (err, stdout) => {
                if (err) return resolve([]);
                resolve(stdout.trim().split('\n'));
            });
        });
    }

    async getOSInfo() {
         return new Promise((resolve) => {
            exec('cat /etc/os-release', (err, stdout) => {
                if (err) return resolve({});
                const info = {};
                stdout.split('\n').forEach(line => {
                    const [key, val] = line.split('=');
                    if (key && val) info[key] = val.replace(/"/g, '');
                });
                resolve(info);
            });
         });
    }
}

module.exports = new LinuxMonitor();
