import useSWR from 'swr'
import api from '@/lib/api'
import type { DocumentComment } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** Comments on one document — only fetched while a thread is expanded (pass null groupId/docId otherwise). */
export function useDocumentComments(groupId: string | null, docId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DocumentComment[]>(
    groupId && docId ? `/documents/${groupId}/${docId}/comments` : null,
    fetcher
  )
  return { comments: data ?? [], error, isLoading, mutate }
}

export async function addDocumentComment(groupId: string, docId: string, body: string) {
  await api.post(`/documents/${groupId}/${docId}/comments`, { body })
}
