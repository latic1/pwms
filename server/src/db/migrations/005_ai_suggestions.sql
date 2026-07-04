-- Migration: 005_ai_suggestions.sql
-- AI-assisted topic suggestions + supervisor matching:
--   users.expertise lets supervisors list keywords (comma-separated) used for matching
--   topic_suggestions stores each AI-generated suggestion set for history/audit

ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise TEXT;

CREATE TABLE topic_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interests    TEXT NOT NULL,
  suggestions  JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_topic_suggestions_requested_by ON topic_suggestions(requested_by);
