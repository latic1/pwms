import useSWR from 'swr'
import api from '@/lib/api'
import type { AcademicPeriod } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export function usePeriods() {
  const { data, error, isLoading, mutate } = useSWR<AcademicPeriod[]>('/periods', fetcher)
  return { periods: data ?? [], error, isLoading, mutate }
}

export function useActivePeriod() {
  const { data, error, isLoading, mutate } = useSWR<AcademicPeriod>('/periods/active', fetcher)
  return { period: data ?? null, error, isLoading, mutate }
}
