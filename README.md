# System Health Monitor 🏥

A lightweight, framework-agnostic Node.js package to monitor server system health (CPU, Memory, Disk, Network) and display it in your frontend application.

![System Health Dashboard](assets/dashboard-preview.png)

## 🚀 Features

*   **Cross-Platform:** Works on **Windows**, **Linux**, and **macOS**.
*   **Deep Metrics:** Uses native OS commands (`wmic`, `top`, `df`) for accurate data.
*   **Framework Agnostic:** Frontend component is pure Vanilla JS — works with **React**, **Angular**, **Vue**, or plain HTML.
*   **Zero Dependencies (Runtime):** Lightweight backend; Frontend dynamically loads Chart.js from CDN (if not present).
*   **Real-time:** Live updates with configurable polling intervals.

## 📦 Installation

To use this package, install it in your Node.js backend project.

```bash
npm install @srikarp/system-health-monitor
```

*Note: If you have a separate Frontend project (e.g., a React App created with CRA/Vite that runs on a different server), you should also install it there to get access to the client library.*

## 🛠️ Integration Guide

This package consists of two parts: a **Backend** (to collect data) and a **Frontend** (to visualize it).

### Part 1: Backend Setup (Node.js)

You need to expose an endpoint in your server that the frontend will check.

```javascript
const express = require('express');
const monitor = require('@srikarp/system-health-monitor');

const app = express();

// 1. Start monitoring (begins data collection)
monitor.start();

// 2. Create the Data Endpoint (Returns JSON)
app.get('/_system-health', (req, res) => {
    res.json({
        data: monitor.getCurrentHealth().data,
        history: monitor.getHealthHistory(50)
    });
});

// 3. (Optional) Create an Instant Dashboard Page
// This lets you visit http://localhost:3000/dashboard to see the UI immediately.
app.get('/dashboard', (req, res) => {
    res.send(monitor.getSystemHealthUI('/_system-health'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### Part 2: Frontend Integration

If you didn't use the "Instant Dashboard" above and want to integrate the graphs into your existing application, follow these steps.

#### Option A: Using ES Modules (React, Angular, Vue, Vite)

If you are using a bundler, import the client directly.

```javascript
// In your React/Vue component file
import '@srikarp/system-health-monitor/client/system-health-client';

// ... inside your component ...
useEffect(() => {
    // 'SystemHealthClient' is now available globally
    SystemHealthClient.initMonitor('my-dashboard-container', {
        apiEndpoint: 'http://localhost:3000/_system-health' // Your backend URL
    });
}, []);
```

#### Option B: Plain HTML / Script Tag

If you are not using a build tool, you need to serve the client script from your backend or copy it to your public folder.

```html
<!-- 1. Create a Container -->
<div id="health-dashboard"></div>

<!-- 2. Import the Client Script -->
<!-- Ensure this path points to where you are serving the file -->
<script src="/path/to/system-health-client.js"></script>

<!-- 3. Initialize -->
<script>
    window.addEventListener('load', () => {
        SystemHealthClient.initMonitor('health-dashboard', {
            apiEndpoint: '/_system-health'
        });
    });
</script>
```

## ⚙️ Configuration

### Backend: `monitor.start(intervalMs)`
*   `intervalMs` (number): How often the backend collects metrics in milliseconds. Default: `4000`.

### Backend: `monitor.getSystemHealthUI(apiEndpoint)`
*   Returns a complete HTML string representing the dashboard, pre-wired to the given endpoint. useful for server-side rendering.

### Frontend: `SystemHealthClient.initMonitor(containerId, options)`
*   `containerId` (string): The ID of the DOM element to render the dashboard into.
*   `options` (object):
    *   `apiEndpoint` (string): The URL of your backend metrics endpoint. Default: `/_system-health`.
    *   `refreshInterval` (number): Polling frequency in ms. Default: `2000`.
    *   `chartColors` (object): Custom hex colors for charts (e.g., `{ cpu: '#ff0000' }`).

## 📊 Metrics Collected

| Metric | Windows | Linux | macOS |
| :--- | :--- | :--- | :--- |
| **CPU Usage** | `wmic cpu get loadpercentage` | `top` / Node Fallback | Node Fallback |
| **Memory** | `wmic OS` | `free -m` | Node Fallback |
| **Disk Usage** | `wmic logicaldisk` | `df -k` | `df -h` |
| **Processes** | Node API | Node API | Node API |
| **GPU Info** | `wmic path win32_videocontroller` | `lspci` | `system_profiler` |

## 📄 License

ISC
