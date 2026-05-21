import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '../../components/feedback/LoadingScreen';
import { useAuthStore } from '../../lib/auth/authStore';
import { getDefaultRouteForRole } from '../../lib/auth/permissions';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    const target = session ? getDefaultRouteForRole(session.user.role) : '/login';
    const timeout = window.setTimeout(() => navigate(target, { replace: true }), 700);
    return () => window.clearTimeout(timeout);
  }, [navigate, session]);

  return <LoadingScreen label="Syncing session and retrieving role profile..." />;
}
