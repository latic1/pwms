import useSWR from 'swr'
import api from '@/lib/api'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

export interface ReportSummary {
  groups:    { total: number; withSupervisor: number; withoutSupervisor: number }
  users:     { students: number; supervisors: number; admins: number; examiners: number }
  proposals: { pending: number; approved: number; rejected: number; none: number }
  tasks:     { total: number; done: number }
  grades:    { supervisorGraded: number; examinerGraded: number; total: number }
  documents: { total: number; finalReports: number }
}

export interface GroupReport {
  groupId:        string
  groupName:      string
  createdAt:      string
  supervisorName: string | null
  memberCount:    number
  proposal: { title: string | null; status: string; version: number } | null
  tasks:          { total: number; done: number }
  hasFinalReport: boolean
  supervisorScore: number | null
  examinerScore:   number | null
  finalScore:      number | null
  docCount:        number
}

export function useReportSummary() {
  const { data, error, isLoading } = useSWR<ReportSummary>('/reports/summary', fetcher)
  return { summary: data ?? null, error, isLoading }
}

export function useGroupReports() {
  const { data, error, isLoading } = useSWR<GroupReport[]>('/reports/groups', fetcher)
  return { groups: data ?? [], error, isLoading }
}
