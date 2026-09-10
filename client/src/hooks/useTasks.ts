import useSWR from 'swr'
import api from '@/lib/api'
import type { Task } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useTasks(groupId: string | null) {
  // Server route is GET /tasks/:groupId (path param) — this used to build
  // /tasks?groupId=X, which doesn't match that route at all and 404s, so
  // every page using this hook always saw an empty task list.
  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    groupId ? `/tasks/${groupId}` : null,
    fetcher
  )
  return { tasks: data ?? [], error, isLoading, mutate }
}
