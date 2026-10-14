import { ForbiddenException } from '@nestjs/common';
import {
  assertSchoolInScope,
  assertSchoolRecordWritable,
  requireWriteSchoolId,
  schoolScopeFilter,
} from './school-scope.helper';

const schoolAdmin = {
  id: 'admin-1',
  role: 'SYSTEM_ADMIN',
  scope: 'SCHOOL' as const,
  schoolIds: ['school-a'],
  activeSchoolId: 'school-a',
};

describe('school scope write boundaries', () => {
  it('keeps a school-scoped SYSTEM_ADMIN inside the selected school', () => {
    expect(schoolScopeFilter(schoolAdmin)).toEqual({ schoolId: 'school-a' });
    expect(requireWriteSchoolId(schoolAdmin, 'department')).toBe('school-a');
    expect(() => assertSchoolRecordWritable(schoolAdmin, 'school-b', 'department')).toThrow(ForbiddenException);
  });

  it('does not allow a school-scoped SYSTEM_ADMIN to modify a group template', () => {
    expect(() => assertSchoolRecordWritable(schoolAdmin, null, 'department')).toThrow(ForbiddenException);
  });

  it('does not allow a multi-school admin to bypass the selected school by record id', () => {
    const multiSchoolAdmin = { ...schoolAdmin, schoolIds: ['school-a', 'school-b'] };
    expect(() => assertSchoolRecordWritable(multiSchoolAdmin, 'school-b', 'department')).toThrow(ForbiddenException);
  });

  it('does not treat a missing authenticated user as group scope', () => {
    expect(() => assertSchoolInScope(undefined, 'school-a')).toThrow(ForbiddenException);
  });
});
