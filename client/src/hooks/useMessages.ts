import useSWR from 'swr'
import api from '@/lib/api'
import type { Message } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useMessages(groupId: string | null, before?: string) {
  const params = new URLSearchParams({ limit: '50' })
  if (before) params.set('before', before)
  const { data, error, isLoading, mutate } = useSWR<Message[]>(
    groupId ? `/messages/${groupId}?${params}` : null,
    fetcher
  )
  return { messages: data ?? [], error, isLoading, mutate }
}
