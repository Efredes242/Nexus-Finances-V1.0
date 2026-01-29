const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '..', 'BACKUPS-FUNCIONALES');
const SOURCE_DIR = path.join(__dirname, '..');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// 1. Determine next version
const files = fs.readdirSync(BACKUP_DIR);
const versionRegex = /backup-funcional-v(\d+)\.(\d+)\.zip/;
let maxMajor = 0;
let maxMinor = 0;

files.forEach(file => {
    const match = file.match(versionRegex);
    if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
            maxMajor = major;
            maxMinor = minor;
        }
    }
});

// Increment version (Minor bump by default)
const nextVersion = `${maxMajor}.${maxMinor + 1}`;
const zipName = `backup-funcional-v${nextVersion}.zip`;
const zipPath = path.join(BACKUP_DIR, zipName);

console.log(`Creating backup: ${zipName}...`);

// 2. Create Zip (using 7zip or powershell compress-archive if available, or a node library? 
// Since we don't want to add dependencies like archiver if not absolutely necessary, let's try powershell first as it's Windows)

const excludeList = [
    'node_modules',
    'dist',
    'dist-electron',
    'dist-packed',
    'dist-installer-clean',
    'dist-installer-final',
    'dist-stage-v2',
    'release-builds',
    'BACKUPS-FUNCIONALES',
    '.git',
    'trash_*',
    'Instaladores',
    'build' // Maybe exclude build output? keeping src and config is enough
];

// Construct PowerShell exclusion list
const excludeArgs = excludeList.map(item => `"${item}"`).join(', ');

// Powershell command to zip
// Note: PowerShell's Compress-Archive is a bit slow and can be tricky with exclusions.
// Let's use a simpler approach: Copy desired files to a temp folder, then zip that folder.
const tempDir = path.join(BACKUP_DIR, `temp_${Date.now()}`);

try {
    fs.mkdirSync(tempDir);

    // Copy files manually to control exclusions strictly
    const items = fs.readdirSync(SOURCE_DIR);

    items.forEach(item => {
        if (excludeList.some(excluded => {
            if (excluded.endsWith('*')) return item.startsWith(excluded.replace('*', ''));
            return item === excluded;
        })) return;

        const srcPath = path.join(SOURCE_DIR, item);
        const destPath = path.join(tempDir, item);

        // Use robocopy for speed or cp -r
        // Node's fs.cpSync is available in newer versions (v16.7+). User environment likely has it.
        try {
            fs.cpSync(srcPath, destPath, { recursive: true });
        } catch (e) {
            console.error(`Failed to copy ${item}: ${e.message}`);
        }
    });

    console.log('Files copied to temp directory. Zipping...');

    // Zip the temp directory content
    execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`);

    console.log('Backup created successfully.');

} catch (error) {
    console.error('Error creating backup:', error);
} finally {
    // Cleanup temp dir
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
        // ignore
    }
}

// 3. Cleanup old backups (Keep last 3)
const updatedFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.match(versionRegex)).sort();
// Sorting strings with numbers might be tricky (v10 vs v2), but let's assume standard lexicographical for now or parse.
// Better sort by creating version objects
const sortedBackups = updatedFiles.map(f => {
    const match = f.match(versionRegex);
    return {
        name: f,
        major: parseInt(match[1]),
        minor: parseInt(match[2])
    };
}).sort((a, b) => {
    if (a.major !== b.major) return a.major - b.major;
    return a.minor - b.minor;
});

// Keep last 3
if (sortedBackups.length > 3) {
    const toDelete = sortedBackups.slice(0, sortedBackups.length - 3);
    toDelete.forEach(backup => {
        console.log(`Deleting old backup: ${backup.name}`);
        fs.unlinkSync(path.join(BACKUP_DIR, backup.name));
    });
}
