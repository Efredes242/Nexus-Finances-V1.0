-- Migration 0011: Add linked_income_id to entries table
ALTER TABLE entries ADD COLUMN linked_income_id TEXT;
