/**
 * Shared default password newly created students log in with the first time.
 * Publicly visible on the login page — set via env so it can be rotated
 * without a redeploy. Every account created with it is flagged
 * must_change_password = true and is forced to set a real password
 * before it can be used again.
 */
export const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD ?? 'Student@2026'
