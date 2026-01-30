-- Create Party Tables

CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS party_members (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    user_id TEXT, -- Nullable initially (e.g. email invite)
    status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
    invited_email TEXT,
    joined_at TEXT NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS party_expenses (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    payer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    participants TEXT, -- JSON array of user_ids
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_party_members_user ON party_members(user_id);
CREATE INDEX IF NOT EXISTS idx_party_expenses_party ON party_expenses(party_id);
