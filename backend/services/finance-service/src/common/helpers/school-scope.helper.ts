import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    if (user?.activeSchoolId && user.activeSchoolId !== explicit) {
      throw new ForbiddenException('Writes must use the currently selected school');
    }
    assertSchoolInScope(user, explicit);
    return explicit;
  }
  if (user?.activeSchoolId) return user.activeSchoolId;
  const ids = (user?.schoolIds ?? []).filter((id) => id !== '*');
  return ids.length === 1 ? ids[0] : null;
}

/**
 * Like resolveWriteSchoolId, but refuses to guess: someone who belongs to several schools must pick one
 * (the school switcher) before creating school-owned records. Group-scope users may create group-level records.
 */
export function resolveRequiredWriteSchoolId(user: RequestUser | undefined): string | null {
  if (user?.activeSchoolId) return resolveWriteSchoolId(user);
  if (isGroupScope(user)) return null;
  const ids = (user?.schoolIds ?? []).filter((id) => id && id !== '*');
  if (ids.length === 1) return ids[0];
  throw new BadRequestException('Select a school before creating this record');
}
