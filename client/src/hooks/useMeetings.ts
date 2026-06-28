import useSWR from 'swr'
import api from '@/lib/api'
import type { Meeting } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** All meetings for the current supervisor */
export function useAllMeetings() {
  const { data, error, isLoading, mutate } = useSWR<Meeting[]>('/meetings', fetcher)
  return { meetings: data ?? [], error, isLoading, mutate }
}

/** Meetings for a specific group */
export function useMeetings(groupId: string | null, status?: string) {
  const params = status ? `?status=${status}` : ''
  const { data, error, isLoading, mutate } = useSWR<Meeting[]>(
    groupId ? `/meetings/${groupId}${params}` : null,
    fetcher
  )
  return { meetings: data ?? [], error, isLoading, mutate }
}
