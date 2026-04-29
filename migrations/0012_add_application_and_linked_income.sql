-- Migration to add application and linked_income_id columns to entries and installments tables
ALTER TABLE entries ADD COLUMN application TEXT;
ALTER TABLE installments ADD COLUMN application TEXT;
ALTER TABLE installments ADD COLUMN linked_income_id TEXT;
