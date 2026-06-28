# Final Year Project Work Management System — Project Guide

---

## 1. Project Overview

**System Name:** FYP Work Management System (FYP-WMS)
**Type:** Web-based multi-role academic project management platform
**Scope:** Supports group-based final year projects from formation through submission and grading

**Core Problem Solved:** Centralizes all FYP activities — group formation, proposal submission, task tracking, document management, supervisor communication, and grading — into one auditable system.

---

## 2. User Roles & Permissions

| Action | Student (Member) | Student (Leader) | Supervisor | Admin | Examiner |
|---|---|---|---|---|---|
| Create group | — | Yes | — | — | — |
| Invite members via code | — | Yes | — | — | — |
| Join group via code | Yes | — | — | — | — |
| Submit proposal | — | Yes | — | — | — |
| Submit final report | — | Yes | — | — | — |
| Upload documents | Yes | Yes | — | — | — |
| Update tasks | Yes | Yes | — | — | — |
| Message supervisor | Yes | Yes | — | — | — |
| Review / give feedback | — | — | Yes | — | — |
| Schedule meetings | — | — | Yes | — | — |
| Grade group | — | — | Yes | — | Yes |
| Register users | — | — | — | Yes | — |
| Assign supervisors | — | — | — | Yes | — |
| Set deadlines | — | — | — | Yes | — |
| Override group membership | — | — | — | Yes | — |
| Access final submissions | — | — | Yes | Yes | Yes |

---

## 3. System Modules

### 3.1 Authentication & User Management
- Role-based login (Student / Supervisor / Admin / Examiner)
- Admin registers all users (no open self-registration)
- Password reset flow
- Session management with role-aware routing

### 3.2 Group Management
- Leader creates group → system generates unique invite code
- Members join with invite code (enforced max: 3 students)
- Admin sets group formation deadline; joins blocked after deadline
- Admin can override: add/remove members, reassign leader
- Admin assigns a supervisor to each group

### 3.3 Proposal Submission
- Only group leader can submit
- Submission locked after admin-set proposal deadline
- Supervisor reviews, adds comments, approves/rejects
- Leader can resubmit if rejected (configurable revision limit)
- Version history maintained

### 3.4 Task Management
- Supervisor or leader creates tasks with due dates and assignees
- Any group member can update task status
- Task states: `Pending → In Progress → Under Review → Done`
- Supervisor sees all group members' task activity

### 3.5 Document Management
- Any group member can upload files (reports, diagrams, code archives)
- File types and size limits configurable by admin
- Documents tagged by type (Proposal, Progress Report, Final Report, Supporting)
- Only leader submits the official final report

### 3.6 Communication
- Per-group messaging thread between group members and supervisor
- Supervisor can broadcast to all their groups
- Meeting scheduler: supervisor proposes slot → group confirms
- Notifications for new messages, feedback, and upcoming deadlines

### 3.7 Grading & Evaluation
- Supervisor grades group (configurable rubric)
- Examiner accesses final submission package and grades independently
- Admin consolidates or averages scores (configurable)
- Grades not visible to students until admin releases them

### 3.8 Admin Control Panel
- Configure academic periods (start/end dates)
- Set deadlines: group formation, proposal, final submission
- Register and manage all users
- Assign/reassign supervisors to groups
- Override group membership
- View system-wide audit log

---

## 4. Data Models (Conceptual)

```
User          { id, name, email, passwordHash, role, createdAt }
Group         { id, inviteCode, leaderId, supervisorId, createdAt }
GroupMember   { groupId, userId, joinedAt }
Proposal      { id, groupId, title, abstract, fileUrl, status, version, submittedAt }
Task          { id, groupId, title, assigneeId, status, dueDate, createdBy }
Document      { id, groupId, uploaderId, fileUrl, type, uploadedAt }
Message       { id, groupId, senderId, body, sentAt }
Meeting       { id, groupId, supervisorId, scheduledAt, status, notes }
Grade         { id, groupId, graderId, role, score, rubric, gradedAt }
AcademicPeriod{ id, name, groupDeadline, proposalDeadline, submissionDeadline }
AuditLog      { id, actorId, action, targetType, targetId, timestamp }
```

---

## 5. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| UI Library | Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| File Storage | Local (dev) / S3 (prod) |
| Real-time | Socket.io (messaging) |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## 6. Development Phases

### Phase 1 — Frontend (Next.js, Dummy Data) ✅ COMPLETE
Build all pages with hardcoded mock data. No backend calls yet — focus on layout, navigation, and role-based UI flows.

- [x] Project setup (Next.js + TypeScript + Tailwind + shadcn/ui)
- [x] Shared layout: sidebar/navbar with role-aware nav links + dev role switcher
- [ ] Auth pages: Login page, Forgot Password ← **REMAINING**
- [x] **Student pages**
  - [x] Dashboard (group status, upcoming deadlines, recent activity)
  - [x] Group page (members list, invite code display, join via code)
  - [x] Proposal page (submit form, version history, status badge)
  - [x] Tasks page (task list, status update, assignee filter)
  - [x] Documents page (upload UI, file list by type)
  - [x] Messages page (group chat thread)
- [x] **Supervisor pages**
  - [x] Dashboard (all assigned groups overview)
  - [x] Group detail (members, tasks, documents, proposal status)
  - [x] Proposal review (approve/reject with comment)
  - [x] Meetings page (schedule, confirm, add notes)
  - [x] Grading page (rubric form per group)
- [x] **Admin pages**
  - [x] Dashboard (system stats: groups, users, pending actions)
  - [x] Users page (register, list, edit roles)
  - [x] Groups page (list all, assign supervisor, override membership)
  - [x] Academic period page (set deadlines, release grades toggle)
  - [x] Audit log page
- [x] **Examiner pages**
  - [x] Submissions list (all final reports)
  - [x] Submission detail (view documents, grade form)

### Phase 2 — Backend Foundation (Node.js + Express) ✅ COMPLETE
- [x] Project setup (Express + TypeScript, folder structure)
- [x] Health check endpoint running on port 5000
- [x] PostgreSQL schema + migrations (001_initial_schema.sql, 002_seed_dev_data.sql)
- [x] Auth endpoints (login, refresh token, forgot/reset password)
- [x] Role-based middleware (authenticate + requireRole guards)
- [x] Admin: user registration endpoints (GET/POST/PATCH/DELETE /admin/users)

### Phase 3 — Backend: Group & Proposal ✅ COMPLETE
- [x] Group CRUD + invite code generation (XXXXX-XXXX format)
- [x] Join group endpoint (deadline + max-3 enforcement)
- [x] Admin supervisor assignment + leader reassignment
- [x] Proposal submit (versioned), history, supervisor review endpoints
- [x] All group/proposal endpoints compile and are registered

### Phase 4 — Backend: Work Management ✅ COMPLETE
- [x] Task CRUD endpoints (role-scoped: students can only advance status)
- [x] Document upload (multer, 20MB, MIME whitelist, leader-only final_report)
- [x] Messaging endpoints (cursor-paginated, examiners blocked)
- [x] Meeting scheduling endpoints (students can only confirm, completed immutable)

### Phase 5 — Backend: Grading & Reporting ✅ COMPLETE
- [x] Supervisor and examiner grading endpoints (upsert, score 0–100)
- [x] Grade release flag on academic period (PATCH /periods/:id/release-grades)
- [x] Audit log writes on all state changes (fire-and-forget helper)
- [x] Audit log read endpoint with pagination + filters

### Phase 6 — Frontend ↔ Backend Integration ✅ COMPLETE
- [x] All backend phases complete and compiled
- [x] Install axios + SWR in client
- [x] Create API client (axios instance, Bearer token, refresh interceptor)
- [x] Update auth context to use real JWT login/logout (localStorage)
- [x] Create resource hooks (useGroup, useProposal, useTasks, useDocuments, useMessages, useMeetings, useGrades)
- [x] Connect student pages (dashboard, group, proposal, tasks, documents, messages)
- [x] Connect supervisor pages (dashboard, groups, proposal-review, meetings, grading)
- [x] Connect admin pages (users, groups, periods, audit-log)
- [x] Connect examiner pages (submissions list, submission detail)

### Phase 7 — Polish & Deployment 🔄 IN PROGRESS
- [ ] Deadline-based notifications (in-app or email)
- [x] Full input validation — Zod schemas on all POST/PATCH routes
- [x] Security hardening — helmet, rate limiting (20 req/15min auth, 200 req/15min API), CORS credentials, 1MB JSON cap, file MIME allowlist enforced
- [x] Bug fix — groups.ts GET /:id used wrong field names (user_id → id, supervisor_id → supervisorId, leader_id → leaderId)
- [ ] Testing (unit + integration)
- [x] Deployment config — vercel.json (frontend), Procfile + .env.example (backend)

---

## 7. Key Business Rules to Enforce in Code

1. **Group size:** Hard cap at 3 members; invite code rejected if group is full.
2. **Deadline enforcement:** Group joins, proposals, and final reports blocked server-side after respective deadlines — not just hidden in the UI.
3. **Leader-only submissions:** Proposal and final report endpoints must verify `userId === group.leaderId`.
4. **Supervisor scope:** Supervisors may only view/grade groups assigned to them by admin.
5. **Examiner access:** Examiners can only read final submission packages; no edit or messaging access.
6. **Grade visibility:** Grades stored but hidden from students until admin sets `gradesReleased = true` on the academic period.
7. **Audit trail:** All state-changing actions (submissions, status changes, grade entries) append to the audit log.

---

## 8. Suggested Evaluation / Grading Rubric (for your examiners)

| Criterion | Weight |
|---|---|
| Functional completeness (all roles work as specified) | 30% |
| Role-based access control correctness | 15% |
| UI/UX clarity and usability | 15% |
| Database design and data integrity | 15% |
| Code quality and architecture | 10% |
| Security (auth, input validation, file handling) | 10% |
| Documentation and presentation | 5% |

---

## 9. Deliverables Checklist

- [ ] Software Requirements Specification (SRS)
- [ ] System Design Document (architecture diagrams, ER diagram, use case diagrams)
- [ ] Working deployed system (or local demo)
- [ ] Source code (GitHub repo)
- [ ] User manual per role
- [ ] Test report
- [ ] Final project report
