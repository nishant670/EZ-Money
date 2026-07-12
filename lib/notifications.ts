import { API_BASE_URL } from './transactions';

export type AppNotification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  action_url?: string;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationListResponse = {
  notifications: AppNotification[];
  unread_count: number;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

const emptyNotifications: NotificationListResponse = {
  notifications: [],
  unread_count: 0,
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 0,
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const parseNotificationPayload = (payload: unknown): NotificationListResponse => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return {
    notifications: Array.isArray(record.notifications)
      ? (record.notifications as AppNotification[])
      : [],
    unread_count: Number(record.unread_count ?? 0),
    page: Number(record.page ?? 1),
    page_size: Number(record.page_size ?? 25),
    total: Number(record.total ?? 0),
    total_pages: Number(record.total_pages ?? 0),
  };
};

export const fetchNotifications = async (
  token?: string | null,
  status: 'all' | 'unread' | 'read' = 'all'
): Promise<NotificationListResponse> => {
  if (!token) {
    return emptyNotifications;
  }

  const response = await fetch(`${API_BASE_URL}/v1/notifications?status=${status}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error('Unable to load notifications right now.');
  }
  return parseNotificationPayload(await response.json());
};

export const fetchUnreadNotificationCount = async (token?: string | null): Promise<number> => {
  if (!token) {
    return 0;
  }
  const response = await fetch(`${API_BASE_URL}/v1/notifications/unread-count`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    return 0;
  }
  const payload = await response.json();
  return Number(payload?.unread_count ?? 0);
};

export const markNotificationRead = async (token: string, id: number) => {
  const response = await fetch(`${API_BASE_URL}/v1/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error('Unable to mark notification as read.');
  }
  return (await response.json()) as AppNotification;
};

export const markAllNotificationsRead = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/notifications/read-all`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error('Unable to mark notifications as read.');
  }
};
