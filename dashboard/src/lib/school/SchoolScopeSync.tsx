import { useEffect, useRef } from 'react';
import { useSchoolStore } from './schoolStore';
import { queryClient } from '../query/queryClient';

/**
 * Strong per-school isolation for cached data.
 *
 * Every API call is already scoped by the `X-Active-School` header (see
 * `lib/api/client.ts`), but React Query caches responses by `queryKey`. Most
 * list hooks use a school-agnostic key, so after switching schools the cache
 * would keep serving the *previous* school's rows until they went stale.
 *
 * Rather than thread the active school into ~480 individual query keys, we purge
 * the whole cache the moment the active school changes. Mounted queries then
 * refetch immediately with the new header, and no other-school data lingers in
 * memory. This is the standard tenant-switch pattern and guarantees isolation
 * regardless of which hook requested the data.
 */
export function SchoolScopeSync() {
  const schoolId = useSchoolStore((s) => s.activeSchool?.id ?? null);
  // `undefined` = not yet initialised; skip the purge on first mount so we only
  // react to genuine switches, never the initial hydration from localStorage.
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (previous.current !== undefined && previous.current !== schoolId) {
      queryClient.clear();
    }
    previous.current = schoolId;
  }, [schoolId]);

  return null;
}
