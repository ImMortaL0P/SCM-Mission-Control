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
        waqi: ""
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

app.listen(PORT, () => {
    console.log(`SCM Mission Control server running at http://localhost:${PORT}`);
});
