export const endpoints = {
  health: '/health',
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/change-password',
    resetRequest: '/auth/password-reset/request',
    resetComplete: '/auth/password-reset/complete',
  },
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    read: (id: string) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all',
    announcements: '/notifications/announcements',
    activeAnnouncements: '/notifications/announcements/active',
    preferences: '/notifications/preferences',
  },
} as const;
