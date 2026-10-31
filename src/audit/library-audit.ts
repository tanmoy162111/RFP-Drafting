import { DEFAULT_CONFIG, type DomainConfig } from '../domain/config';
import { findConflicts } from '../domain/conflict';
import { detectInjection } from '../domain/injection';
import { isStale } from '../domain/staleness';
import type { Evidence, Fact, SourceStatus } from '../domain/types';
import { contentWords, indexText, stem } from '../ingest/text';

export type LibraryFindingKind = 'stale' | 'conflict' | 'duplicate' | 'injection';

export interface AuditFinding {
  kind: LibraryFindingKind;
  sourceId?: string;
  entryId?: string;
  detail: string;
}

export interface AuditSource {
  id: string;
  slug: string;
  status: SourceStatus;
  lastReviewedAt: string;
}

export interface AuditEntry {
  id: string;
  sourceId: string;
  topic: string;
  text: string;
  facts: Fact[];
}

/** Entries whose stemmed content-word sets overlap at least this much are reported as duplicates. */
const DUPLICATE_THRESHOLD = 0.45;

const wordSet = (entry: AuditEntry): Set<string> => new Set(contentWords(indexText(entry.topic, entry.text)).map(stem));

function jaccard(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Content-readiness findings for the whole library. Gap findings need retrieval and live in run.ts. */
export function auditLibrary(
  sources: AuditSource[],
  entries: AuditEntry[],
  now: Date,
  config: DomainConfig = DEFAULT_CONFIG,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  for (const s of sources) {
    if (s.status === 'deprecated') {
      findings.push({ kind: 'stale', sourceId: s.id, detail: `${s.slug}: deprecated source is still in the library` });
    } else if (isStale(s.lastReviewedAt, now, config.stalenessMonths)) {
      findings.push({ kind: 'stale', sourceId: s.id, detail: `${s.slug}: last reviewed ${s.lastReviewedAt}` });
    }
  }

  const live = entries.filter((e) => {
    const s = sourceById.get(e.sourceId);
    return s !== undefined && s.status === 'approved' && !isStale(s.lastReviewedAt, now, config.stalenessMonths);
  });

  const asEvidence: Evidence[] = live.map((e) => ({
    entryId: e.id,
    sourceId: e.sourceId,
    sourceStatus: 'approved',
    lastReviewedAt: sourceById.get(e.sourceId)!.lastReviewedAt,
    text: e.text,
    score: 1,
    facts: e.facts,
  }));
  for (const conflict of findConflicts(asEvidence)) {
    findings.push({
      kind: 'conflict',
      entryId: conflict.values[0]!.entryId,
      detail: `${conflict.key}: ${conflict.values.map((v) => `${v.value} [${v.entryId}]`).join(' vs ')}`,
    });
  }

  const sets = live.map(wordSet);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const similarity = jaccard(sets[i]!, sets[j]!);
      if (similarity >= DUPLICATE_THRESHOLD) {
        findings.push({
          kind: 'duplicate',
          entryId: live[i]!.id,
          detail: `${live[i]!.topic} resembles ${live[j]!.topic} [${live[j]!.id}] (overlap ${similarity.toFixed(2)})`,
        });
      }
    }
  }

  for (const e of entries) {
    if (detectInjection(e.text)) {
      findings.push({ kind: 'injection', sourceId: e.sourceId, entryId: e.id, detail: `${e.topic}: contains instruction-like text` });
    }
  }
  return findings;
}
