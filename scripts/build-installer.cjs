const electronInstaller = require('electron-winstaller');
const path = require('path');
const fs = require('fs');

// --- Helper Functions for Progress ---
let spinnerInterval;
let startTime;

function startSpinner(message) {
  const chars = ['|', '/', '-', '\\'];
  let i = 0;
  startTime = Date.now();
  
  process.stdout.write(`${message}  `);
  
  spinnerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = `${mins}m ${secs}s`;
    
    process.stdout.write(`\r${message} ${chars[i++ % chars.length]} [${timeStr}]`);
  }, 250);
}

function stopSpinner(success = true) {
  clearInterval(spinnerInterval);
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  process.stdout.write(`\r${success ? 'Done' : 'Failed'}! [Total time: ${mins}m ${secs}s]      \n`);
}
// -------------------------------------

async function build() {
  console.log('Starting installer build process...');
  
  const rootPath = path.resolve(__dirname, '..');
  // Original source from electron-packager
  const sourceDir = path.join(rootPath, 'dist-stage-v2', 'Nexus Finances-win32-x64');
  // Staging directory with NO SPACES to avoid NuGet/Squirrel issues
  const stagingDir = path.join(rootPath, 'dist-stage-squirrel-v2');
  
  const outputDirectory = path.join(rootPath, 'dist-installer-squirrel');
  const setupIcon = path.join(rootPath, 'build', 'icon.ico');

  // 1. Verify source exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`CRITICAL ERROR: Source directory not found at: ${sourceDir}`);
    console.error('Please run "npm run electron:pack" first.');
    return;
  }

  // 2. Prepare staging directory (Space-free path)
  if (fs.existsSync(stagingDir)) {
      console.log('Cleaning staging directory...');
      fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  
  console.log(`Copying files to staging directory: ${stagingDir}`);
  // We need to copy sourceDir to stagingDir
  // Windows copy command or fs.cpSync (Node 16.7+)
  try {
      fs.cpSync(sourceDir, stagingDir, { recursive: true });
  } catch (e) {
      console.error('Error copying files:', e);
      return;
  }
  
  // 3. Rename executable if needed (e.g. "Nexus Finances.exe" -> "NexusFinances.exe")
  // Squirrel doesn't like spaces in EXE names either
  const oldExe = path.join(stagingDir, 'Nexus Finances.exe');
  const newExe = path.join(stagingDir, 'NexusFinances.exe');
  if (fs.existsSync(oldExe)) {
      fs.renameSync(oldExe, newExe);
  }

  console.log('Creating installer...');

  try {
    startSpinner('Building Squirrel Installer');
    await electronInstaller.createWindowsInstaller({
      appDirectory: stagingDir,
      outputDirectory: outputDirectory,
      authors: 'Nexus Finances Team',
      exe: 'NexusFinances.exe',
      setupExe: 'NexusFinancesSetup.exe',
      setupIcon: setupIcon,
      noMsi: true,
      description: 'Aplicación Profesional de Finanzas Personales'
    });
    stopSpinner(true);
    console.log(`Installer created successfully at: ${path.join(outputDirectory, 'NexusFinancesSetup.exe')}`);
  } catch (e) {
    stopSpinner(false);
    console.error(`No dice: ${e.message}`);
  }
}

build();
