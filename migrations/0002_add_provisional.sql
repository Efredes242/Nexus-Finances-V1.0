-- Migration number: 0002 	 2024-01-29T17:35:00Z
ALTER TABLE entries ADD COLUMN is_provisional INTEGER DEFAULT 0;
