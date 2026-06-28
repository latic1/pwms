import useSWR from 'swr'
import api from '@/lib/api'
import type { Proposal } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** Latest proposal for a group */
export function useProposal(groupId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Proposal>(
    groupId ? `/proposals/${groupId}/latest` : null,
    fetcher
  )
  return { proposal: data ?? null, error, isLoading, mutate }
}

/** Full version history */
export function useProposalHistory(groupId: string | null) {
  const { data, error, isLoading } = useSWR<Proposal[]>(
    groupId ? `/proposals/${groupId}/history` : null,
    fetcher
  )
  return { history: data ?? [], error, isLoading }
}

/** Supervisor/Admin: all proposals needing review */
export function useAllProposals() {
  const { data, error, isLoading, mutate } = useSWR<Proposal[]>('/proposals', fetcher)
  return { proposals: data ?? [], error, isLoading, mutate }
}
