export function toChart(labels: string[], datasets: Array<{ label: string; data: number[] }>) {
  return { labels, datasets };
}
