import { beforeEach, describe, expect, it } from 'vitest';
import { readRememberedSchool, useSchoolStore } from './schoolStore';

const primary = { id: 'school-p', name: 'Kilimanjaro Primary', code: 'KS-PRI', type: 'PRIMARY', gender: 'BOTH' };
const secondary = { id: 'school-s', name: 'Kilimanjaro Secondary', code: 'KS-SEC', type: 'SECONDARY', gender: 'BOTH' };

describe('remembered school', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSchoolStore.getState().reset();
  });

  it('is still selected after a refresh', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    // a refresh: memory is wiped, the stored session brings the user back
    useSchoolStore.getState().reset();
    useSchoolStore.getState().loadForUser('manager-1');
    expect(useSchoolStore.getState().activeSchool?.id).toBe('school-p');
  });

  it('is kept per user, so nobody inherits another account\'s school', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    useSchoolStore.getState().reset();
    useSchoolStore.getState().loadForUser('head-finance-1');
    expect(useSchoolStore.getState().activeSchool).toBeNull();
    useSchoolStore.getState().setActiveSchool(secondary);
    expect(readRememberedSchool('manager-1')?.id).toBe('school-p');
    expect(readRememberedSchool('head-finance-1')?.id).toBe('school-s');
  });

  it('survives signing out and back in', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    useSchoolStore.getState().reset(); // sign out
    expect(useSchoolStore.getState().activeSchool).toBeNull();
    useSchoolStore.getState().loadForUser('manager-1'); // sign in
    expect(useSchoolStore.getState().activeSchool?.id).toBe('school-p');
  });

  it('is only paused on a whole-group page and comes back afterwards', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    useSchoolStore.getState().suspendForGroupPage();
    expect(useSchoolStore.getState().activeSchool).toBeNull();
    expect(useSchoolStore.getState().preferredSchool?.id).toBe('school-p');
    expect(readRememberedSchool('manager-1')?.id).toBe('school-p');
    useSchoolStore.getState().resumePreferred();
    expect(useSchoolStore.getState().activeSchool?.id).toBe('school-p');
  });

  it('opens a reload on a group page without scoping, but remembers the school', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    useSchoolStore.getState().reset();
    useSchoolStore.getState().loadForUser('manager-1', true);
    expect(useSchoolStore.getState().activeSchool).toBeNull();
    expect(useSchoolStore.getState().preferredSchool?.id).toBe('school-p');
  });

  it('is forgotten only when the user chooses All Schools', () => {
    useSchoolStore.getState().loadForUser('manager-1');
    useSchoolStore.getState().setActiveSchool(primary);
    useSchoolStore.getState().setActiveSchool(null);
    expect(readRememberedSchool('manager-1')).toBeNull();
    useSchoolStore.getState().reset();
    useSchoolStore.getState().loadForUser('manager-1');
    expect(useSchoolStore.getState().activeSchool).toBeNull();
  });

  it('ignores damaged storage instead of crashing', () => {
    window.localStorage.setItem('ks.web.active-school.v2', '{not json');
    useSchoolStore.getState().loadForUser('manager-1');
    expect(useSchoolStore.getState().activeSchool).toBeNull();
    window.localStorage.setItem('ks.web.active-school.v2', JSON.stringify({ 'manager-1': { id: 5 } }));
    useSchoolStore.getState().loadForUser('manager-1');
    expect(useSchoolStore.getState().activeSchool).toBeNull();
  });
});
