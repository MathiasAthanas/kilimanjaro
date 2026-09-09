import { create } from 'zustand';
import { clearSession, getStoredSession, storeSession, type AuthSession } from './session';
import { useSchoolStore } from '../school/schoolStore';

type AuthState = {
  session: AuthSession | null;
  setSession: (session: AuthSession, remember: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: getStoredSession(),
  setSession: (session, remember) => {
    storeSession(session, remember);
    // Reset any school selection left over from a previous user/session. A null
    // active school gives the correct default scope for everyone (group roles →
    // all schools; single-school roles → their own school), so no user inherits
    // a stale selection that would silently narrow their dashboards.
    useSchoolStore.getState().setActiveSchool(null);
    set({ session });
  },
  logout: () => {
    clearSession();
    useSchoolStore.getState().setActiveSchool(null);
    set({ session: null });
  },
}));
