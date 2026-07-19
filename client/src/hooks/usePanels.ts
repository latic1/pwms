import useSWR from 'swr'
import api from '@/lib/api'
import type { Panel, MyPanel } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** All panels — admin only */
export function usePanels() {
  const { data, error, isLoading, mutate } = useSWR<Panel[]>('/panels', fetcher)
  return { panels: data ?? [], error, isLoading, mutate }
}

/** Panels the logged-in supervisor sits on, with their groups to grade */
export function useMyPanels() {
  const { data, error, isLoading, mutate } = useSWR<MyPanel[]>('/panels/mine', fetcher)
  return { panels: data ?? [], error, isLoading, mutate }
}
