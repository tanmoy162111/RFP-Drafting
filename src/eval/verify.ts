import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { citations, drafts, libraryEntries, librarySources } from '../db/schema';
import { checkProvenance } from '../domain/provenance';
import type { Evidence } from '../domain/types';

/**
 * Re-checks persisted drafts from what is actually in the database: every draftable draft must have
 * citations, and its answer must be grounded in exactly those cited entries.
 */
export async function verifyPersistedDrafts(db: Db, draftIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>(draftIds.map((id) => [id, false]));
  if (draftIds.length === 0) return result;

  const draftRows = await db.select({ id: drafts.id, answer: drafts.answerText }).from(drafts).where(inArray(drafts.id, draftIds));
  const citationRows = await db
    .select({
      draftId: citations.draftId,
      entryId: citations.entryId,
      quote: citations.quoteSpan,
      text: libraryEntries.text,
      facts: libraryEntries.facts,
      sourceId: libraryEntries.sourceId,
      status: librarySources.status,
      reviewed: librarySources.lastReviewedAt,
    })
    .from(citations)
    .innerJoin(libraryEntries, eq(libraryEntries.id, citations.entryId))
    .innerJoin(librarySources, eq(librarySources.id, libraryEntries.sourceId))
    .where(inArray(citations.draftId, draftIds));

  for (const draft of draftRows) {
    const cited = citationRows.filter((c) => c.draftId === draft.id);
    if (cited.length === 0 || draft.answer === null) continue;
    const evidence: Evidence[] = cited.map((c) => ({
      entryId: c.entryId,
      sourceId: c.sourceId,
      sourceStatus: c.status,
      lastReviewedAt: c.reviewed,
      text: c.text,
      score: 1,
      facts: c.facts,
    }));
    const claims = cited.map((c) => ({ text: c.quote ?? '', entryIds: [c.entryId] }));
    result.set(draft.id, checkProvenance({ answer: draft.answer, claims }, evidence).ok);
  }
  return result;
}
