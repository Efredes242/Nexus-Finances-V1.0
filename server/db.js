import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, 'finanzas.db');
console.log(`Using database at: ${dbPath}`);

// Enable verbose mode for debugging
const sql3 = sqlite3.verbose();
const db = new sql3.Database(dbPath);

// Helper functions to mimic better-sqlite3 behavior (but async)
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastInsertRowid: this.lastID });
    });
  });
};

// Initialization
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      name TEXT,
      amount REAL,
      category TEXT,
      tag TEXT,
      date TEXT,
      status TEXT,
      paymentMethod TEXT,
      month_year TEXT,
      cardName TEXT,
      financingPlan TEXT,
      originalAmount REAL,
      currency TEXT,
      exchangeRateEstimated REAL,
      exchangeRateActual REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT,
      targetAmount REAL,
      currentAmount REAL,
      deadline TEXT,
      icon TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      name TEXT,
      totalAmount REAL,
      installments INTEGER,
      startDate TEXT,
      description TEXT,
      category TEXT,
      cardName TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      must_change_password INTEGER DEFAULT 0
    )
  `);

  // Add user_id column to tables if not exists
  const addUserIdColumn = (table) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (!err && rows) {
        const hasUserId = rows.some(r => r.name === 'user_id');
        if (!hasUserId) {
          db.run(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`, (err) => {
            if (!err) console.log(`Added user_id to ${table}`);
          });
        }
      }
    });
  };

  ['entries', 'goals', 'installments'].forEach(addUserIdColumn);

  // Add missing columns to entries
  db.all(`PRAGMA table_info(entries)`, (err, rows) => {
    if (!err && rows) {
      const hasCardName = rows.some(r => r.name === 'cardName');
      const hasFinancingPlan = rows.some(r => r.name === 'financingPlan');

      if (!hasCardName) {
        db.run(`ALTER TABLE entries ADD COLUMN cardName TEXT`, (err) => {
          if (!err) console.log(`Added cardName to entries`);
        });
      }
      if (!hasFinancingPlan) {
        db.run(`ALTER TABLE entries ADD COLUMN financingPlan TEXT`, (err) => {
          if (!err) console.log(`Added financingPlan to entries`);
        });
      }

      const hasOriginalAmount = rows.some(r => r.name === 'originalAmount');
      const hasCurrency = rows.some(r => r.name === 'currency');
      const hasExchangeRateEstimated = rows.some(r => r.name === 'exchangeRateEstimated');
      const hasExchangeRateActual = rows.some(r => r.name === 'exchangeRateActual');

      if (!hasOriginalAmount) {
        db.run(`ALTER TABLE entries ADD COLUMN originalAmount REAL`, (err) => {
          if (!err) console.log(`Added originalAmount to entries`);
        });
      }
      if (!hasCurrency) {
        db.run(`ALTER TABLE entries ADD COLUMN currency TEXT`, (err) => {
          if (!err) console.log(`Added currency to entries`);
        });
      }
      if (!hasExchangeRateEstimated) {
        db.run(`ALTER TABLE entries ADD COLUMN exchangeRateEstimated REAL`, (err) => {
          if (!err) console.log(`Added exchangeRateEstimated to entries`);
        });
      }
      if (!hasExchangeRateActual) {
        db.run(`ALTER TABLE entries ADD COLUMN exchangeRateActual REAL`, (err) => {
          if (!err) console.log(`Added exchangeRateActual to entries`);
        });
      }
    }
  });

  // Add missing columns to users
  db.all(`PRAGMA table_info(users)`, (err, rows) => {
    if (!err && rows) {
      const hasEmail = rows.some(r => r.name === 'email');
      const hasGoogleId = rows.some(r => r.name === 'google_id');
      const hasAvatar = rows.some(r => r.name === 'avatar');
      const hasFirstName = rows.some(r => r.name === 'firstName');
      const hasLastName = rows.some(r => r.name === 'lastName');
      const hasBirthDate = rows.some(r => r.name === 'birthDate');

      if (!hasEmail) {
        db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
          if (!err) console.log(`Added email to users`);
        });
      }
      if (!hasGoogleId) {
        db.run(`ALTER TABLE users ADD COLUMN google_id TEXT`, (err) => {
          if (!err) console.log(`Added google_id to users`);
        });
      }
      if (!hasAvatar) {
        db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`, (err) => {
          if (!err) console.log(`Added avatar to users`);
        });
      }
      if (!hasFirstName) {
        db.run(`ALTER TABLE users ADD COLUMN firstName TEXT`, (err) => {
          if (!err) console.log(`Added firstName to users`);
        });
      }
      if (!hasLastName) {
        db.run(`ALTER TABLE users ADD COLUMN lastName TEXT`, (err) => {
          if (!err) console.log(`Added lastName to users`);
        });
      }
      if (!hasBirthDate) {
        db.run(`ALTER TABLE users ADD COLUMN birthDate TEXT`, (err) => {
          if (!err) console.log(`Added birthDate to users`);
        });
      }
    }
  });


  db.run(`
    CREATE TABLE IF NOT EXISTS user_configs (
      user_id TEXT PRIMARY KEY,
      currency TEXT,
      categories TEXT,
      creditCards TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

export default db;
