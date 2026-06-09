const LESELOGG_CACHE_TTL = 60 * 60 * 1000;

export function erLeseloggCachet(sakId: string): boolean {
  const raw = sessionStorage.getItem(`leselogg-${sakId}`);
  if (!raw) return false;
  return Date.now() - Number(raw) < LESELOGG_CACHE_TTL;
}

export function cacheLeselogg(sakId: string) {
  sessionStorage.setItem(`leselogg-${sakId}`, String(Date.now()));
}
