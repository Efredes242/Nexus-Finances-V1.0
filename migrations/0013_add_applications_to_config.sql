-- Migration to add applications column to user_configs table
ALTER TABLE user_configs ADD COLUMN applications TEXT;
