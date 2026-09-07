export interface RequestUser {
  schoolId?: string | null;
  roles?: string[];
  primaryRole?: string;
  id: string;
  role: string;
  email?: string;
}