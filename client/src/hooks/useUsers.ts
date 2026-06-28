import useSWR from 'swr'
import api from '@/lib/api'
import type { User } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useUsers(role?: string) {
  const url = role ? `/admin/users?role=${role}` : '/admin/users'
  const { data, error, isLoading, mutate } = useSWR<User[]>(url, fetcher)
  return { users: data ?? [], error, isLoading, mutate }
}
