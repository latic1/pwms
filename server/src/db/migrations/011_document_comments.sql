-- ============================================================
-- Comments on uploaded documents — lets a supervisor or panel
-- member leave feedback directly on a specific file (progress
-- report, final report, etc.), separate from the group chat.
-- Migration: 011_document_comments.sql
-- ============================================================

CREATE TABLE document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_comments_document_id ON document_comments(document_id);
