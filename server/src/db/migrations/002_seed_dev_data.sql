-- ============================================================
-- FYP-WMS — Development Seed Data
-- Migration: 002_seed_dev_data.sql
-- Passwords are all: password
-- bcrypt hash of 'password' with 10 rounds
-- ============================================================

-- Academic Period
INSERT INTO academic_periods (id, name, group_deadline, proposal_deadline, submission_deadline, grades_released)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Academic Year 2024/2025',
  '2025-01-31',
  '2025-02-15',
  '2025-05-30',
  FALSE
);

-- Users (password: password)
-- Students include index_number, department, program
INSERT INTO users (id, name, email, password_hash, role, index_number, department, program) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000010', 'Alice Johnson',    'alice@student.edu',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'CS/2021/001', 'Computer Science', 'BSc Computer Science'),
  ('a1b2c3d4-0000-0000-0000-000000000011', 'Bob Smith',        'bob@student.edu',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'CS/2021/002', 'Computer Science', 'BSc Computer Science'),
  ('a1b2c3d4-0000-0000-0000-000000000012', 'Carol White',      'carol@student.edu',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'IT/2021/015', 'Information Technology', 'BSc Information Technology'),
  ('a1b2c3d4-0000-0000-0000-000000000020', 'Dr. James Okafor', 'james@faculty.edu',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor', NULL, NULL, NULL),
  ('a1b2c3d4-0000-0000-0000-000000000021', 'Prof. Linda Tan',  'linda@faculty.edu',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor', NULL, NULL, NULL),
  ('a1b2c3d4-0000-0000-0000-000000000030', 'Admin User',       'admin@uni.edu',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',    NULL, NULL, NULL),
  ('a1b2c3d4-0000-0000-0000-000000000040', 'Dr. Paul Examiner','paul@faculty.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'examiner', NULL, NULL, NULL);

-- Group
INSERT INTO groups (id, name, invite_code, leader_id, supervisor_id, period_id) VALUES
  (
    'a1b2c3d4-0000-0000-0000-000000000100',
    'Team Alpha',
    'ALPHA-7X2K',
    'a1b2c3d4-0000-0000-0000-000000000010',
    'a1b2c3d4-0000-0000-0000-000000000020',
    'a1b2c3d4-0000-0000-0000-000000000001'
  );

-- Group Members
INSERT INTO group_members (group_id, user_id) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000100', 'a1b2c3d4-0000-0000-0000-000000000010'),
  ('a1b2c3d4-0000-0000-0000-000000000100', 'a1b2c3d4-0000-0000-0000-000000000011'),
  ('a1b2c3d4-0000-0000-0000-000000000100', 'a1b2c3d4-0000-0000-0000-000000000012');

-- Proposal
INSERT INTO proposals (id, group_id, title, abstract, status, version, supervisor_comment) VALUES
  (
    'a1b2c3d4-0000-0000-0000-000000000200',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'FYP Work Management System',
    'A web-based system to manage final year projects including group formation, proposal submission, task tracking, and grading.',
    'pending',
    2,
    'Please add more detail to the methodology section.'
  );

-- Tasks
INSERT INTO tasks (id, group_id, title, description, assignee_id, status, due_date, created_by) VALUES
  (
    'a1b2c3d4-0000-0000-0000-000000000301',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'Set up project repository',
    'Initialize GitHub repo with folder structure and README.',
    'a1b2c3d4-0000-0000-0000-000000000010',
    'done', '2025-02-10',
    'a1b2c3d4-0000-0000-0000-000000000010'
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000302',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'Design database schema',
    'Draft ER diagram covering all entities.',
    'a1b2c3d4-0000-0000-0000-000000000011',
    'in_progress', '2025-02-20',
    'a1b2c3d4-0000-0000-0000-000000000020'
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000303',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'Write literature review',
    'Survey at least 10 related systems and summarize findings.',
    'a1b2c3d4-0000-0000-0000-000000000012',
    'pending', '2025-02-25',
    'a1b2c3d4-0000-0000-0000-000000000020'
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000304',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'Build authentication module',
    'Implement login and role-based routing.',
    'a1b2c3d4-0000-0000-0000-000000000010',
    'under_review', '2025-03-05',
    'a1b2c3d4-0000-0000-0000-000000000010'
  );

-- Meetings
INSERT INTO meetings (id, group_id, supervisor_id, scheduled_at, status, notes) VALUES
  (
    'a1b2c3d4-0000-0000-0000-000000000401',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'a1b2c3d4-0000-0000-0000-000000000020',
    '2025-02-22T14:00:00Z',
    'completed',
    'Discussed proposal feedback. Team to revise methodology section.'
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000402',
    'a1b2c3d4-0000-0000-0000-000000000100',
    'a1b2c3d4-0000-0000-0000-000000000020',
    '2025-03-10T14:00:00Z',
    'confirmed',
    NULL
  );

-- Audit log seed entries
INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000010', 'group.created',    'group',    'a1b2c3d4-0000-0000-0000-000000000100', '{"groupName": "Team Alpha"}'),
  ('a1b2c3d4-0000-0000-0000-000000000030', 'supervisor.assigned', 'group', 'a1b2c3d4-0000-0000-0000-000000000100', '{"supervisorName": "Dr. James Okafor"}'),
  ('a1b2c3d4-0000-0000-0000-000000000010', 'proposal.submitted', 'proposal','a1b2c3d4-0000-0000-0000-000000000200', '{"version": 1}'),
  ('a1b2c3d4-0000-0000-0000-000000000020', 'proposal.rejected',  'proposal','a1b2c3d4-0000-0000-0000-000000000200', '{"version": 1, "comment": "Methodology too vague."}'),
  ('a1b2c3d4-0000-0000-0000-000000000010', 'proposal.submitted', 'proposal','a1b2c3d4-0000-0000-0000-000000000200', '{"version": 2}');
