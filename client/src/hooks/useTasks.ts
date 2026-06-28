import useSWR from 'swr'
import api from '@/lib/api'
import type { Task } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useTasks(groupId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    groupId ? `/tasks?groupId=${groupId}` : null,
    fetcher
  )
  return { tasks: data ?? [], error, isLoading, mutate }
}
