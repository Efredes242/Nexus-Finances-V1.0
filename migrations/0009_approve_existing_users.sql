-- Migration 0009: Hotfix - Approve all existing users
-- Fixes issue where existing users were set to PENDING instead of APPROVED

-- Set ALL current users to APPROVED status
-- This ensures existing users (created before this approval system) can continue accessing the app
UPDATE users SET approval_status = 'APPROVED';
