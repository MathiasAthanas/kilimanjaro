import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/auth/authStore';
import { canAccessRoute } from '../lib/auth/permissions';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessRoute(session.user.role, location.pathname)) return <Navigate to="/app/403" replace />;
  return children;
}
