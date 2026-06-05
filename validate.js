const fs = require('fs');
const path = require('path');

let Babel;
try {
    Babel = require('@babel/standalone');
} catch (e) {
    try {
        Babel = require('/Users/mangalam/.gemini/antigravity-cli/brain/1a4c1971-af59-4a2d-aca1-724629c2dd98/scratch/node_modules/@babel/standalone');
    } catch (err) {
        console.error("Could not find @babel/standalone. Please run 'npm install @babel/standalone' first.");
        process.exit(1);
    }
}

const extractedPath = path.join(__dirname, 'extracted.js');
if (!fs.existsSync(extractedPath)) {
    console.error("extracted.js does not exist. Please run node extract.js first.");
    process.exit(1);
}

const code = fs.readFileSync(extractedPath, 'utf8');
try {
    const result = Babel.transform(code, {
        presets: ['react'],
        filename: 'extracted.js'
    });
    console.log("SUCCESS: Code compiles perfectly without any syntax errors!");
} catch (e) {
    console.error("SYNTAX ERROR FOUND:");
    console.error(e.message);
    process.exit(1);
}
