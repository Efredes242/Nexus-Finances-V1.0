const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nsisPath = 'C:\\Users\\ezequ\\AppData\\Local\\electron-builder\\Cache\\nsis\\nsis-3.0.4.1-nsis-3.0.4.1\\Bin\\makensis.exe';

async function build() {
    try {
        console.log('1. Cleaning environment...');
        if (fs.existsSync(path.join(rootDir, 'dist-stage-v2'))) {
            fs.removeSync(path.join(rootDir, 'dist-stage-v2'));
        }

        console.log('2. Building Vite frontend...');
        execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

        console.log('3. Packaging Electron app (Physical Disk Style)...');

        const ignores = [
            '/src($|/)',
            '/public($|/)',
            '/trash_.*',
            '/release-builds($|/)',
            '/BACKUPS-FUNCIONALES($|/)',
            '/Instaladores.*',
            '/scripts($|/)',
            '/\\.git($|/)',
            '/tsconfig\\.json$',
            '/vite\\.config\\.ts$',
            '/build($|/)',
            '/node_modules/\\.cache',
            '/server/finanzas\\.db$',
            '/Nexus.*DEMO($|/)',
            '/nexus-pagina.*',
            '/Nexus-app($|/)',
            '\\.rar$',
            '\\.zip$',
            '\\.7z$',
            'Logo.*\\.png$',
            'Icono.*\\.ico$',
            '\\.md$',
            '\\.env.*',
            '\\.gitignore$'
        ];

        const ignoreArg = `^/(${ignores.join('|')})`;

        // NO ASAR - We need direct access to server/index.js
        const packCmd = [
            'npx electron-packager .',
            '\"Nexus Finances\"',
            '--platform=win32',
            '--arch=x64',
            '--icon=build/icon.ico',
            '--out=dist-stage-v2',
            '--overwrite',
            '--prune=true',
            `--ignore=\"${ignoreArg}\"`
        ].join(' ');

        execSync(packCmd, { stdio: 'inherit', cwd: rootDir });

        console.log('4. Pruning heavy dependencies in staged app...');
        const stagedAppDir = path.join(rootDir, 'dist-stage-v2', 'Nexus Finances-win32-x64', 'resources', 'app');
        const googleApisDir = path.join(stagedAppDir, 'node_modules', 'googleapis', 'build', 'src', 'apis');

        if (fs.existsSync(googleApisDir)) {
            console.log('Removing unused Google APIs to stay under NSIS limits...');
            const apis = fs.readdirSync(googleApisDir);
            const keep = ['drive', 'oauth2', 'index.js', 'index.d.ts'];
            let removedCount = 0;
            for (const api of apis) {
                if (!keep.includes(api)) {
                    fs.removeSync(path.join(googleApisDir, api));
                    removedCount++;
                }
            }
            console.log(`Removed ${removedCount} unused API modules.`);
        }

        console.log('5. Cleaning up locales...');
        const localesDir = path.join(rootDir, 'dist-stage-v2', 'Nexus Finances-win32-x64', 'locales');
        if (fs.existsSync(localesDir)) {
            const files = fs.readdirSync(localesDir);
            const keep = ['es.pak', 'es-419.pak', 'en-US.pak', 'en-GB.pak'];
            files.forEach(file => {
                if (!keep.includes(file)) fs.unlinkSync(path.join(localesDir, file));
            });
        }

        console.log('6. Building final NSIS installer...');
        const installerOutDir = path.join(rootDir, 'dist-installer-final');
        if (!fs.existsSync(installerOutDir)) fs.mkdirSync(installerOutDir, { recursive: true });

        execSync(`"${nsisPath}" build\\installer.nsi`, { stdio: 'inherit', cwd: rootDir });

        console.log('✅ BUILD COMPLETE! Installer located in dist-installer-final/NexusFinancesSetup.exe');

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
