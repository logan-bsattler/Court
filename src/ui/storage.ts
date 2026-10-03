/** localStorage for per-device conveniences only; every access may throw (private mode etc.). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`court:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`court:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
