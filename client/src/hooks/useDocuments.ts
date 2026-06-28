import useSWR from 'swr'
import api from '@/lib/api'
import type { Document } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useDocuments(groupId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Document[]>(
    groupId ? `/documents/${groupId}` : null,
    fetcher
  )
  return { documents: data ?? [], error, isLoading, mutate }
}
