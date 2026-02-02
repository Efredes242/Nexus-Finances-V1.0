-- Migration: Add member_nicknames table for user-specific member aliases
-- Each user can assign custom nicknames to party members (only visible to them)

CREATE TABLE IF NOT EXISTS member_nicknames (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, party_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_nicknames_user_party ON member_nicknames(user_id, party_id);
