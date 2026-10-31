import type { Db } from '../db/client';
import { auditFindings, libraryEntries, librarySources, questions } from '../db/schema';
import { screenEvidence } from '../domain/injection';
import { routeQuestion } from '../domain/routing';
import { retrieve } from '../retrieval/retrieve';
import { auditLibrary, type LibraryFindingKind } from './library-audit';

export interface StoredFinding {
  kind: LibraryFindingKind | 'gap';
  sourceId?: string;
  entryId?: string;
  questionId?: string;
  detail: string;
}

/**
 * Audits the library and the held-out questions, replaces the stored findings and returns them.
 * A gap is a parsed question that has no usable evidence after injected text is screened out.
 */
export async function runAudit(db: Db, now: Date): Promise<StoredFinding[]> {
  const sources = await db.select().from(librarySources);
  const entries = await db.select().from(libraryEntries);

  const findings: StoredFinding[] = auditLibrary(
    sources.map((s) => ({ id: s.id, slug: s.slug, status: s.status, lastReviewedAt: s.lastReviewedAt })),
    entries.map((e) => ({ id: e.id, sourceId: e.sourceId, topic: e.topic, text: e.text, facts: e.facts })),
    now,
  );

  const heldOut = await db.select({ id: questions.id, text: questions.text, parseStatus: questions.parseStatus }).from(questions);
  for (const question of heldOut) {
    if (question.parseStatus !== 'parsed') continue;
    const { clean } = screenEvidence(await retrieve(db, question.text));
    const route = routeQuestion(clean, now);
    if (route.status === 'needs_human' && route.reason === 'no_evidence') {
      findings.push({ kind: 'gap', questionId: question.id, detail: `no usable evidence for: ${question.text}` });
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(auditFindings);
    if (findings.length > 0) await tx.insert(auditFindings).values(findings);
  });
  return findings;
}
