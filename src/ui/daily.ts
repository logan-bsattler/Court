/**
 * The daily match: everyone gets the same two deals on a given UTC day.
 * Seeds are derived from the date string, so they need no server.
 */
export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** FNV-1a hash of the date, then two deal seeds. */
export function dailySeeds(date: string): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const a = h >>> 0;
  return [a, (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1];
}
