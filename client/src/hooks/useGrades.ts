import useSWR from 'swr'
import api from '@/lib/api'
import type { Grade } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

interface GradesResponse {
  grades: Grade[]
  average: number | null
  count: number
  supervisorScore: number | null
  panelAverage: number | null
  panelCount: number
  finalScore: number | null
}

export function useGrades(groupId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<GradesResponse>(
    groupId ? `/grades/${groupId}` : null,
    fetcher
  )
  return {
    grades: data?.grades ?? [],
    average: data?.average ?? null,
    count: data?.count ?? 0,
    supervisorScore: data?.supervisorScore ?? null,
    panelAverage: data?.panelAverage ?? null,
    panelCount: data?.panelCount ?? 0,
    finalScore: data?.finalScore ?? null,
    error,
    isLoading,
    mutate,
  }
}

export function useMyGrade(groupId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Grade>(
    groupId ? `/grades/${groupId}/mine` : null,
    fetcher
  )
  return { grade: data ?? null, error, isLoading, mutate }
}
