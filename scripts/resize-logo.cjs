const { Jimp } = require('jimp');
const path = require('path');

async function resizeLogo() {
    const inputPath = path.join(__dirname, '..', 'Logo Nexus app.png');
    const outputPath = path.join(__dirname, '..', 'google-consent-logo.png');

    console.log('Jimp object:', Jimp);

    try {
        const image = await Jimp.read(inputPath);
        
        // Resize to 120x120
        image.resize({ w: 120, h: 120 });
        
        await image.write(outputPath);
        
        console.log(`Image created successfully at: ${outputPath}`);
    } catch (err) {
        console.error('Error processing image:', err);
        // Fallback for older/different Jimp versions if needed
        try {
             const JimpOld = require('jimp');
             const image2 = await JimpOld.read(inputPath);
             image2.resize(120, 120);
             await image2.writeAsync(outputPath);
             console.log(`Image created successfully (fallback) at: ${outputPath}`);
        } catch (err2) {
             console.error('Fallback failed too:', err2);
        }
    }
}

resizeLogo();