const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

async function build() {
    console.log('Starting Manual NSIS Installer Build...');

    const rootDir = path.resolve(__dirname, '..');
    const distDir = path.join(rootDir, 'dist-installer-final');
    const packagerDir = path.join(rootDir, 'dist-stage-v2', 'Nexus Finances-win32-x64');
    const nsiFile = path.join(rootDir, 'build', 'installer.nsi');

    // 1. Verify Source
    if (!fs.existsSync(packagerDir)) {
        console.error(`Error: Source directory not found: ${packagerDir}`);
        console.error('Please run "npm run electron:pack" first.');
        process.exit(1);
    }

    // 2. Create Output Directory
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // 3. Find makensis.exe
    const cacheDir = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'nsis');
    let makensisPath = null;

    if (fs.existsSync(cacheDir)) {
        const entries = fs.readdirSync(cacheDir);
        for (const entry of entries) {
            if (entry.startsWith('nsis-')) {
                const potentialPath = path.join(cacheDir, entry, 'Bin', 'makensis.exe');
                if (fs.existsSync(potentialPath)) {
                    makensisPath = potentialPath;
                    break;
                }
                // Check for nested structure nsis-x.y.z/nsis-x.y.z/Bin
                const potentialPathDirect = path.join(cacheDir, entry, 'Bin', 'makensis.exe');
                if (fs.existsSync(potentialPathDirect)) {
                   makensisPath = potentialPathDirect;
                   break;
               }
            }
        }
    }

    // Fallback or explicit check if not found in loop (since logic above is slightly loose)
    // Actually, let's just use the one we found before if the loop fails or check specific common paths.
    // The previous run log showed: ...\nsis-3.0.4.1-nsis-3.0.4.1\Bin\makensis.exe
    if (!makensisPath) {
        // Try to find recursively or just fail
        console.log('Searching deeper for makensis.exe...');
         // Simple fallback for the specific version seen in logs
        const specificPath = path.join(cacheDir, 'nsis-3.0.4.1-nsis-3.0.4.1', 'Bin', 'makensis.exe');
        if (fs.existsSync(specificPath)) {
            makensisPath = specificPath;
        }
    }

    if (!makensisPath) {
        console.error('Error: makensis.exe not found. Please ensure electron-builder has downloaded NSIS.');
        process.exit(1);
    }

    console.log(`Using makensis: ${makensisPath}`);

    // 4. Run makensis
    const nsisConf = path.join(path.dirname(path.dirname(makensisPath)), 'nsisconf.nsh');
    
    // We need to pass the output path to the script or let it use its default.
    // The script currently outputs to "dist-installer-final\NexusFinancesSetup.exe" relative to where it is run?
    // The .nsi script has `OutFile "..\dist-installer-final\NexusFinancesSetup.exe"`
    // Since we are running makensis on the file, the relative paths in .nsi are relative to the .nsi file location usually,
    // OR relative to CWD.
    // Let's assume the .nsi paths are correct relative to `build/` if we don't change them.
    // `OutFile "..\dist-installer-final\NexusFinancesSetup.exe"` means `build/../dist-installer-final` -> `dist-installer-final`. Correct.
    
    const child = spawn(makensisPath, [nsiFile], {
        stdio: 'inherit',
        cwd: rootDir // Run from root so relative paths in .nsi (like "..\dist-installer-final") work correctly
    });

    child.on('close', (code) => {
        if (code === 0) {
            console.log('--------------------------------------------------');
            console.log('Installer created successfully!');
            console.log(`Location: ${path.join(distDir, 'NexusFinancesSetup.exe')}`);
            console.log('--------------------------------------------------');
        } else {
            console.error(`makensis exited with code ${code}`);
        }
    });
}

build();
