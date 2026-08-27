/**
 * Tracks which sign-in page (student vs. staff) the current browser last
 * used, so a signed-out redirect (expired session, failed refresh, visiting
 * a protected page while logged out) sends the user back to the right one
 * instead of always defaulting to the student page.
 *
 * Kept separate from api.ts / auth-context.tsx to avoid a circular import
 * between the two (auth-context already imports from api.ts).
 */

const KEY = 'lastRole'

/** Record the role of whoever just signed in, so future redirects target the right login page. */
export function setLastRole(role: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, role)
}

export function clearLastRole() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}

/** The login page to redirect a signed-out user to. Defaults to the student page when unknown. */
export function getLoginPath(): string {
  if (typeof window === 'undefined') return '/login'
  const role = localStorage.getItem(KEY)
  return role === 'supervisor' || role === 'admin' ? '/staff-login' : '/login'
}
