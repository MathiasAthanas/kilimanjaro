import { create } from 'zustand';
import { isGroupWorkspacePath } from '../../components/layout/schoolScope';

export type ActiveSchool = {
  id: string;
  name: string;
  code: string;
  type?: string;
  gender?: string;
};

type SchoolState = {
  /** The school every request is scoped to right now (sent as X-Active-School). null = all schools. */
  activeSchool: ActiveSchool | null;
  /** The school the user chose and keeps working in. Remembered per user across refreshes and visits. */
  preferredSchool: ActiveSchool | null;
  /** The user picks a school, or "All schools" (null). This is remembered. */
  setActiveSchool: (school: ActiveSchool | null) => void;
  /** A whole-group page is open: look at every school, but keep remembering the chosen one. */
  suspendForGroupPage: () => void;
  /** A school page is open again: go back to the remembered school. */
  resumePreferred: () => void;
  /** Sign-in or reload: bring back what this user chose last time (never someone else's choice). */
  loadForUser: (userId: string | null | undefined, onGroupPage?: boolean) => void;
  /** Sign-out: forget the in-memory choice. The remembered choice stays for that user's next visit. */
  reset: () => void;
};

const STORAGE_KEY = 'ks.web.active-school.v2';

type Remembered = Record<string, ActiveSchool | null>;

function readAll(): Remembered {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Remembered) : {};
  } catch {
    return {};
  }
}

function isSchool(value: unknown): value is ActiveSchool {
  return Boolean(value) && typeof (value as ActiveSchool).id === 'string' && typeof (value as ActiveSchool).name === 'string';
}

export function readRememberedSchool(userId: string | null | undefined): ActiveSchool | null {
  if (!userId) return null;
  const found = readAll()[userId];
  return isSchool(found) ? found : null;
}

function remember(userId: string | null, school: ActiveSchool | null) {
  if (!userId) return;
  try {
    const all = readAll();
    if (school) all[userId] = school;
    else delete all[userId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // private mode or blocked storage: the choice simply lasts until the page closes
  }
}

let currentUserId: string | null = null;

/**
 * The school the user is currently "inside". Group roles (Manager, Super Admin, Head of Finance) see All Schools
 * until they pick one; the choice is remembered per user, so a refresh or a walk through other pages keeps them in
 * the same school. A whole-group page temporarily shows every school without forgetting the choice. The server
 * still checks every request against the user's real access, and the school bar drops a remembered school the user
 * no longer has access to.
 */
export const useSchoolStore = create<SchoolState>((set, get) => ({
  activeSchool: null,
  preferredSchool: null,
  setActiveSchool: (school) => {
    remember(currentUserId, school);
    set({ activeSchool: school, preferredSchool: school });
  },
  suspendForGroupPage: () => {
    if (get().activeSchool) set({ activeSchool: null });
  },
  resumePreferred: () => {
    const { activeSchool, preferredSchool } = get();
    if (!activeSchool && preferredSchool) set({ activeSchool: preferredSchool });
  },
  loadForUser: (userId, onGroupPage = false) => {
    currentUserId = userId ?? null;
    const remembered = readRememberedSchool(userId);
    set({ preferredSchool: remembered, activeSchool: onGroupPage ? null : remembered });
  },
  reset: () => {
    currentUserId = null;
    set({ activeSchool: null, preferredSchool: null });
  },
}));

// A page reload starts from the stored session: restore that user's school before the first request goes out.
try {
  const raw = window.localStorage.getItem('ks.web.session.v2') ?? window.sessionStorage.getItem('ks.web.session.v2');
  const userId = raw ? (JSON.parse(raw) as { user?: { id?: string } }).user?.id : null;
  if (userId) useSchoolStore.getState().loadForUser(userId, isGroupWorkspacePath(window.location.pathname));
} catch {
  // no stored session
}
