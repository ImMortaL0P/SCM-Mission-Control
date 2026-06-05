const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

// Get today's date in YYYY-MM-DD format (local time)
const d = new Date();
const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, '0');
const dd = String(d.getDate()).padStart(2, '0');
const todayDateStr = `${yyyy}-${mm}-${dd}`;

// Load warehouses.csv
const warehousesPath = path.join(__dirname, 'warehouses.csv');
let warehouses = [];
if (fs.existsSync(warehousesPath)) {
    try {
        const warehousesText = fs.readFileSync(warehousesPath, 'utf8');
        const wb = XLSX.read(warehousesText, { type: 'string' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        warehouses = XLSX.utils.sheet_to_json(sheet);
    } catch (e) {
        console.error("Error loading warehouses.csv:", e);
    }
}
if (warehouses.length === 0) {
    warehouses = [{ Warehouse: "Patna HQ DC", Latitude: 25.5941, Longitude: 85.1376 }];
}

// Load hubs.csv
const hubsPath = path.join(__dirname, 'hubs.csv');
const hubsText = fs.readFileSync(hubsPath, 'utf8');
const hubsLines = hubsText.trim().split('\n').slice(1);
const hubs = [];

hubsLines.forEach(line => {
    const match = line.match(/^(?:"([^"]+)"|([^,]+)),([\d.-]+),([\d.-]+)$/);
    if (match) {
        const city = match[1] || match[2];
        const lat = parseFloat(match[3]);
        const lon = parseFloat(match[4]);
        hubs.push({ city, lat, lon });
    }
});

console.log(`Loaded ${hubs.length} hubs from hubs.csv`);

// SCM Baseline transit times dictionary based on PDF research and OSRM calculations
const SCM_BASELINES = {
    "Kolkata, WB": { distance: 592.0, baselineHours: 18.7 },
    "Ranchi, JH": { distance: 322.0, baselineHours: 14.5 },
    "Bhubaneswar, OD": { distance: 787.0, baselineHours: 34.4 },
    "Siliguri, WB": { distance: 530.0, baselineHours: 17.6 },
    "Guwahati, AS": { distance: 906.0, baselineHours: 37.7 },
    "Jamshedpur, JH": { distance: 444.7, baselineHours: 16.9 },
    "Patna, BR": { distance: 0.0, baselineHours: 0.0 },
    "Gaya, BR": { distance: 105.0, baselineHours: 10.5 },
    "Muzaffarpur, BR": { distance: 95.0, baselineHours: 10.0 },
    "Bhagalpur, BR": { distance: 241.0, baselineHours: 12.6 },
    "Dhanbad, JH": { distance: 318.6, baselineHours: 14.4 },
    "Cuttack, OD": { distance: 766.1, baselineHours: 34.0 },
    "Asansol, WB": { distance: 371.8, baselineHours: 15.1 },
    "Durgapur, WB": { distance: 413.5, baselineHours: 15.9 },
    "Darbhanga, BR": { distance: 129.5, baselineHours: 10.4 },
    "Hazaribagh, JH": { distance: 229.2, baselineHours: 12.6 },
    "Kharagpur, WB": { distance: 592.6, baselineHours: 19.3 },
    "Shillong, ML": { distance: 939.5, baselineHours: 38.5 },
    "Puri, OD": { distance: 843.2, baselineHours: 35.6 }
};

// Helper for dynamic distance calculation for new cities
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper function to calculate a realistic ETA string based on order date and total transit time
function generateETAString(dateStr, mins) {
    const date = new Date(dateStr + "T12:00:00");
    date.setMinutes(date.getMinutes() + mins);
    const resMonth = date.toLocaleString('en-US', { month: 'short' });
    const resDay = date.getDate();
    let resHour = date.getHours();
    const resMin = String(date.getMinutes()).padStart(2, '0');
    const resAmpm = resHour >= 12 ? 'PM' : 'AM';
    resHour = resHour % 12;
    if (resHour === 0) resHour = 12;
    return `${resMonth} ${resDay}, ${String(resHour).padStart(2, '0')}:${resMin} ${resAmpm}`;
}

// Choose primary warehouse for order sourcing (default to first registered)
const primaryWarehouse = warehouses[0];
console.log(`Using primary warehouse for order generation: ${primaryWarehouse.Warehouse}`);

// Generate 220 random orders for today with realistic baseline and transit delay times
const newOrders = [];
for (let i = 1; i <= 220; i++) {
    const hub = hubs[Math.floor(Math.random() * hubs.length)];
    const randomId = Math.floor(10000 + Math.random() * 90000);
    const orderId = `DLV-${randomId}`;
    const volume = Math.floor(100 + Math.random() * 700);
    
    // Get SCM Baseline configuration or compute it dynamically
    let baselineInfo = SCM_BASELINES[hub.city];
    if (!baselineInfo) {
        // Estimate distance: straight line * 1.3 routing factor
        const distance = Math.round(getHaversineDistance(parseFloat(primaryWarehouse.Latitude), parseFloat(primaryWarehouse.Longitude), hub.lat, hub.lon) * 1.3);
        // baseline hours assuming average truck speed of 40 km/h
        const baselineHours = parseFloat((distance / 40.0).toFixed(1));
        baselineInfo = { distance, baselineHours };
    }
    const baselineHours = baselineInfo.baselineHours;
    
    // Simulate some realistic delays (75% on time, 15% minor delay, 10% severe delay)
    let delayTime = 0;
    let reason = 'Clear & Optimal';
    let status = 'In Transit';
    
    // Check if the destination is the same as the source warehouse location
    const isAtWarehouse = (hub.lat === parseFloat(primaryWarehouse.Latitude) && hub.lon === parseFloat(primaryWarehouse.Longitude));
    if (!isAtWarehouse) {
        const rand = Math.random();
        if (rand > 0.90) {
            delayTime = Math.floor(65 + Math.random() * 60); // Severe delay (>60 mins)
            reason = 'Congested Highway / Toll Queue';
            status = 'Delayed';
        } else if (rand > 0.75) {
            delayTime = Math.floor(21 + Math.random() * 35); // Minor delay (21-55 mins)
            reason = 'Heavy Highway Traffic';
            status = 'At Risk';
        }
    } else {
        status = 'Delivered';
        reason = 'Completed';
    }
    
    const delayedHours = baselineHours + (delayTime / 60);
    const totalTransitMins = Math.round(baselineHours * 60) + delayTime;
    const etaStr = status === 'Delivered' ? 'Completed' : generateETAString(todayDateStr, totalTransitMins);
    
    // Financial impact calculation based on volume and delay
    const costPerMinute = volume * 0.15 + 12;
    const financialImpact = delayTime > 0 ? Math.round(delayTime * costPerMinute) : 0;
    
    newOrders.push({
        OrderID: orderId,
        RouteHub: hub.city,
        Latitude: hub.lat,
        Longitude: hub.lon,
        Volume: volume,
        Status: status,
        Reason: reason,
        BaselineTime: parseFloat(baselineHours.toFixed(1)),
        DelayTime: delayTime,
        DelayedTime: parseFloat(delayedHours.toFixed(2)),
        ETA: etaStr,
        AltPath: delayTime > 0 ? 'NH Alt Routing' : 'Standard Routing',
        FinancialImpact: financialImpact,
        OrderDate: todayDateStr,
        SourceWarehouse: primaryWarehouse.Warehouse
    });
}

console.log(`Generated ${newOrders.length} random orders for ${todayDateStr}`);

function normalizeExcelDate(val) {
    if (!val) return "";
    const str = String(val).trim();
    const num = Number(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const utc_days = Math.floor(num - 25569);
        const date_info = new Date(utc_days * 86400 * 1000);
        const yyyy = date_info.getUTCFullYear();
        const mm = String(date_info.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date_info.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return str;
}

// 1. Save to orders.csv (flat CSV format database)
const csvPath = path.join(__dirname, 'orders.csv');
let existingOrders = [];
if (fs.existsSync(csvPath)) {
    try {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const ordersWb = XLSX.read(csvContent, { type: 'string' });
        const sheet = ordersWb.Sheets[ordersWb.SheetNames[0]];
        existingOrders = XLSX.utils.sheet_to_json(sheet);
    } catch (e) {
        console.error("Could not load existing orders.csv:", e);
    }
}
const filteredOrders = existingOrders.filter(order => normalizeExcelDate(order.OrderDate) !== todayDateStr);
const updatedOrders = filteredOrders.concat(newOrders);

try {
    const csvWb = XLSX.utils.book_new();
    const csvSheet = XLSX.utils.json_to_sheet(updatedOrders);
    XLSX.utils.book_append_sheet(csvWb, csvSheet, "Orders");
    const csvContent = XLSX.write(csvWb, { bookType: 'csv', type: 'string' });
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log("Successfully saved updated orders.csv!");
} catch (e) {
    console.error("Failed to write orders.csv:", e);
}

// 2. Save to orders.xlsx (legacy sheet-based archive)
const xlsxPath = path.join(__dirname, 'orders.xlsx');
let wb;
try {
    wb = XLSX.readFile(xlsxPath);
} catch (e) {
    wb = XLSX.utils.book_new();
}

console.log("Existing sheet names in orders.xlsx:", wb.SheetNames || []);

// Create sheet for today
const newSheet = XLSX.utils.json_to_sheet(newOrders);

if (!wb.SheetNames) {
    wb.SheetNames = [];
    wb.Sheets = {};
}

if (wb.SheetNames.includes(todayDateStr)) {
    wb.Sheets[todayDateStr] = newSheet;
    console.log(`Replaced existing sheet for ${todayDateStr} in orders.xlsx`);
} else {
    wb.SheetNames.unshift(todayDateStr);
    wb.Sheets[todayDateStr] = newSheet;
    console.log(`Added new sheet for ${todayDateStr} at the beginning of orders.xlsx`);
}

XLSX.writeFile(wb, xlsxPath);
console.log("Successfully saved updated orders.xlsx!");
