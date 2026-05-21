export function canLockMarks(reviewed: boolean, understandsPublishing: boolean) {
  return reviewed && understandsPublishing;
}

export function canPublishResults(finalConfirmed: boolean, visibilityConfirmed: boolean, selectedClassCount: number) {
  return finalConfirmed && visibilityConfirmed && selectedClassCount > 0;
}

export function canApprovePayment(confirmed: boolean, reason: string) {
  return confirmed && reason.trim().length >= 8;
}

export function assessmentWeightsAreValid(weights: number[]) {
  return weights.reduce((total, weight) => total + weight, 0) === 100;
}

export function selectedClassLabel(count: number) {
  return `${count} class${count === 1 ? '' : 'es'} selected`;
}
