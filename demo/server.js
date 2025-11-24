const express = require('express');
const path = require('path');
const monitor = require('../index'); // Import the package

const app = express();
const PORT = 3000;

// 1. Start the monitor (optional, but needed for history)
monitor.start();

// 2. Expose the API Endpoint (The "Bridge")
app.get('/_system-health', async (req, res) => {
    // We send the latest data + history so the chart looks good immediately
    const data = {
        data: monitor.getCurrentHealth().data,
        history: monitor.getHealthHistory(50)
    };
    res.json(data);
});

// 3. (Optional) Serve the Standalone Dashboard UI directly
app.get('/dashboard', (req, res) => {
    res.send(monitor.getSystemHealthUI('/_system-health'));
});

// Serve the client library (In a real app, user would bundle this or use a CDN)
app.use('/client', express.static(path.join(__dirname, '../client')));

// Serve the demo page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Demo running at http://localhost:${PORT}`);
    console.log(`- Custom Integration: http://localhost:${PORT}/`);
    console.log(`- Instant Dashboard:  http://localhost:${PORT}/dashboard`);
});
