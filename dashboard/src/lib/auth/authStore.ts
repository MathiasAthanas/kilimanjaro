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
    storeSession(session, remember);
    set({ session });
  },
  logout: () => {
    clearSession();
    set({ session: null });
  },
}));
