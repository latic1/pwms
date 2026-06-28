-- ============================================================
-- FYP-WMS — Announcements & Public Project Tags
-- Migration: 003_announcements.sql
-- ============================================================

CREATE TYPE announcement_type AS ENUM ('info', 'warning', 'deadline', 'success');

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  type         announcement_type NOT NULL DEFAULT 'info',
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_published ON announcements(published_at) WHERE published_at IS NOT NULL;

-- Seed two starter announcements (reference the admin user from seed 002)
INSERT INTO announcements (title, body, type, pinned, published_at, created_by) VALUES
  (
    'Welcome to FYP-WMS 2024/2025',
    'The Final Year Project Work Management System is now open. Students can begin forming groups and submitting proposals.',
    'success',
    TRUE,
    NOW(),
    'a1b2c3d4-0000-0000-0000-000000000030'
  ),
  (
    'Group Formation Deadline — 31 January 2025',
    'All students must be in a registered group by 31 January 2025. Groups formed after this date will not be accepted.',
    'deadline',
    TRUE,
    NOW(),
    'a1b2c3d4-0000-0000-0000-000000000030'
  );
