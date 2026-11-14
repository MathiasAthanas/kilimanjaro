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
    // Bring back the school THIS user chose last time (remembered per user id, so nobody inherits another
    // account's selection). The school bar drops it if the user no longer has access to that school.
    useSchoolStore.getState().loadForUser(session.user.id);
    set({ session });
  },
  logout: () => {
    clearSession();
    useSchoolStore.getState().reset();
    set({ session: null });
  },
}));
