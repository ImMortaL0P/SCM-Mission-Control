const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(__dirname, 'orders.xlsx');
try {
    const wb = XLSX.readFile(xlsxPath);
    console.log("Sheet names:", wb.SheetNames);
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log("Number of rows in first sheet:", data.length);
    console.log("First row data:", data[0]);
} catch (err) {
    console.error("Failed to read orders.xlsx:", err);
}
