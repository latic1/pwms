-- ============================================================
-- Task submission review — a supervisor can accept a submitted
-- task ("done") or decline it ("changes_requested") with a
-- required comment, so the student knows what to fix and can
-- resubmit (moves back to "under_review").
-- Migration: 013_task_review.sql
-- ============================================================

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'changes_requested';

ALTER TABLE tasks ADD COLUMN supervisor_comment TEXT;
