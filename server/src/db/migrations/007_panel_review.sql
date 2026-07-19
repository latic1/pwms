-- ============================================================
-- Panel review duties:
--   * proposals gain a 'changes_requested' review outcome
--   * groups gain panel sign-off on final results, required
--     before an admin can release a period's grades
-- Migration: 007_panel_review.sql
-- ============================================================

ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'changes_requested';

ALTER TABLE groups ADD COLUMN result_approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE groups ADD COLUMN result_approved_at TIMESTAMPTZ;
