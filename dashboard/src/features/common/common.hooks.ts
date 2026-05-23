import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';

function payloadOf(response: { data?: unknown }) {
  const body = response.data as { data?: unknown } | undefined;
  return body?.data ?? response.data;
}

function arrayFrom(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const commonKeys = {
  all: ['common'] as const,
  notifications: () => [...commonKeys.all, 'notifications'] as const,
  notification: (id: string) => [...commonKeys.notifications(), id] as const,
  unreadCount: () => [...commonKeys.notifications(), 'unread-count'] as const,
  announcements: () => [...commonKeys.all, 'announcements'] as const,
  activeAnnouncements: () => [...commonKeys.announcements(), 'active'] as const,
  announcement: (id: string) => [...commonKeys.announcements(), id] as const,
  search: (query: string) => [...commonKeys.all, 'search', query] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery({
    queryKey: commonKeys.notifications(),
    queryFn: () => api.get('/notifications').then((r) => arrayFrom(payloadOf(r), ['notifications', 'logs'])),
    staleTime: 15_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: commonKeys.unreadCount(),
    queryFn: () =>
      api.get('/notifications/unread-count').then((r) => {
        const d = r.data?.data ?? r.data;
        return typeof d === 'number' ? d : (d as Record<string, unknown>)?.count ?? 0;
      }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: commonKeys.announcements(),
    queryFn: () => api.get('/notifications/announcements').then((r) => arrayFrom(payloadOf(r), ['announcements'])),
    staleTime: 60_000,
  });
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: commonKeys.activeAnnouncements(),
    queryFn: () =>
      api
        .get('/notifications/announcements/active')
        .then((r) => arrayFrom(payloadOf(r), ['announcements', 'activeAnnouncements'])),
    staleTime: 60_000,
  });
}

export function useAnnouncement(id: string | undefined) {
  return useQuery({
    queryKey: commonKeys.announcement(id ?? ''),
    queryFn: () =>
      api.get(`/notifications/announcements/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: commonKeys.search(query),
    queryFn: () =>
      api.get('/search', { params: { q: query } }).then((r) => arrayFrom(payloadOf(r), ['results'])),
    enabled: !!query && query.length > 2,
    staleTime: 10_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/notifications/${id}/read`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commonKeys.notifications() });
      qc.invalidateQueries({ queryKey: commonKeys.unreadCount() });
    },
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch('/notifications/read-all').then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commonKeys.notifications() });
      qc.invalidateQueries({ queryKey: commonKeys.unreadCount() });
    },
  });
}

export function useDeleteNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/notifications/${id}`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: commonKeys.notifications() }),
  });
}
