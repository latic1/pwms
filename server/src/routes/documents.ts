import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { notify, notifyMany } from '../lib/notify'
import { validate } from '../middleware/validate'
import { addDocumentCommentSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Multer config ────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not allowed'))
    }
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'proposal' | 'progress_report' | 'final_report' | 'supporting'
const VALID_TYPES: DocType[] = ['proposal', 'progress_report', 'final_report', 'supporting']

interface DbDocument {
  id: string
  group_id: string
  uploader_id: string
  file_name: string
  file_url: string
  file_size: number | null
  type: DocType
  uploaded_at: string
}

function formatDoc(d: DbDocument) {
  return {
    id:         d.id,
    groupId:    d.group_id,
    uploaderId: d.uploader_id,
    fileName:   d.file_name,
    fileUrl:    d.file_url,
    fileSize:   d.file_size,
    type:       d.type,
    uploadedAt: d.uploaded_at,
  }
}

async function assertMember(groupId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true
  if (role === 'supervisor') {
    // Own supervised group, or a group examined by a panel they sit on
    const g = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, userId])
    if (g) return true
    const pm = await queryOne(
      `SELECT 1 FROM groups g
       JOIN panel_members pm ON pm.panel_id = g.panel_id
       WHERE g.id = $1 AND pm.user_id = $2`,
      [groupId, userId]
    )
    return !!pm
  }
  const m = await queryOne(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  )
  return !!m
}

// ─── GET /documents/:groupId — list documents ─────────────────────────────────

router.get('/:groupId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  const ok = await assertMember(groupId, sub, role)
  if (!ok) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const { type } = req.query
  const params: unknown[] = [groupId]
  let sql = 'SELECT * FROM documents WHERE group_id = $1'

  if (type && VALID_TYPES.includes(type as DocType)) {
    sql += ` AND type = $2`
    params.push(type)
  }

  sql += ' ORDER BY uploaded_at DESC'
  const docs = await query<DbDocument>(sql, params)
  res.json(docs.map(formatDoc))
})

// ─── POST /documents/:groupId — upload a document ────────────────────────────

router.post('/:groupId', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  // Panel members get read-only access — a supervisor can only upload to a
  // group they actually supervise
  if (role === 'supervisor') {
    const own = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, sub])
    if (!own) {
      res.status(403).json({ error: 'Panel members cannot upload documents' })
      return
    }
  }

  const ok = await assertMember(groupId, sub, role)
  if (!ok) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const docType: DocType = VALID_TYPES.includes(req.body.type) ? req.body.type : 'supporting'

  // Only group leader can submit final_report
  if (docType === 'final_report') {
    const group = await queryOne<{ leader_id: string }>(
      'SELECT leader_id FROM groups WHERE id = $1', [groupId]
    )
    if (role === 'student' && group?.leader_id !== sub) {
      fs.unlinkSync(req.file.path)
      res.status(403).json({ error: 'Only the group leader can upload the final report' })
      return
    }
  }

  const fileUrl = `/uploads/${req.file.filename}`

  const [doc] = await query<DbDocument>(
    `INSERT INTO documents (group_id, uploader_id, file_name, file_url, file_size, type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [groupId, sub, req.file.originalname, fileUrl, req.file.size, docType]
  )

  await audit(sub, 'document.uploaded', 'document', doc.id, {
    groupId, fileName: req.file.originalname, type: docType,
  })

  // Let the supervisor know a group they supervise submitted something
  if (role === 'student') {
    const group = await queryOne<{ name: string; supervisor_id: string | null }>(
      'SELECT name, supervisor_id FROM groups WHERE id = $1',
      [groupId]
    )
    if (group?.supervisor_id) {
      notify(
        group.supervisor_id,
        'document.uploaded',
        `${group.name} has submitted ${req.file.originalname} for review`,
        null,
        '/supervisor/groups'
      )
    }
  }

  res.status(201).json(formatDoc(doc))
})

// ─── DELETE /documents/:groupId/:docId — delete a document ───────────────────

router.delete('/:groupId/:docId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const docId   = p(req.params.docId)
  const { sub, role } = req.user!

  const doc = await queryOne<DbDocument>(
    'SELECT * FROM documents WHERE id = $1 AND group_id = $2',
    [docId, groupId]
  )
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  // Only uploader, group leader, or admin can delete
  if (role !== 'admin') {
    const group = await queryOne<{ leader_id: string }>(
      'SELECT leader_id FROM groups WHERE id = $1', [groupId]
    )
    const isUploader = doc.uploader_id === sub
    const isLeader   = group?.leader_id === sub
    if (!isUploader && !isLeader) {
      res.status(403).json({ error: 'Only the uploader or group leader can delete this document' })
      return
    }
  }

  // Remove physical file
  const filePath = path.join(process.cwd(), doc.file_url)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  await query('DELETE FROM documents WHERE id = $1', [docId])
  await audit(sub, 'document.deleted', 'document', docId, { groupId, fileName: doc.file_name })
  res.status(204).send()
})

// ─── Document comments ─────────────────────────────────────────────────────────

interface DbDocumentComment {
  id:          string
  document_id: string
  author_id:   string
  body:        string
  created_at:  string
}

interface DbDocumentCommentWithAuthor extends DbDocumentComment {
  author_name: string
  author_role: string
}

function formatComment(c: DbDocumentCommentWithAuthor) {
  return {
    id:         c.id,
    documentId: c.document_id,
    authorId:   c.author_id,
    authorName: c.author_name,
    authorRole: c.author_role,
    body:       c.body,
    createdAt:  c.created_at,
  }
}

// ─── GET /documents/:groupId/:docId/comments — list comments on a document ────

router.get('/:groupId/:docId/comments', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const docId   = p(req.params.docId)
  const { sub, role } = req.user!

  const ok = await assertMember(groupId, sub, role)
  if (!ok) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const doc = await queryOne('SELECT id FROM documents WHERE id = $1 AND group_id = $2', [docId, groupId])
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const rows = await query<DbDocumentCommentWithAuthor>(
    `SELECT dc.*, u.name AS author_name, u.role AS author_role
     FROM document_comments dc
     JOIN users u ON u.id = dc.author_id
     WHERE dc.document_id = $1
     ORDER BY dc.created_at`,
    [docId]
  )

  res.json(rows.map(formatComment))
})

// ─── POST /documents/:groupId/:docId/comments — add a comment ─────────────────

router.post(
  '/:groupId/:docId/comments',
  validate(addDocumentCommentSchema),
  async (req: Request, res: Response): Promise<void> => {
    const groupId = p(req.params.groupId)
    const docId   = p(req.params.docId)
    const { sub, role } = req.user!
    const { body } = req.body

    const ok = await assertMember(groupId, sub, role)
    if (!ok) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    const doc = await queryOne<DbDocument>('SELECT * FROM documents WHERE id = $1 AND group_id = $2', [docId, groupId])
    if (!doc) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    const [comment] = await query<DbDocumentComment>(
      `INSERT INTO document_comments (document_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [docId, sub, body]
    )

    const full = await queryOne<DbDocumentCommentWithAuthor>(
      `SELECT dc.*, u.name AS author_name, u.role AS author_role
       FROM document_comments dc JOIN users u ON u.id = dc.author_id
       WHERE dc.id = $1`,
      [comment.id]
    )

    await audit(sub, 'document.commented', 'document', docId, { groupId })

    // Notify the group's students when staff (supervisor/panel/admin) comment
    // on their document — not on a fellow student's own comment.
    if (role !== 'student') {
      const memberIds = await query<{ user_id: string }>(
        'SELECT user_id FROM group_members WHERE group_id = $1',
        [groupId]
      )
      notifyMany(
        memberIds.map((m) => m.user_id),
        'document.commented',
        'New comment on your document',
        `${full!.author_name} commented on "${doc.file_name}".`,
        '/student/documents'
      )
    }

    res.status(201).json(formatComment(full!))
  }
)

// ─── Static file serving ──────────────────────────────────────────────────────
// Mount this on the Express app: app.use('/uploads', express.static('uploads'))

export default router
