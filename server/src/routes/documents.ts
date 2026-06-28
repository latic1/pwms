import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'

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
    const g = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, userId])
    return !!g
  }
  if (role === 'examiner') {
    // Examiners can read documents of groups with a final_report submission
    return true
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

  // Only group members (students) and admins can upload
  if (role === 'examiner') {
    res.status(403).json({ error: 'Examiners cannot upload documents' })
    return
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

// ─── Static file serving ──────────────────────────────────────────────────────
// Mount this on the Express app: app.use('/uploads', express.static('uploads'))

export default router
