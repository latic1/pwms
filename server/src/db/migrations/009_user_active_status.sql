-- ============================================================
-- Deactivate instead of hard-delete users.
-- Users with any history (group membership/leadership, tasks,
-- documents, messages, grades) cannot be hard-deleted — most of
-- those foreign keys don't cascade, by design, so the records stay
-- intact for the audit trail. "Remove user" now flips this flag
-- instead: the account is signed out, blocked from logging back in,
-- and hidden from active pick-lists, but everything they created is
-- preserved and an admin can reactivate them later.
-- Migration: 009_user_active_status.sql
-- ============================================================

ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_users_is_active ON users(is_active);
