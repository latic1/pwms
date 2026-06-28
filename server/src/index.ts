import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import authRoutes              from './routes/auth'
import adminUserRoutes         from './routes/admin.users'
import adminAnnouncementRoutes from './routes/admin.announcements'
import groupRoutes             from './routes/groups'
import proposalRoutes          from './routes/proposals'
import taskRoutes              from './routes/tasks'
import documentRoutes          from './routes/documents'
import messageRoutes           from './routes/messages'
import meetingRoutes           from './routes/meetings'
import gradeRoutes             from './routes/grades'
import periodRoutes            from './routes/periods'
import auditLogRoutes          from './routes/auditLog'
import publicRoutes            from './routes/public'
import reportRoutes            from './routes/reports'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 5000

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// General API rate limit: 200 req / 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

// Tight limit for auth endpoints: 20 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
})

app.use('/api', apiLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'FYP-WMS API is running' })
})

app.use('/auth',            authLimiter, authRoutes)
app.use('/admin/users',     adminUserRoutes)
app.use('/groups',          groupRoutes)
app.use('/proposals',       proposalRoutes)
app.use('/tasks',           taskRoutes)
app.use('/documents',       documentRoutes)
app.use('/messages',        messageRoutes)
app.use('/meetings',        meetingRoutes)
app.use('/grades',          gradeRoutes)
app.use('/periods',         periodRoutes)
app.use('/audit-log',              auditLogRoutes)
app.use('/admin/announcements',    adminAnnouncementRoutes)
app.use('/public',                 publicRoutes)
app.use('/reports',                reportRoutes)
app.use('/uploads',                express.static('uploads'))

// ─── 404 catch-all ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
