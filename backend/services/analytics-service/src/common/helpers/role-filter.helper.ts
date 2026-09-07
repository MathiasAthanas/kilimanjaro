export function applyRoleFilter(profile: any, input: string | string[]) {
  const roles = Array.isArray(input) ? input : [input];
  // Leadership access is not reduced by an additional teacher/parent assignment.
  const role = roles.find(r => ['SYSTEM_ADMIN','BOARD_DIRECTOR','MANAGING_DIRECTOR','PRINCIPAL','ACADEMIC_QA','HEAD_OF_DEPARTMENT'].includes(r)) ?? roles.find(r => r === 'FINANCE') ?? roles.find(r => r === 'TEACHER') ?? roles.find(r => r === 'PARENT') ?? roles[0];
  const result = JSON.parse(JSON.stringify(profile || {}));
  // Together these roles authorize the academic and financial sections.
  if (roles.includes('TEACHER') && roles.includes('FINANCE')) return result;

  if (role === 'STUDENT') {
    delete result.discipline;
    delete result.interventions;
    if (result.financial) {
      result.financial = {
        currentInvoice: result.financial.currentInvoice,
        totalOutstandingAllTime: result.financial.totalOutstandingAllTime,
      };
    }
  }

  if (role === 'PARENT') {
    delete result.interventions;
    if (result.discipline) {
      result.discipline = {
        totalIncidents: result.discipline.totalIncidents,
        bySeverity: result.discipline.bySeverity,
        byCategory: result.discipline.byCategory,
        hasEscalatedIncidents: result.discipline.hasEscalatedIncidents,
      };
    }
    if (result.performanceEngine?.activeAlerts) {
      result.performanceEngine.activeAlerts = result.performanceEngine.activeAlerts.map((alert: any) => {
        if (['RAPID_IMPROVEMENT', 'RECOVERED'].includes(alert.alertType)) return alert;
        return { ...alert, message: 'Alert active. Contact school for full internal details.' };
      });
    }
  }

  if (role === 'TEACHER') {
    if (result.financial) {
      result.financial = { hasFinancialAlert: result.financial.hasFinancialAlert };
    }
  }

  if (role === 'FINANCE') {
    if (result.academic) {
      result.academic = {
        currentTermSummary: {
          overallAverage: result.academic.currentTermSummary?.overallAverage,
          overallGrade: result.academic.currentTermSummary?.overallGrade,
          passingSubjects: result.academic.currentTermSummary?.passingSubjects,
          failingSubjects: result.academic.currentTermSummary?.failingSubjects,
        },
      };
    }
    delete result.discipline;
    delete result.interventions;
  }

  return result;
}
