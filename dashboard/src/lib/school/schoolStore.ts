import { create } from 'zustand';

export type ActiveSchool = {
  id: string;
  name: string;
  code: string;
  type?: string;
  gender?: string;
};

type SchoolState = {
  activeSchool: ActiveSchool | null;
  setActiveSchool: (school: ActiveSchool | null) => void;
};

const KEY = 'ks.web.active-school.v1';

function load(): ActiveSchool | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveSchool) : null;
  } catch {
    return null;
  }
}

/**
 * The school the user is currently "inside". For group roles (Manager,
 * Super Admin, Head of Finances) null = All Schools; selecting a school
 * scopes every API call via the X-Active-School header.
 */
export const useSchoolStore = create<SchoolState>((set) => ({
  activeSchool: load(),
  setActiveSchool: (school) => {
    if (school) localStorage.setItem(KEY, JSON.stringify(school));
    else localStorage.removeItem(KEY);
    set({ activeSchool: school });
  },
}));
