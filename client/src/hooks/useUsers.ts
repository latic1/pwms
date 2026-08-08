import useSWR from 'swr'
import api from '@/lib/api'
import type { User } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useUsers(role?: string, opts?: { activeOnly?: boolean }) {
  const params = new URLSearchParams()
  if (role) params.set('role', role)
  if (opts?.activeOnly) params.set('active', 'true')
  const qs = params.toString()
  const url = qs ? `/admin/users?${qs}` : '/admin/users'
  const { data, error, isLoading, mutate } = useSWR<User[]>(url, fetcher)
  return { users: data ?? [], error, isLoading, mutate }
}
