import { describe, expect, it } from 'vitest';
import { buildCreateTermPayload } from './termPayload';

describe('buildCreateTermPayload', () => {
  it('sends only fields accepted by the term-create API', () => {
    expect(buildCreateTermPayload({
      name: '3rd Term',
      startDate: '2026-09-14',
      endDate: '2026-11-13',
      academicYearId: 'year-2026',
    })).toEqual({
      name: '3rd Term',
      startDate: '2026-09-14',
      endDate: '2026-11-13',
      academicYearId: 'year-2026',
    });
  });
});
