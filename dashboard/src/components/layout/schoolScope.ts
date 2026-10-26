/** An empty list or the gateway's explicit wildcard represents whole-group scope. */
export function canSelectSchool(scope: 'GROUP' | 'SCHOOL' | undefined, schoolIds: string[], schoolId: string) {
  return scope === 'GROUP'
    ? (schoolIds.length === 0 || schoolIds.includes('*') || schoolIds.includes(schoolId))
    : schoolIds.includes(schoolId);
}

export const isGroupWorkspacePath = (pathname: string) =>
  ['/manager', '/superadmin', '/finance-group'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
