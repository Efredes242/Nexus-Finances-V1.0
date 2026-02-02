-- Create new table without restrictive FKs and with participants column
CREATE TABLE IF NOT EXISTS installment_plans_new (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount REAL NOT NULL,
    installments_count INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    payer_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    participants TEXT, -- JSON array of participant IDs
    start_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id)
);

-- Copy data from old table
-- Note: We initialize participants with a JSON array containing the debtor_id for backward compatibility
INSERT INTO installment_plans_new (id, party_id, description, total_amount, installments_count, installment_amount, payer_id, debtor_id, participants, start_date, created_at)
SELECT id, party_id, description, total_amount, installments_count, installment_amount, payer_id, debtor_id, '["' || debtor_id || '"]', start_date, created_at
FROM installment_plans;

-- Drop old table
DROP TABLE installment_plans;

-- Rename new table
ALTER TABLE installment_plans_new RENAME TO installment_plans;
