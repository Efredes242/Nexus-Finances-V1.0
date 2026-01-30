const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'nexus-db';
const DUMP_FILE = 'prod_dump.sql';
const LOCAL_DB_PATH = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');
const SERVER_DB_PATH = path.join(__dirname, '..', 'server', 'finanzas.db');
const sqlite3 = require('sqlite3').verbose();

console.log('🔄 Starting Database Sync...');

try {
    // 1. Export Remote DB
    console.log('📥 Exporting production database...');
    execSync(`npx wrangler d1 export ${DB_NAME} --remote --output=./${DUMP_FILE}`, { stdio: 'inherit' });

    // 2. Clear Local DB State
    if (fs.existsSync(LOCAL_DB_PATH)) {
        console.log('🧹 Clearing local database state...');
        fs.rmSync(LOCAL_DB_PATH, { recursive: true, force: true });
    }


    // 3. Import to Local DB (Wrangler/D1)
    console.log('📤 Importing to local D1 (Wrangler)...');
    execSync(`npx wrangler d1 execute ${DB_NAME} --local --file=./${DUMP_FILE}`, { stdio: 'inherit' });

    // 4. Import to Local DB (Express/Electron)
    console.log('📤 Importing to local SQLite (Express/Server)...');
    if (fs.existsSync(SERVER_DB_PATH)) {
        fs.unlinkSync(SERVER_DB_PATH); // Delete existing DB
    }

    // Create new DB and apply dump
    const db = new sqlite3.Database(SERVER_DB_PATH);
    const sqlContent = fs.readFileSync(DUMP_FILE, 'utf-8');

    db.exec(sqlContent, (err) => {
        if (err) {
            console.error('❌ Error updating server DB:', err.message);
            process.exit(1);
        } else {
            console.log('✅ Server database updated successfully!');
            db.close();
            console.log('✅ All synchronizations complete!');
        }
    });

} catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
}
