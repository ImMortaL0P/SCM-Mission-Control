---
title: SCM Mission Control
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Supply Chain Mission Control (LogiControl)

LogiControl is a high-fidelity, real-time Supply Chain Mission Control Dashboard designed to provide end-to-end route visibility, predictive delay forecasting, and live telemetry integrations.

The dashboard integrates multiple weather and traffic API layers to deliver reliable status tracking for logistics routes in India, originating from the Patna HQ Distribution Center.

---

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ImMortaL0P/SCM-Mission-Control)

---

## 🚀 Key Features

### 1. Multi-API Weather & AQI Cascade & Caching
To minimize API key consumption and distribute fetching load across providers:
* **Load-Balanced Weather Cascade**:
  * **Primary Hubs** (Patna, Kolkata, Ranchi, Bhubaneswar, Siliguri, Guwahati, Jamshedpur, Gaya, Muzaffarpur) query **OpenWeatherMap** as the primary provider, cascading to **WeatherAPI**, **Visual Crossing**, and finally **Open-Meteo**.
  * **Remaining Cities** (Asansol, Bhagalpur, Dhanbad, Durgapur, Darbhanga, Hazaribagh, Kharagpur, Shillong, Puri, Cuttack) query **Visual Crossing Weather API** as the primary provider, cascading to **OpenWeatherMap**, **WeatherAPI**, and finally **Open-Meteo**.
* **Dedicated High-Fidelity AQI**: Queries the **World Air Quality Index (WAQI) API** for all cities. If it fails or is not configured, it gracefully falls back to the weather API's AQI or **Open-Meteo Air Quality API**.
* **Local Weather Caching**: All telemetry is cached in `localStorage` on a per-city basis. It is reused unless the cached timestamp is older than **1 hour (3,600 seconds)**, keeping query rates within bounds.

### 2. Live Route Traffic Integration
* **TomTom Traffic Flow Segment API**: Ingests real-time speeds (`currentSpeed` vs `freeFlowSpeed`) and travel delays directly from TomTom servers for the exact coordinates of route hubs.
* **Keyless Indian Highway Traffic Emulation**: If no TomTom key is provided, the dashboard falls back to a time-seeded dynamic traffic simulator. It models live highway conditions (e.g. NH-2, NH-31, NH-33 blockages, lane closures, construction, peak hours) that change dynamically every 600 seconds.
* **Route Geometry**: Uses the **OSRM (Open Source Routing Machine) API** to fetch and draw the actual driving polyline routes between Patna HQ and transit hubs on the Leaflet map.

### 3. Synchronized Auto Refresh & Manual Fetch
* **Auto Refresh**: The dashboard implements a **600-second countdown** (10 minutes) timer shown in the Topbar.
* **Manual Fetch**: Users can click the **Force Sync All** or **Manual Fetch** buttons in the Topbar to bypass local weather caching and fetch fresh weather, AQI, traffic, and order details immediately.
* **API Control Panel Dropdown**: Opens a diagnostic popover displaying:
  - Connection/sync status for each individual feed.
  - Dedicated **Sync Refresh Buttons** for each API independently.
  - Independent **Last Fetch Timestamps** showing exactly when each individual API was last queried.
* Upon auto-refresh, manual fetch, or individual refresh, it updates:
  * Order details from `orders.xlsx`.
  * Live news and transit incidents.
  * Live route traffic flow segment data.
  * Weather cascade (uses 1-hour cache on auto-refresh, bypasses cache on manual fetch/weather-specific refresh).

---

## 🛠️ Folder & Scripts Structure

The parent folder includes several helper scripts designed to assist with database setup and React compilation checks:

* **[main.html](./main.html)**: The main single-page React dashboard incorporating Leaflet maps, Chart.js metrics, and all integration logic.
* **[generate_orders.js](./generate_orders.js)**: Generates 200+ random active orders for the current local date (YYYY-MM-DD) across all 19 cities from `hubs.csv` and writes them into `orders.xlsx`.
* **[read_orders_info.js](./read_orders_info.js)**: Helper utility to read sheet names and verify row metadata in `orders.xlsx`.
* **[extract.js](./extract.js)**: Extracts the Babel React block from `main.html` into a separate `extracted.js` file.
* **[validate.js](./validate.js)**: Compiles `extracted.js` using Babel validation to ensure the React logic has no syntax or compile errors.

---

## ⚙️ Configuration Setup

API integrations can be customized on-the-fly using the **Settings Cog** in the Topbar:
1. **OpenWeatherMap API Key**: Free/paid key from `openweathermap.org`.
2. **WeatherAPI Key**: Free key from `weatherapi.com`.
3. **Visual Crossing Key**: Free key from `visualcrossing.com`.
4. **WAQI API Token**: Free token from `aqicn.org`.
5. **TomTom Traffic Key**: Free Developer key from `developer.tomtom.com`.

Settings are stored securely in the browser's `localStorage` as:
* `openweathermap_api_key`
* `weatherapi_api_key`
* `visualcrossing_api_key`
* `waqi_api_key`
* `tomtom_api_key`

---

## 🏃 Running the Project

### 1. Generating Daily Orders
Before running the dashboard, generate today's order database CSV:
```bash
# Run order generator
node generate_orders.js
```

### 2. Running the Full Stack App Locally
To run the Node.js backend server (serving the production frontend build):
```bash
# Install root dependencies
npm install

# Start backend server on port 3000
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Running Frontend in Development Mode (with HMR)
To start the Vite development server with Hot Module Replacement on port 5173:
```bash
# Navigate to frontend folder and start dev server
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser. Any API requests will be proxied automatically to `http://localhost:3000`.

### 4. Compiling the Production Build
To re-compile the frontend assets:
```bash
# Run build command from the root directory
npm run build
```
