const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/icon.png');
const outputPath = path.join(__dirname, '../public/icon.ico');

// Read the PNG file
const pngBuffer = fs.readFileSync(inputPath);

// Convert to ICO
pngToIco([pngBuffer])
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log('Successfully created icon.ico');
    })
    .catch(err => {
        console.error('Error creating icon:', err);
        process.exit(1);
    });
