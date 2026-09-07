import { queryClient } from '../query/queryClient';
import { create } from 'zustand';
import { clearSession, getStoredSession, storeSession, type AuthSession } from './session';

type AuthState = {
  session: AuthSession | null;
  setSession: (session: AuthSession, remember: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: getStoredSession(),
  setSession: (session, remember) => {
    const previous = useAuthStore.getState().session?.user;
    if (previous?.id !== session.user.id || previous?.schoolId !== session.user.schoolId || JSON.stringify(previous?.roles) !== JSON.stringify(session.user.roles)) queryClient.clear();
    storeSession(session, remember);
    set({ session });
  },
  logout: () => {
    queryClient.clear();
    clearSession();
    set({ session: null });
  },
}));
