const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', '..', '..', '..', 'Desktop', 'Supply Mission Control', 'orders.csv');
console.log("CSV path:", csvPath);
if (!fs.existsSync(csvPath)) {
    console.error("File does not exist!");
    process.exit(1);
}

const text = fs.readFileSync(csvPath, 'utf8');
const wb = XLSX.read(text, { type: "string" });
console.log("SheetNames:", wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet);
console.log("Number of parsed orders:", rawData.length);
if (rawData.length > 0) {
    console.log("First order details:", rawData[0]);
}
