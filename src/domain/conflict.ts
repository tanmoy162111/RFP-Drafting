import type { Evidence } from './types';

export interface Conflict {
  key: string;
  values: { entryId: string; value: string }[];
}

const normalize = (value: string): string => value.trim().toLowerCase();

/** Fact keys for which the evidence asserts more than one distinct value. */
export function findConflicts(evidence: Evidence[]): Conflict[] {
  const byKey = new Map<string, Map<string, string[]>>();
  for (const entry of evidence) {
    for (const fact of entry.facts) {
      const value = normalize(fact.value);
      const values = byKey.get(fact.key) ?? new Map<string, string[]>();
      values.set(value, [...(values.get(value) ?? []), entry.entryId]);
      byKey.set(fact.key, values);
    }
  }

  const conflicts: Conflict[] = [];
  for (const [key, values] of byKey) {
    if (values.size < 2) continue;
    conflicts.push({
      key,
      values: [...values].flatMap(([value, entryIds]) => entryIds.map((entryId) => ({ entryId, value }))),
    });
  }
  return conflicts;
}
