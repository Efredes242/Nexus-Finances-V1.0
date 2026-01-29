const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const localesDir = path.join(rootDir, 'dist-stage-v2', 'Nexus Finances-win32-x64', 'locales');

if (fs.existsSync(localesDir)) {
    console.log('Cleaning up unused locales...');
    const files = fs.readdirSync(localesDir);
    const keep = ['es.pak', 'es-419.pak', 'en-US.pak', 'en-GB.pak'];
    
    let deletedCount = 0;
    files.forEach(file => {
        if (!keep.includes(file)) {
            fs.unlinkSync(path.join(localesDir, file));
            deletedCount++;
        }
    });
    console.log(`Deleted ${deletedCount} unused locale files.`);
} else {
    console.log('Locales directory not found, skipping cleanup.');
}
