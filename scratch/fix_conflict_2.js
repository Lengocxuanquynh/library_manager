const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(dashboard)', 'admin', 'transactions', 'page.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the last conflict marker block
const index1 = content.indexOf('<<<<<<< Updated upstream');
if (index1 !== -1) {
    const index2 = content.indexOf('=======', index1);
    const index3 = content.indexOf('>>>>>>> Stashed changes', index2);
    
    if (index2 !== -1 && index3 !== -1) {
        const upstreamBlock = content.substring(index1 + '<<<<<<< Updated upstream'.length, index2).trim();
        
        const stringToReplace = content.substring(index1, index3 + '>>>>>>> Stashed changes'.length);
        
        content = content.replace(stringToReplace, upstreamBlock);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Fixed final conflict marker!");
    } else {
        console.log("Could not find full conflict marker block");
    }
} else {
    console.log("No conflict markers found");
}
