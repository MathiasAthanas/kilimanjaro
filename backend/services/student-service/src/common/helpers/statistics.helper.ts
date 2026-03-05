export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumX2 - sumX ** 2;
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}