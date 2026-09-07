import useSWR from 'swr'
import api from '@/lib/api'
import type { Notification } from '@/types'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

/** The current user's notifications, polled so the bell stays fresh without a websocket. */
export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    '/notifications',
    fetcher,
    { refreshInterval: 30_000 }
  )
  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length
  return { notifications, unreadCount, error, isLoading, mutate }
}

export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  await api.post('/notifications/read-all')
}
