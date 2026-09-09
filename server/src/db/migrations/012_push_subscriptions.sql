-- ============================================================
-- Web Push subscriptions — lets the server deliver notifications
-- to a browser even when the app tab isn't open/focused.
-- One row per browser/device the user has enabled notifications on.
-- Migration: 012_push_subscriptions.sql
-- ============================================================

CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
