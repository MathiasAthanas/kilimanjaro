import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

/**
 * School-isolation helpers (Doc 01 §5). Every list query filters through
 * `schoolScopeFilter`, every targeted write validates via `assertSchoolInScope`.
 */

export function isGroupScope(user?: RequestUser): boolean {
  return !user || user.scope === 'GROUP' || (user.schoolIds ?? []).includes('*');
}

/**
 * Prisma `where` fragment for schoolId-carrying tables.
 * - group scope, no active school → no filter (all schools)
 * - group scope + active school   → that school
 * - school scope                  → the user's membership schools (active school
 *   narrows further when set). Legacy NULL rows stay visible to group scope only.
 */
export function schoolScopeFilter(user?: RequestUser): { schoolId?: { in: string[] } | string } {
  if (!user) return {};
  if (isGroupScope(user)) {
    return user.activeSchoolId ? { schoolId: user.activeSchoolId } : {};
  }
  const ids = (user.schoolIds ?? []).filter((id) => id && id !== '*');
  if (user.activeSchoolId && ids.includes(user.activeSchoolId)) {
    return { schoolId: user.activeSchoolId };
  }
  return { schoolId: { in: ids.length ? ids : ['__none__'] } };
}

/**
 * The single school a read should be scoped to, as a plain id (or null = all
 * schools). Use this for aggregate/analytics endpoints that take a `schoolId`
 * argument rather than a Prisma `where` fragment.
 *
 * - active school selected (gateway already validated it is in the caller's
 *   scope) → that school, for GROUP and SCHOOL users alike;
 * - school-scoped user with no explicit selection → their (single) membership
 *   school, so they never see the whole group;
 * - group user with no selection → null (all schools).
 */
export function resolveScopeSchoolId(user?: RequestUser): string | null {
  if (!user) return null;
  if (user.activeSchoolId) return user.activeSchoolId;
  if (user.scope === 'SCHOOL') {
    return (user.schoolIds ?? []).find((id) => id && id !== '*') ?? null;
  }
  return null;
}

export function schoolInScope(user: RequestUser | undefined, schoolId: string | null | undefined): boolean {
  if (isGroupScope(user)) return true;
  if (!schoolId) return false;
  return (user?.schoolIds ?? []).includes(schoolId);
}

export function assertSchoolInScope(user: RequestUser | undefined, schoolId: string | null | undefined): void {
  if (!schoolInScope(user, schoolId)) {
    throw new ForbiddenException('This record belongs to a school outside your scope');
  }
}

/** The school to stamp on new records: active school, else the single membership school. */
export function resolveWriteSchoolId(user: RequestUser | undefined, explicit?: string | null): string | null {
  if (explicit) {
    assertSchoolInScope(user, explicit);
    return explicit;
  }
  if (user?.activeSchoolId) return user.activeSchoolId;
  const ids = (user?.schoolIds ?? []).filter((id) => id !== '*');
  return ids.length === 1 ? ids[0] : null;
}

/**
 * Every school a read may cover: the selected school, else all of a school-scoped user's schools
 * (so someone in several schools sees all of theirs, never just the first), else null = no limit (group).
 */
export function resolveScopeSchoolIds(user?: RequestUser): string[] | null {
  if (!user) return null;
  if (user.activeSchoolId) return [user.activeSchoolId];
  if (isGroupScope(user)) return null;
  const ids = (user.schoolIds ?? []).filter((id) => id && id !== '*');
  return ids.length ? ids : ['__none__'];
}
