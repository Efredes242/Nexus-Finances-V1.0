-- Migration 0010: Add tracking fields and set admin role
-- Adds created_at and last_login_at columns to users table
-- Updates the main admin user's role

-- Add created_at column (nullable to avoid non-constant default error)
ALTER TABLE users ADD COLUMN created_at TEXT;

-- Add last_login_at column (nullable)
ALTER TABLE users ADD COLUMN last_login_at TEXT;

-- Set created_at for ALL existing users to the current time (since we don't know the real original date)
-- SQLite's datetime('now') is evaluated at execution time, which fits our needs here
UPDATE users SET created_at = datetime('now');

-- Set specific user as ADMIN
UPDATE users SET role = 'admin' WHERE email = 'ezequiel.fredes.mondragon@gmail.com';
