const { exec } = require('child_process');

class WindowsMonitor {
    async getDiskUsage() {
        return new Promise((resolve) => {
            exec('wmic logicaldisk get size,freespace,caption', (err, stdout) => {
                if (err) return resolve([]);
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
        });
    }

    async getCPUInfo() {
         return new Promise((resolve) => {
            exec('wmic cpu get loadpercentage', (err, stdout) => {
                 if (err) return resolve(null);
                 const lines = stdout.trim().split('\n');
                 if (lines.length > 1) {
                     const load = parseInt(lines[1].trim());
                     resolve(isNaN(load) ? 0 : load);
                 } else {
                     resolve(0);
                 }
            });
         });
    }

    async getMemoryInfo() {
        return new Promise((resolve) => {
            exec('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize', (err, stdout) => {
                if (err) return resolve(null);
                // Output format:
                // FreePhysicalMemory  TotalVisibleMemorySize
                // 1234567             87654321
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                     const parts = lines[1].trim().split(/\s+/);
                     if (parts.length >= 2) {
                         const freeKB = parseInt(parts[0]);
                         const totalKB = parseInt(parts[1]);
                         resolve({
                             free: Math.round(freeKB / 1024), // MB
                             total: Math.round(totalKB / 1024), // MB
                             used: Math.round((totalKB - freeKB) / 1024)
                         });
                     } else {
                         resolve(null);
                     }
                } else {
                    resolve(null);
                }
            });
        });
    }

    async getGPUInfo() {
         return new Promise((resolve) => {
            exec('wmic path win32_videocontroller get name', (err, stdout) => {
                 if (err) return resolve([]);
                 const lines = stdout.trim().split('\n').slice(1);
                 resolve(lines.map(l => l.trim()).filter(Boolean));
            });
         });
    }

    async getOSInfo() {
        return new Promise((resolve) => {
            exec('wmic os get Caption,Version', (err, stdout) => {
                if (err) return resolve({});
                const lines = stdout.trim().split('\n');
                 if (lines.length > 1) {
                     // The output columns might vary in width, regex split is safer
                     // Caption                                   Version
                     // Microsoft Windows 11 Pro                  10.0.22631

                     // WMIC formatting is tricky. Let's try to parse more robustly or just return raw string.
                     // A safer way is `wmic os get Caption /value` and `wmic os get Version /value` but let's stick to one call.
                     resolve({ raw: lines[1].trim() });
                 } else {
                     resolve({});
                 }
            });
        });
    }
}

module.exports = new WindowsMonitor();
