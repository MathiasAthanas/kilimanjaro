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

/**
 * Guard for MIXED tables that hold both shared/global rows (schoolId = null) and
 * per-school rows (e.g. departments with system defaults): a global row is
 * accessible to everyone, a per-school row only to that school (or a group user).
 */
export function assertSchoolAccessible(user: RequestUser | undefined, schoolId: string | null | undefined): void {
  if (schoolId && !schoolInScope(user, schoolId)) {
    throw new ForbiddenException('This record belongs to a school outside your scope');
  }
}

/**
 * Shared rows are readable catalogues, not records a school-scoped user may
 * change. This keeps a SYSTEM_ADMIN scoped to a school equivalent to a
 * manager: role grants capabilities, membership scope grants the boundary.
 */
export function assertSchoolRecordWritable(
  user: RequestUser | undefined,
  schoolId: string | null | undefined,
  label = 'record',
): void {
  if (!user) {
    throw new ForbiddenException('School context is required');
  }
  if (!schoolId) {
    if (!isGroupScope(user)) {
      throw new ForbiddenException(
        `This ${label} is a group template. Create a school-specific ${label} before changing it.`,
      );
    }
    return;
  }
  assertSchoolInScope(user, schoolId);
}

/**
 * Prisma `where` fragment for MIXED tables: when a specific school is in scope,
 * match that school's rows OR shared/global rows (schoolId = null); a group user
 * with no active school matches everything.
 */
export function schoolOrGlobalFilter(user?: RequestUser): Record<string, unknown> {
  const scope = schoolScopeFilter(user);
  if (!scope.schoolId) return {};
  return { OR: [{ schoolId: scope.schoolId }, { schoolId: null }] };
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

/** School-owned settings must never silently become group-wide records. */
export function requireWriteSchoolId(user: RequestUser | undefined, label = 'record'): string {
  if (!user) {
    throw new ForbiddenException('School context is required');
  }
  const schoolId = resolveWriteSchoolId(user);
  if (!schoolId) {
    throw new BadRequestException(`Select a school before creating a ${label}`);
  }
  return schoolId;
}
