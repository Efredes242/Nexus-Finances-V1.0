const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

// png-to-ico exports the function directly or as default depending on how it's required
const convert = pngToIco.default || pngToIco;

const rootDir = path.resolve(__dirname, '..');
const sourceImage = path.join(rootDir, 'Logo Nexus app.png');
const destIcon = path.join(rootDir, 'build', 'icon.ico');

convert(sourceImage)
  .then(buf => {
    fs.writeFileSync(destIcon, buf);
    console.log(`Icon converted successfully to ${destIcon}`);
  })
  .catch(console.error);
