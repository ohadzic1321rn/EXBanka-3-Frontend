import employeeApi from './client'
import clientApi from './clientAuth'

export interface AppNotification {
  id: number
  user_id: number
  user_type: string
  type: string
  title: string
  body: string
  link: string
  is_read: boolean
  created_at: string
}

// A session is either employee (sessionStorage.access_token) or client
// (sessionStorage.client_access_token) — never both. Pick the matching axios
// instance so the same store serves both portals.
function pickApi() {
  return sessionStorage.getItem('access_token') ? employeeApi : clientApi
}

export const notificationApi = {
  list: (unreadOnly = false) =>
    pickApi().get<AppNotification[]>('/notifications', {
      params: unreadOnly ? { unread: 'true' } : undefined,
    }),

  unreadCount: () =>
    pickApi().get<{ unread: number }>('/notifications/unread-count'),

  markRead: (id: number) =>
    pickApi().post(`/notifications/${id}/read`),

  markAllRead: () =>
    pickApi().post('/notifications/read-all'),

  remove: (id: number) =>
    pickApi().delete(`/notifications/${id}`),
}
