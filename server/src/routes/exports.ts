import { Router, Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { query } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'

const router = Router()
router.use(authenticate)

interface StudentExportRow {
  group_name:       string
  student_name:     string
  email:            string
  index_number:     string | null
  department:       string | null
  program:          string | null
  is_leader:        boolean
  proposal_title:   string | null
  proposal_status:  string | null
}

const STUDENT_EXPORT_HEADERS = [
  'Group', 'Student Name', 'Email', 'Index Number', 'Faculty',
  'Program', 'Role', 'Proposal Title', 'Proposal Status',
]

// ─── GET /exports/my-students — supervisor's students as an Excel file ────────

router.get('/my-students', requireRole('supervisor'), async (req: Request, res: Response): Promise<void> => {
  const supervisorId = req.user!.sub

  const students = await query<StudentExportRow>(
    `SELECT
       g.name    AS group_name,
       u.name    AS student_name,
       u.email,
       u.index_number,
       u.department,
       u.program,
       (u.id = g.leader_id) AS is_leader,
       p.title   AS proposal_title,
       p.status  AS proposal_status
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     JOIN users u ON u.id = gm.user_id
     LEFT JOIN LATERAL (
       SELECT title, status FROM proposals WHERE group_id = g.id ORDER BY version DESC LIMIT 1
     ) p ON true
     WHERE g.supervisor_id = $1
     ORDER BY g.name, is_leader DESC, u.name`,
    [supervisorId]
  )

  const rows = students.map((s) => ({
    'Group':            s.group_name,
    'Student Name':     s.student_name,
    'Email':            s.email,
    'Index Number':     s.index_number ?? '',
    'Faculty':          s.department ?? '',
    'Program':          s.program ?? '',
    'Role':             s.is_leader ? 'Leader' : 'Member',
    'Proposal Title':   s.proposal_title ?? '',
    'Proposal Status':  s.proposal_status ?? '',
  }))

  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows, { header: STUDENT_EXPORT_HEADERS })
    : XLSX.utils.aoa_to_sheet([STUDENT_EXPORT_HEADERS])

  // Reasonable column widths so it's readable without manual resizing
  worksheet['!cols'] = STUDENT_EXPORT_HEADERS.map((h) => ({
    wch: Math.max(h.length, 16),
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'My Students')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="my-students.xlsx"')
  res.send(buffer)
})

export default router
