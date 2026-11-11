/**
 * Predefined A-Level subject combinations (Tanzania ACSEE).
 *
 * Each combination lists three PRINCIPAL subjects. General Studies is added
 * automatically as the COMPULSORY_SUBSIDIARY that every ACSEE candidate sits,
 * satisfying the combination validation rules (>=3 principals + 1 compulsory
 * subsidiary). Schools can still create custom combinations on top of these.
 */

export const GENERAL_STUDIES = { name: 'General Studies', code: 'GS' };

export interface PredefinedCombination {
  code: string;
  name: string;
  /** Principal subjects, in display order. */
  principals: Array<{ name: string; code: string }>;
}

export const PREDEFINED_A_LEVEL_COMBINATIONS: PredefinedCombination[] = [
  { code: 'PCM', name: 'Physics, Chemistry, Advanced Mathematics', principals: [
    { name: 'Physics', code: 'PHY' }, { name: 'Chemistry', code: 'CHE' }, { name: 'Advanced Mathematics', code: 'AMATH' },
  ] },
  { code: 'PCB', name: 'Physics, Chemistry, Biology', principals: [
    { name: 'Physics', code: 'PHY' }, { name: 'Chemistry', code: 'CHE' }, { name: 'Biology', code: 'BIO' },
  ] },
  { code: 'PGM', name: 'Physics, Geography, Advanced Mathematics', principals: [
    { name: 'Physics', code: 'PHY' }, { name: 'Geography', code: 'GEO' }, { name: 'Advanced Mathematics', code: 'AMATH' },
  ] },
  { code: 'EGM', name: 'Economics, Geography, Advanced Mathematics', principals: [
    { name: 'Economics', code: 'ECON' }, { name: 'Geography', code: 'GEO' }, { name: 'Advanced Mathematics', code: 'AMATH' },
  ] },
  { code: 'HGE', name: 'History, Geography, Economics', principals: [
    { name: 'History', code: 'HIST' }, { name: 'Geography', code: 'GEO' }, { name: 'Economics', code: 'ECON' },
  ] },
  { code: 'HGK', name: 'History, Geography, Kiswahili', principals: [
    { name: 'History', code: 'HIST' }, { name: 'Geography', code: 'GEO' }, { name: 'Kiswahili', code: 'KISW' },
  ] },
  { code: 'HKL', name: 'History, Kiswahili, English Language', principals: [
    { name: 'History', code: 'HIST' }, { name: 'Kiswahili', code: 'KISW' }, { name: 'English Language', code: 'ELANG' },
  ] },
  { code: 'HGL', name: 'History, Geography, English Language', principals: [
    { name: 'History', code: 'HIST' }, { name: 'Geography', code: 'GEO' }, { name: 'English Language', code: 'ELANG' },
  ] },
  { code: 'CBG', name: 'Chemistry, Biology, Geography', principals: [
    { name: 'Chemistry', code: 'CHE' }, { name: 'Biology', code: 'BIO' }, { name: 'Geography', code: 'GEO' },
  ] },
  { code: 'CBA', name: 'Chemistry, Biology, Agriculture', principals: [
    { name: 'Chemistry', code: 'CHE' }, { name: 'Biology', code: 'BIO' }, { name: 'Agriculture', code: 'AGRIC' },
  ] },
  { code: 'ECA', name: 'Economics, Commerce, Accountancy', principals: [
    { name: 'Economics', code: 'ECON' }, { name: 'Commerce', code: 'COMM' }, { name: 'Accountancy', code: 'ACCT' },
  ] },
  { code: 'HKE', name: 'History, Kiswahili, Economics', principals: [
    { name: 'History', code: 'HIST' }, { name: 'Kiswahili', code: 'KISW' }, { name: 'Economics', code: 'ECON' },
  ] },
];
