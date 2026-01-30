import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'server', 'finanzas.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error("Error opening DB:", err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("--- Users ---");
    db.each("SELECT id, username, email, google_id FROM users", (err, row) => {
        if (err) console.error(err);
        else console.log(row);
    });

    console.log("\n--- Entries Count ---");
    db.get("SELECT COUNT(*) as count FROM entries", (err, row) => {
        if (err) console.error(err);
        else console.log(`Total Entries: ${row.count}`);
    });

    console.log("\n--- Entries Preview (First 5) ---");
    db.each("SELECT id, name, amount, user_id FROM entries LIMIT 5", (err, row) => {
        if (err) console.error(err);
        else console.log(row);
    });
});

db.close();
