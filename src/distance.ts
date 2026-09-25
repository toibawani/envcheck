/** Levenshtein with an early-exit cap so a 40-char key doesn't dominate a scan. */
export function levenshtein(a: string, b: string, cap = 8): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] ?? cap + 1;
}

export function suggestKey(needle: string, schemaKeys: string[], maxDistance: number): string | undefined {
  const upper = needle.toUpperCase();
  let best: string | undefined;
  let bestDist = maxDistance + 1;
  for (const key of schemaKeys) {
    const d = levenshtein(upper, key.toUpperCase(), maxDistance);
    if (d > 0 && d < bestDist) {
      best = key;
      bestDist = d;
      if (d === 1) return key;
    }
  }
  return best;
}
