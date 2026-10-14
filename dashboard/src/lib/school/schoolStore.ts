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

/**
 * The school the user is currently "inside". For group roles (Manager,
 * Super Admin, Head of Finances) null = All Schools; selecting a school
 * scopes every API call via the X-Active-School header. This deliberately
 * remains in memory: persisting it across a reload or account change can
 * silently narrow a group administrator to an old school.
 */
export const useSchoolStore = create<SchoolState>((set) => ({
  activeSchool: null,
  setActiveSchool: (school) => {
    set({ activeSchool: school });
  },
}));
