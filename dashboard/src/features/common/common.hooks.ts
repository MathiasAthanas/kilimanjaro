import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../lib/api/response';

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
    queryFn: () =>
      api.get('/notifications').then((r) =>
        arrayFromApi(payloadOf(r), ['notifications', 'logs']).map((raw) => {
          const n = raw as Record<string, unknown>;
          const resolve = (v: unknown): string => {
            if (!v || typeof v !== 'object') return String(v ?? '');
            const o = v as Record<string, unknown>;
            return String(o.name ?? o.fullName ?? o.label ?? o.title ?? '');
          };
          return {
            ...n,
            id: String(n.id ?? crypto.randomUUID()),
            title: String(n.title ?? n.subject ?? n.heading ?? ''),
            message: String(n.message ?? n.preview ?? n.body ?? n.content ?? ''),
            category: String(n.category ?? n.type ?? n.notificationType ?? 'System'),
            status: String(n.status ?? 'Unread'),
            isRead: Boolean(n.isRead ?? n.is_read ?? false),
            createdAt: String(n.createdAt ?? n.created_at ?? n.timestamp ?? ''),
            actor: n.actor != null ? resolve(n.actor) : undefined,
          };
        }),
      ),
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

function normaliseAnnouncement(raw: Record<string, unknown>) {
  return {
    ...raw,
    id: String(raw.id ?? crypto.randomUUID()),
    title: String(raw.title ?? raw.subject ?? raw.heading ?? ''),
    body: String(raw.body ?? raw.content ?? raw.message ?? ''),
    status: String(raw.status ?? ''),
    audience: String(raw.audience ?? raw.targetAudience ?? ''),
    publishedAt: raw.publishedAt != null ? String(raw.publishedAt) : undefined,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

export function useAnnouncements() {
  return useQuery({
    queryKey: commonKeys.announcements(),
    queryFn: () =>
      api.get('/notifications/announcements').then((r) =>
        arrayFromApi(payloadOf(r), ['announcements']).map((raw) => normaliseAnnouncement(raw as Record<string, unknown>)),
      ),
    staleTime: 60_000,
  });
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: commonKeys.activeAnnouncements(),
    queryFn: () =>
      api
        .get('/notifications/announcements/active')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['announcements', 'activeAnnouncements']).map((raw) =>
            normaliseAnnouncement(raw as Record<string, unknown>),
          ),
        ),
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
      api.get('/search', { params: { q: query } }).then((r) => arrayFromApi(payloadOf(r), ['results'])),
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
