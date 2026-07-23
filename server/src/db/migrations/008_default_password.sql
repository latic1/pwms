-- ============================================================
-- Force a password change on first login.
-- New accounts (students created with the shared default password,
-- plus any admin-generated temp password) are flagged so the client
-- can require a password change before granting access.
-- Migration: 008_default_password.sql
-- ============================================================

ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
