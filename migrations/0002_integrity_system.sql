-- Create pending_approvals table
CREATE TABLE IF NOT EXISTS pending_approvals (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    target_expense_id TEXT,
    action_type TEXT NOT NULL, -- 'EDIT', 'DELETE'
    data_payload TEXT, -- JSON string
    reason TEXT,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TEXT NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
    FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_approvals_party ON pending_approvals(party_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
