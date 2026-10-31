/** True when `lastReviewedAt` (ISO date) is more than `months` months before `now`. Unparseable dates count as stale. */
export function isStale(lastReviewedAt: string, now: Date, months: number): boolean {
  const reviewed = new Date(lastReviewedAt);
  if (Number.isNaN(reviewed.getTime())) return true;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return reviewed < cutoff;
}
