-- ============================================================
-- Panels — groups of supervisors that examine student groups.
-- Replaces the standalone 'examiner' user role:
--   * examiner users become supervisors
--   * examiner grades become 'panel' grades
--   * groups get an assigned panel (groups.panel_id)
-- Migration: 006_panels.sql
-- ============================================================

-- 1. Panels and membership
CREATE TABLE panels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE panel_members (
  panel_id  UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (panel_id, user_id)
);

CREATE INDEX idx_panel_members_user_id ON panel_members(user_id);

ALTER TABLE groups ADD COLUMN panel_id UUID REFERENCES panels(id) ON DELETE SET NULL;
CREATE INDEX idx_groups_panel_id ON groups(panel_id);

-- 2. Convert existing examiner users to supervisors
UPDATE users SET role = 'supervisor' WHERE role = 'examiner';

-- 3. Rebuild user_role enum without 'examiner'
ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('student', 'supervisor', 'admin');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;

-- 4. Rebuild grader_role enum: 'examiner' becomes 'panel'
ALTER TYPE grader_role RENAME TO grader_role_old;
CREATE TYPE grader_role AS ENUM ('supervisor', 'panel');
ALTER TABLE grades
  ALTER COLUMN grader_role TYPE grader_role
  USING (CASE grader_role::text WHEN 'examiner' THEN 'panel' ELSE grader_role::text END)::grader_role;
DROP TYPE grader_role_old;
