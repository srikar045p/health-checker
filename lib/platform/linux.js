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

    async getCPUInfo() {
        return new Promise((resolve) => {
             exec('top -bn1 | grep "Cpu(s)"', (err, stdout) => {
                 if (err) return resolve(null);
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

    async getNetworkStats() {
        return new Promise(resolve => {
            exec('cat /proc/net/dev', (err, stdout) => {
                if (err) return resolve(null);
                //  Inter-|   Receive                                                |  Transmit
                //   face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
                //     lo: 1234       12    0    0    0     0          0         0     1234       12    0    0    0     0       0          0
                const lines = stdout.trim().split('\n').slice(2);
                let rx = 0;
                let tx = 0;
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 9) {
                        // parts[0] is interface name "lo:"
                        // parts[1] is rx bytes
                        // parts[9] is tx bytes
                        rx += parseInt(parts[1]);
                        tx += parseInt(parts[9]);
                    }
                });
                resolve({ rx, tx });
            });
        });
    }
}

module.exports = new LinuxMonitor();
