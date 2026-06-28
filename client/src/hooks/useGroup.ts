import useSWR from 'swr'
import api from '@/lib/api'
import type { Group, GroupSummary } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** Student: fetch own group */
export function useMyGroup() {
  const { data, error, isLoading, mutate } = useSWR<Group>('/groups/my', fetcher)
  return { group: data ?? null, error, isLoading, mutate }
}

/** Admin/Supervisor: fetch all groups (lightweight list) */
export function useGroups() {
  const { data, error, isLoading, mutate } = useSWR<GroupSummary[]>('/groups', fetcher)
  return { groups: data ?? [], error, isLoading, mutate }
}

/** Single group with full members */
export function useGroup(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Group>(
    id ? `/groups/${id}` : null,
    fetcher
  )
  return { group: data ?? null, error, isLoading, mutate }
}
