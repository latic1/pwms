-- ============================================================
-- FYP Work Management System — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('student', 'supervisor', 'admin', 'examiner');

CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'under_review', 'done');

CREATE TYPE document_type AS ENUM ('proposal', 'progress_report', 'final_report', 'supporting');

CREATE TYPE meeting_status AS ENUM ('proposed', 'confirmed', 'completed');

CREATE TYPE grader_role AS ENUM ('supervisor', 'examiner');

-- ============================================================
-- ACADEMIC PERIODS
-- ============================================================

CREATE TABLE academic_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  group_deadline      DATE NOT NULL,
  proposal_deadline   DATE NOT NULL,
  submission_deadline DATE NOT NULL,
  grades_released     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  -- Student-specific fields (NULL for non-students)
  index_number  VARCHAR(20)  UNIQUE,
  department    VARCHAR(100),
  program       VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_index_number ON users(index_number);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GROUPS
-- ============================================================

CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  invite_code   VARCHAR(20)  NOT NULL UNIQUE,
  leader_id     UUID NOT NULL REFERENCES users(id),
  supervisor_id UUID REFERENCES users(id),
  period_id     UUID REFERENCES academic_periods(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_invite_code   ON groups(invite_code);
CREATE INDEX idx_groups_leader_id     ON groups(leader_id);
CREATE INDEX idx_groups_supervisor_id ON groups(supervisor_id);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user_id ON group_members(user_id);

-- ============================================================
-- PROPOSALS
-- ============================================================

CREATE TABLE proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  abstract      TEXT NOT NULL,
  file_url      TEXT,
  status        proposal_status NOT NULL DEFAULT 'pending',
  version       INTEGER NOT NULL DEFAULT 1,
  supervisor_comment TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposals_group_id ON proposals(group_id);
CREATE INDEX idx_proposals_status   ON proposals(status);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id),
  status      task_status NOT NULL DEFAULT 'pending',
  due_date    DATE,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_group_id   ON tasks(group_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status     ON tasks(status);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  type        document_type NOT NULL DEFAULT 'supporting',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_group_id ON documents(group_id);
CREATE INDEX idx_documents_type     ON documents(type);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_group_id ON messages(group_id);
CREATE INDEX idx_messages_sent_at  ON messages(sent_at);

-- ============================================================
-- MEETINGS
-- ============================================================

CREATE TABLE meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES users(id),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        meeting_status NOT NULL DEFAULT 'proposed',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meetings_group_id      ON meetings(group_id);
CREATE INDEX idx_meetings_supervisor_id ON meetings(supervisor_id);
CREATE INDEX idx_meetings_scheduled_at  ON meetings(scheduled_at);

-- ============================================================
-- GRADES
-- ============================================================

CREATE TABLE grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grader_id   UUID NOT NULL REFERENCES users(id),
  grader_role grader_role NOT NULL,
  score       NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  rubric      JSONB NOT NULL DEFAULT '{}',
  feedback    TEXT,
  graded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, grader_id)   -- one grade per grader per group
);

CREATE INDEX idx_grades_group_id ON grades(group_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50)  NOT NULL,
  target_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id    ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at DESC);
