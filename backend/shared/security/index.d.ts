export interface Identity { id?: string; sub?: string; role: string; primaryRole?: string; roles?: string[]; schoolId?: string | null; email?: string | null; }
export function rolesOf(user: any): string[];
export function hasRole(user: any, role: string): boolean;
export function hasAnyRole(user: any, roles: readonly string[]): boolean;
export function context(): Identity | undefined;
export function runWithIdentity<T>(identity: Identity, fn: () => T): T;
export function requireSchool(user?: any): string;
export function scopeToSchool(user: any, where?: any): any;
export function identityHeaders(user?: any): Record<string, string>;
export function cacheKey(key: string): string;
export function schoolEvent(payload: any): any;
export function installSchoolScope(prisma: any): void;
export function SchoolJob(): MethodDecorator;
export function isSelfService(user: any): boolean;
export function isTeacherOnly(user: any): boolean;
