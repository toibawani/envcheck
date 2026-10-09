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

function sharedPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i >= a.length - 1) return false;
  if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true;
  return false;
}

export function suggestKey(
  needle: string,
  schemaKeys: string[],
  maxDistance: number = 3,
): string | undefined {
  const upper = needle.toUpperCase();
  if (upper.length < 2) return undefined;

  // Exact matches win over fuzzy matches.
  const exact = schemaKeys.find((k) => k.toUpperCase() === upper);
  if (exact) return exact;

  let best: string | undefined;
  let bestDist = maxDistance + 1;
  let bestPrefix = -1;
  let bestTrans = false;

  for (const key of schemaKeys) {
    if (key.length < 4) continue;
    const cand = key.toUpperCase();
    if (cand === upper) continue;
    const d = levenshtein(upper, cand, maxDistance);
    if (d <= 0 || d > maxDistance) continue;
    const prefix = sharedPrefixLen(upper, cand);
    const trans = d === 2 && isTransposition(upper, cand);
    const better =
      d < bestDist ||
      (d === bestDist && trans && !bestTrans) ||
      (d === bestDist && trans === bestTrans && prefix > bestPrefix);
    if (better) {
      best = key;
      bestDist = d;
      bestPrefix = prefix;
      bestTrans = trans;
    }
  }
  return best;
}
