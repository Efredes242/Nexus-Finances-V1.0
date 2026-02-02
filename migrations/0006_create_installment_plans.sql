CREATE TABLE IF NOT EXISTS installment_plans (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount REAL NOT NULL,
    installments_count INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    payer_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM
    created_at INTEGER NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id),
    FOREIGN KEY(payer_id) REFERENCES users(id),
    FOREIGN KEY(debtor_id) REFERENCES users(id)
);
