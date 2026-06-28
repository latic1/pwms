import useSWR from 'swr'
import api from '@/lib/api'

export interface AuditEntry {
  id: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

interface AuditLogResponse {
  data: AuditEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface AuditFilters {
  page?: number
  limit?: number
  targetType?: string
  actorId?: string
  action?: string
  from?: string
  to?: string
}

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function useAuditLog(filters: AuditFilters = {}) {
  const params = new URLSearchParams()
  if (filters.page)       params.set('page',       String(filters.page))
  if (filters.limit)      params.set('limit',      String(filters.limit))
  if (filters.targetType) params.set('targetType', filters.targetType)
  if (filters.actorId)    params.set('actorId',    filters.actorId)
  if (filters.action)     params.set('action',     filters.action)
  if (filters.from)       params.set('from',       filters.from)
  if (filters.to)         params.set('to',         filters.to)

  const { data, error, isLoading, mutate } = useSWR<AuditLogResponse>(
    `/audit-log?${params}`,
    fetcher
  )
  return {
    logs: data?.data ?? [],
    pagination: data?.pagination,
    error,
    isLoading,
    mutate,
  }
}
