-- Migration 0008: Add user approval system
-- Adds approval_status column to users table for admin approval workflow

-- Add approval_status column with default PENDING for new users
ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'PENDING' CHECK(approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Set all existing users to APPROVED status (they're already using the app)
UPDATE users SET approval_status = 'APPROVED' WHERE approval_status IS NULL;

-- Add index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- Add timestamp for when approval decision was made
ALTER TABLE users ADD COLUMN approval_decision_at TEXT;
ALTER TABLE users ADD COLUMN approval_decision_by TEXT; -- Admin user ID who made decision
