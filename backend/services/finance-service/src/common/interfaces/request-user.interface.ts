export interface RequestUser {
  id: string;
  role: string;
  email?: string;
  /** GROUP = all schools; SCHOOL = only the ids in schoolIds */
  scope?: 'GROUP' | 'SCHOOL';
  /** ['*'] for group roles, else explicit school ids from memberships */
  schoolIds?: string[];
  /** The school currently selected in the UI (validated by the gateway) */
  activeSchoolId?: string;
}
