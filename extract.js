const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'main.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (match) {
    const outputPath = path.join(__dirname, 'extracted.js');
    fs.writeFileSync(outputPath, match[1]);
    console.log("Extracted successfully to extracted.js!");
} else {
    console.error("Could not find script block!");
}
