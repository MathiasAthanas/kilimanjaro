export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  if (!x.length || x.length !== y.length) return 0;
  const mx = mean(x);
  const my = mean(y);
  let numerator = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < x.length; i += 1) {
    const xv = x[i] - mx;
    const yv = y[i] - my;
    numerator += xv * yv;
    dx += xv ** 2;
    dy += yv ** 2;
  }

  if (dx === 0 || dy === 0) return 0;
  return numerator / Math.sqrt(dx * dy);
}

export function percentileRank(values: number[], current: number): number {
  if (!values.length) return 0;
  const below = values.filter((v) => v <= current).length;
  return (below / values.length) * 100;
}
