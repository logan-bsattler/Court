/** Small seeded PRNG (mulberry32) so any deal can be replayed from its seed. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform int in [0, n). */
  int(n: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

/** Fisher–Yates, in place. */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[rng.int(arr.length)];
}

export const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
