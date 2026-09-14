-- ============================================================
-- Meeting location — a scheduled meeting is either in-person
-- (with a venue) or online (with a meeting link).
-- Migration: 014_meeting_location.sql
-- ============================================================

CREATE TYPE meeting_type AS ENUM ('in_person', 'online');

ALTER TABLE meetings ADD COLUMN meeting_type meeting_type NOT NULL DEFAULT 'in_person';
ALTER TABLE meetings ADD COLUMN venue        TEXT;
ALTER TABLE meetings ADD COLUMN meeting_link TEXT;
