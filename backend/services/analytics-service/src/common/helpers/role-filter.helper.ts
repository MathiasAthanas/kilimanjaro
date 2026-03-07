export function applyRoleFilter(profile: any, role: string) {
  const result = JSON.parse(JSON.stringify(profile || {}));

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
