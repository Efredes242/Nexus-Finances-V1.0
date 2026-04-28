const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_NAME = 'nexus-db';
const DUMP_FILE = 'prod_dump.sql';
const LOCAL_Wrangler_D1_PATH = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');
const SERVER_DB_PATH = path.join(__dirname, '..', 'server', 'finanzas.db');

console.log('🔄 Starting Database Sync from Cloudflare D1...');

async function runSync() {
    try {
        // 1. Export Remote DB
        console.log('📥 1/4: Exporting production database...');
        try {
            execSync(`npx wrangler d1 export ${DB_NAME} --remote --output=./${DUMP_FILE}`, { stdio: 'inherit' });
        } catch (e) {
            console.error('❌ Error exporting from remote D1. Ensure you are logged in (wrangler login).');
            process.exit(1);
        }

        if (!fs.existsSync(DUMP_FILE)) {
            console.error('❌ Dump file was not created.');
            process.exit(1);
        }

        // 2. Clear Local Wrangler D1 State (Optional but good for clean state)
        if (fs.existsSync(LOCAL_Wrangler_D1_PATH)) {
            console.log('🧹 2/4: Clearing local Wrangler D1 state...');
            try {
                fs.rmSync(LOCAL_Wrangler_D1_PATH, { recursive: true, force: true });
            } catch (e) {
                console.warn('⚠️ Could not clear .wrangler state (might be in use), skipping...');
            }
        }

        // 3. Import to Local D1 (Wrangler/Mini-flare)
        console.log('📤 3/4: Importing to local D1 (Wrangler)...');
        try {
            // Note: We ignore errors here because D1 local might complain about some PRAGMAs but still work
            execSync(`npx wrangler d1 execute ${DB_NAME} --local --file=./${DUMP_FILE}`, { stdio: 'inherit' });
        } catch (e) {
            console.warn('⚠️ Local D1 import had some issues, continuing with Server DB sync...');
        }

        // 4. Import to Local SQLite (Express Server)
        console.log('📤 4/4: Importing to local SQLite (Express/Server)...');
        const db = new sqlite3.Database(SERVER_DB_PATH);

        db.serialize(() => {
            // Disable foreign keys temporarily to allow dropping tables in any order
            db.run("PRAGMA foreign_keys = OFF");

            // Get all user tables
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
                if (err) {
                    console.error('❌ Error listing tables:', err.message);
                    process.exit(1);
                }

                // Drop all tables
                tables.forEach(table => {
                    db.run(`DROP TABLE IF EXISTS "${table.name}"`);
                });

                // Read dump and execute
                const sqlContent = fs.readFileSync(DUMP_FILE, 'utf-8');

                // Remove PRAGMAs that might cause issues if they come from D1 dump
                // (Optional: D1 dump is usually compatible, but we wrap in exec)
                db.exec(sqlContent, (err) => {
                    if (err) {
                        console.error('❌ Error executing dump on server DB:', err.message);
                        db.run("PRAGMA foreign_keys = ON");
                        db.close();
                        process.exit(1);
                    } else {
                        console.log('✅ Server database updated successfully!');
                        
                        // RE-INITIALIZE TABLES THAT MIGHT BE MISSING FROM PRODUCTION
                        db.run(`
                            CREATE TABLE IF NOT EXISTS party_nicknames (
                                party_id TEXT NOT NULL,
                                member_id TEXT NOT NULL,
                                nickname TEXT NOT NULL,
                                PRIMARY KEY (party_id, member_id),
                                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
                            )
                        `, (createErr) => {
                            if (createErr) console.warn('⚠️ Could not recreate party_nicknames:', createErr.message);
                            
                            db.run("PRAGMA foreign_keys = ON");
                            db.close();
                            console.log('✨ Database synchronization complete!');

                            // Clean up dump file
                            try { fs.unlinkSync(DUMP_FILE); } catch (e) { }
                        });
                    }
                });
            });
        });

    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        process.exit(1);
    }
}

runSync();
