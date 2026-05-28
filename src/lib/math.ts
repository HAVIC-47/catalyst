// Client-side correlation + aggregation math.

/** Pearson correlation coefficient. Returns 0 when undefined (constant series / <2 points). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const dx = Math.sqrt(n * sxx - sx * sx);
  const dy = Math.sqrt(n * syy - sy * sy);
  if (dx === 0 || dy === 0) return 0;
  return clamp(cov / (dx * dy), -1, 1);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0;
}

/** Plain-language reading of a correlation magnitude. */
export function correlationLabel(r: number): string {
  const a = Math.abs(r);
  const strength = a >= 0.6 ? "Strong" : a >= 0.3 ? "Moderate" : a >= 0.12 ? "Mild" : "No clear";
  if (a < 0.12) return "No clear link";
  const dir = r > 0 ? "higher mood ↔ higher net flow" : "lower mood ↔ heavier spend";
  return `${strength} link · ${dir}`;
}
