import useSWR from 'swr'
import api from '@/lib/api'
import type { TopicSuggestionRecord, TopicSuggestion, SupervisorMatch } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** Student: past topic suggestion requests, newest first */
export function useTopicSuggestionHistory() {
  const { data, error, isLoading, mutate } = useSWR<TopicSuggestionRecord[]>('/ai/topics', fetcher)
  return { history: data ?? [], error, isLoading, mutate }
}

/** Generate new AI topic suggestions from a list of interest keywords */
export async function generateTopicSuggestions(interests: string[]): Promise<TopicSuggestion[]> {
  const { data } = await api.post('/ai/topics', { interests })
  return data.suggestions
}

/** Rank supervisors for a chosen topic (deterministic, not AI) */
export async function matchSupervisors(topicTitle: string, keywords?: string[]): Promise<SupervisorMatch[]> {
  const { data } = await api.post('/ai/supervisor-matches', { topicTitle, keywords })
  return data
}
