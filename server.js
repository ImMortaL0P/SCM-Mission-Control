const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const warehousesPath = path.join(__dirname, 'warehouses.csv');
const hubsPath = path.join(__dirname, 'hubs.csv');
const csvPath = path.join(__dirname, 'orders.csv');
const keysPath = path.join(__dirname, 'api_keys.csv');
const alertsPath = path.join(__dirname, 'alerts.csv');

// Serve specific static data files from root
app.get('/hubs.csv', (req, res) => {
    res.sendFile(hubsPath);
});
app.get('/orders.csv', (req, res) => {
    res.sendFile(csvPath);
});
app.get('/warehouses.csv', (req, res) => {
    res.sendFile(warehousesPath);
});
app.get('/api_keys.csv', (req, res) => {
    res.sendFile(keysPath);
});
app.get('/alerts.csv', (req, res) => {
    if (fs.existsSync(alertsPath)) {
        res.sendFile(alertsPath);
    } else {
        res.status(404).send("alerts.csv does not exist yet.");
    }
});

// Load API keys from CSV
function loadApiKeys() {
    try {
        if (fs.existsSync(keysPath)) {
            const csvContent = fs.readFileSync(keysPath, 'utf8');
            const wb = XLSX.read(csvContent, { type: 'string' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const list = XLSX.utils.sheet_to_json(sheet);
            const keys = {};
            list.forEach(row => {
                if (row.KeyName) {
                    keys[row.KeyName] = row.KeyValue || "";
                }
            });
            return keys;
        }
    } catch (e) {
        console.error("Error loading API keys from CSV:", e);
    }
    return {
        openweathermap: "",
        weatherapi: "",
        tomtom: "",
        visualcrossing: "",
        waqi: "",
        windy: "LAZlrX699xGNQwLZdPQATmjzYObS1AS5"
    };
}

// Save API keys to CSV
function saveApiKeys(keys) {
    try {
        const list = Object.keys(keys).map(name => ({
            KeyName: name,
            KeyValue: keys[name] || ""
        }));
        const newWb = XLSX.utils.book_new();
        const newSheet = XLSX.utils.json_to_sheet(list);
        XLSX.utils.book_append_sheet(newWb, newSheet, "Keys");
        const csvContent = XLSX.write(newWb, { bookType: 'csv', type: 'string' });
        fs.writeFileSync(keysPath, csvContent, 'utf8');
    } catch (e) {
        console.error("Error saving API keys to CSV:", e);
    }
}

// Serve static frontend assets AFTER specific data file endpoints
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Load orders from CSV
function loadOrdersFromCSV() {
    try {
        if (fs.existsSync(csvPath)) {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const wb = XLSX.read(csvContent, { type: 'string' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            return XLSX.utils.sheet_to_json(sheet);
        }
    } catch (e) {
        console.error("Error loading orders from CSV:", e);
    }
    return [];
}

// Save orders to CSV
function saveOrdersToCSV(orders) {
    try {
        const newWb = XLSX.utils.book_new();
        const newSheet = XLSX.utils.json_to_sheet(orders);
        XLSX.utils.book_append_sheet(newWb, newSheet, "Orders");
        const csvContent = XLSX.write(newWb, { bookType: 'csv', type: 'string' });
        fs.writeFileSync(csvPath, csvContent, 'utf8');
    } catch (e) {
        console.error("Error saving orders to CSV:", e);
    }
}

// Load alerts from CSV
function loadAlertsFromCSV() {
    try {
        if (fs.existsSync(alertsPath)) {
            const csvContent = fs.readFileSync(alertsPath, 'utf8');
            const wb = XLSX.read(csvContent, { type: 'string' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            return XLSX.utils.sheet_to_json(sheet);
        }
    } catch (e) {
        console.error("Error loading alerts from CSV:", e);
    }
    return [];
}

// Save alerts to CSV
function saveAlertsToCSV(alerts) {
    try {
        const newWb = XLSX.utils.book_new();
        const newSheet = XLSX.utils.json_to_sheet(alerts);
        XLSX.utils.book_append_sheet(newWb, newSheet, "Alerts");
        const csvContent = XLSX.write(newWb, { bookType: 'csv', type: 'string' });
        fs.writeFileSync(alertsPath, csvContent, 'utf8');
    } catch (e) {
        console.error("Error saving alerts to CSV:", e);
    }
}

// Load warehouses from warehouses.csv
function loadWarehouses() {
    try {
        if (fs.existsSync(warehousesPath)) {
            const csvContent = fs.readFileSync(warehousesPath, 'utf8');
            const wb = XLSX.read(csvContent, { type: 'string' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const list = XLSX.utils.sheet_to_json(sheet);
            const warehouses = {};
            list.forEach(row => {
                if (row.Warehouse) {
                    warehouses[row.Warehouse] = {
                        name: row.Warehouse,
                        lat: parseFloat(row.Latitude),
                        lon: parseFloat(row.Longitude)
                    };
                }
            });
            if (Object.keys(warehouses).length > 0) {
                return warehouses;
            }
        }
    } catch (e) {
        console.error("Error loading warehouses from CSV:", e);
    }
    return { "Patna HQ DC": { name: "Patna HQ DC", lat: 25.5941, lon: 85.1376 } };
}

// Save warehouses to warehouses.csv
function saveWarehouses(data) {
    try {
        const list = Object.values(data).map(w => ({
            Warehouse: w.name,
            Latitude: w.lat,
            Longitude: w.lon
        }));
        const newWb = XLSX.utils.book_new();
        const newSheet = XLSX.utils.json_to_sheet(list);
        XLSX.utils.book_append_sheet(newWb, newSheet, "Warehouses");
        const csvContent = XLSX.write(newWb, { bookType: 'csv', type: 'string' });
        fs.writeFileSync(warehousesPath, csvContent, 'utf8');
    } catch (e) {
        console.error("Error saving warehouses to CSV:", e);
    }
}

// Propagate warehouse rename in orders.csv
function propagateWarehouseRenameInExcel(originalName, newName) {
    try {
        const orders = loadOrdersFromCSV();
        let modified = false;
        const updated = orders.map(row => {
            const currentWarehouse = row.SourceWarehouse || "Patna HQ DC";
            if (currentWarehouse === originalName) {
                row.SourceWarehouse = newName;
                modified = true;
            }
            return row;
        });
        if (modified) {
            saveOrdersToCSV(updated);
            console.log(`Propagated warehouse rename from "${originalName}" to "${newName}" in orders.csv`);
        }
    } catch (err) {
        console.error("Error propagating warehouse rename in CSV:", err);
    }
}

// Propagate city rename and coordinates updates in orders.csv
function propagateCityRenameInExcel(originalCity, newCity, newLat, newLon) {
    try {
        const orders = loadOrdersFromCSV();
        let modified = false;
        const updated = orders.map(row => {
            if (row.RouteHub === originalCity) {
                row.RouteHub = newCity;
                if (newLat !== undefined && newLon !== undefined) {
                    row.Latitude = parseFloat(newLat);
                    row.Longitude = parseFloat(newLon);
                }
                modified = true;
            }
            return row;
        });
        if (modified) {
            saveOrdersToCSV(updated);
            console.log(`Propagated city rename from "${originalCity}" to "${newCity}" in orders.csv`);
        }
    } catch (err) {
        console.error("Error propagating city rename in CSV:", err);
    }
}

// GET warehouses
app.get('/api/warehouses', (req, res) => {
    res.json(loadWarehouses());
});

// POST Warehouse
app.post('/api/locations/warehouse', (req, res) => {
    try {
        const { name, lat, lon, originalName } = req.body;
        if (!name || isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: "Invalid warehouse data" });
        }
        const warehouses = loadWarehouses();
        if (originalName && originalName !== name) {
            delete warehouses[originalName];
            propagateWarehouseRenameInExcel(originalName, name);
        }
        warehouses[name] = { name, lat: parseFloat(lat), lon: parseFloat(lon) };
        saveWarehouses(warehouses);
        console.log(`Successfully saved warehouse: ${name}`);
        res.json({ success: true, warehouses });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST Delivery City
app.post('/api/locations/city', (req, res) => {
    try {
        const { city, lat, lon, originalCity } = req.body;
        if (!city || isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: "Invalid city data" });
        }
        
        let content = "";
        if (fs.existsSync(hubsPath)) {
            content = fs.readFileSync(hubsPath, 'utf8');
        }
        
        let lines = content.split(/\r?\n/);
        let updatedLines = [];
        let header = "City,Latitude,Longitude";
        
        if (lines.length > 0 && lines[0].toLowerCase().includes("city")) {
            header = lines[0];
            lines = lines.slice(1);
        }
        
        let found = false;
        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length >= 3) {
                const currentCityName = parts[0].replace(/"/g, '').trim();
                if (originalCity && currentCityName === originalCity) {
                    updatedLines.push(`"${city}",${parseFloat(lat)},${parseFloat(lon)}`);
                    found = true;
                } else if (!originalCity && currentCityName === city) {
                    updatedLines.push(`"${city}",${parseFloat(lat)},${parseFloat(lon)}`);
                    found = true;
                } else {
                    updatedLines.push(line);
                }
            }
        });
        
        if (!found) {
            updatedLines.push(`"${city}",${parseFloat(lat)},${parseFloat(lon)}`);
        }
        
        fs.writeFileSync(hubsPath, [header, ...updatedLines].join("\n"), 'utf8');
        
        // Propagate in Excel
        if (originalCity) {
            propagateCityRenameInExcel(originalCity, city, lat, lon);
        }
        
        console.log(`Successfully saved delivery city: ${city}`);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST Order
app.post('/api/orders', (req, res) => {
    try {
        const order = req.body;
        const required = ['OrderID', 'RouteHub', 'Latitude', 'Longitude', 'Volume', 'Status', 'Reason', 'BaselineTime', 'DelayTime', 'DelayedTime', 'ETA', 'AltPath', 'FinancialImpact', 'OrderDate'];
        for (const field of required) {
            if (order[field] === undefined) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }
        
        const orders = loadOrdersFromCSV();
        orders.push(order);
        saveOrdersToCSV(orders);
        console.log(`Successfully added order: ${order.OrderID}`);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// GET API Keys
app.get('/api/keys', (req, res) => {
    res.json(loadApiKeys());
});

// POST API Keys
app.post('/api/keys', (req, res) => {
    try {
        saveApiKeys(req.body);
        console.log("Successfully saved API keys to api_keys.csv");
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST Update Order Route Configuration
app.post('/api/orders/update-route', (req, res) => {
    try {
        const { OrderID, AltPath } = req.body;
        if (!OrderID || !AltPath) {
            return res.status(400).json({ error: "Missing OrderID or AltPath" });
        }
        const orders = loadOrdersFromCSV();
        const index = orders.findIndex(o => o.OrderID === OrderID);
        if (index === -1) {
            return res.status(404).json({ error: "Order not found" });
        }
        orders[index].AltPath = AltPath;
        saveOrdersToCSV(orders);
        console.log(`Successfully updated route for order ${OrderID} to ${AltPath}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Error updating order route:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST Bulk Update Routes for a Lane (Warehouse -> Hub)
app.post('/api/routes/update-lane', (req, res) => {
    try {
        const { SourceWarehouse, RouteHub, AltPath } = req.body;
        if (!SourceWarehouse || !RouteHub || AltPath === undefined) {
            return res.status(400).json({ error: "Missing SourceWarehouse, RouteHub, or AltPath" });
        }
        const orders = loadOrdersFromCSV();
        let updatedCount = 0;
        orders.forEach(o => {
            const currentSource = o.SourceWarehouse || "Patna HQ DC";
            if (currentSource === SourceWarehouse && o.RouteHub === RouteHub) {
                o.AltPath = AltPath;
                updatedCount++;
            }
        });
        if (updatedCount > 0) {
            saveOrdersToCSV(orders);
            console.log(`Successfully updated route to "${AltPath}" for ${updatedCount} orders on lane ${SourceWarehouse} -> ${RouteHub}`);
        }
        res.json({ success: true, updatedCount });
    } catch (e) {
        console.error("Error updating lane routes:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET Route Snapping Proxy with Caching
const routeCacheFile = path.join(__dirname, 'route_cache.json');
let routeCache = {};
if (fs.existsSync(routeCacheFile)) {
    try {
        routeCache = JSON.parse(fs.readFileSync(routeCacheFile, 'utf8'));
    } catch (e) {
        console.error("Failed to parse route cache:", e);
    }
}

app.get('/api/route-snapping', async (req, res) => {
    try {
        const { coords } = req.query;
        if (!coords) {
            return res.status(400).json({ error: "Missing coords query parameter" });
        }

        // Generate cache key using all query params
        const queryParams = new URLSearchParams(req.query);
        queryParams.delete('coords');
        const cacheKey = `${coords}?${queryParams.toString()}`;

        // Check cache
        if (routeCache[cacheKey]) {
            return res.json(routeCache[cacheKey]);
        }

        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?${queryParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OSRM API responded with status ${response.status}`);
        }
        const data = await response.json();
        
        // Cache the response
        routeCache[cacheKey] = data;
        fs.writeFileSync(routeCacheFile, JSON.stringify(routeCache, null, 2));

        res.json(data);
    } catch (e) {
        console.error("Route snapping proxy failed:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET Alerts
app.get('/api/alerts', (req, res) => {
    res.json(loadAlertsFromCSV());
});

// POST Alerts
app.post('/api/alerts', (req, res) => {
    try {
        const body = req.body;
        if (!body) {
            return res.status(400).json({ error: "Invalid alert data" });
        }
        
        let newAlerts = [];
        if (Array.isArray(body)) {
            newAlerts = body;
        } else {
            newAlerts = [body];
        }
        
        const existingAlerts = loadAlertsFromCSV();
        const existingIds = new Set(existingAlerts.map(a => String(a.id || "")));
        
        let addedCount = 0;
        for (const alert of newAlerts) {
            if (!alert.id) continue;
            
            // Compute/verify timestamp
            if (!alert.timestamp) {
                if (alert.pubDate) {
                    const parsed = Date.parse(alert.pubDate);
                    alert.timestamp = isNaN(parsed) ? Date.now() : parsed;
                } else {
                    alert.timestamp = Date.now();
                }
            } else {
                alert.timestamp = parseInt(alert.timestamp) || Date.now();
            }
            
            if (!existingIds.has(String(alert.id))) {
                existingAlerts.push(alert);
                existingIds.add(String(alert.id));
                addedCount++;
            }
        }
        
        if (addedCount > 0) {
            saveAlertsToCSV(existingAlerts);
            console.log(`Successfully added ${addedCount} alerts to alerts.csv`);
        }
        res.json({ success: true, added: addedCount, total: existingAlerts.length });
    } catch (e) {
        console.error("Error saving alert(s):", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`SCM Mission Control server running at http://localhost:${PORT}`);
});
