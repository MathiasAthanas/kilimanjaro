export type CreateTermFormValues = {
  name: string;
  startDate: string;
  endDate: string;
  academicYearId: string;
};

/** Keep term creation aligned with the supported API DTO. */
export function buildCreateTermPayload(form: CreateTermFormValues) {
  return {
    name: form.name,
    startDate: form.startDate,
    endDate: form.endDate,
    academicYearId: form.academicYearId,
  };
}
