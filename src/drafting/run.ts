import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { citations, drafts, questions, rfpDocuments } from '../db/schema';
import { retrieve } from '../retrieval/retrieve';
import { decideDraft, type Decision } from './pipeline';
import type { DraftProvider } from './types';

export interface DraftedQuestion {
  questionId: string;
  /** `${document slug}:${ordinal}`, the answer key id. */
  key: string;
  ordinal: number;
  text: string;
  draftId: string;
  decision: Decision;
}

const RULES_MODEL = 'rules';

/** Writes one decision as a draft plus its citations, atomically. Returns the draft id. */
export async function saveDecision(db: Db, questionId: string, decision: Decision): Promise<string> {
  return db.transaction(async (tx) => {
    if (decision.status === 'needs_human') {
      const [row] = await tx
        .insert(drafts)
        .values({ questionId, status: 'needs_human', reasonCode: decision.reason, answerText: null, model: decision.model })
        .returning({ id: drafts.id });
      return row!.id;
    }

    const [row] = await tx
      .insert(drafts)
      .values({ questionId, status: 'draftable', reasonCode: null, answerText: decision.answer, model: decision.model })
      .returning({ id: drafts.id });

    const quoteByEntry = new Map<string, string>();
    for (const claim of decision.claims) {
      for (const entryId of claim.entryIds) if (!quoteByEntry.has(entryId)) quoteByEntry.set(entryId, claim.text);
    }
    await tx
      .insert(citations)
      .values([...quoteByEntry].map(([entryId, quoteSpan]) => ({ draftId: row!.id, entryId, quoteSpan })));
    return row!.id;
  });
}

/** Drafts every question of one document, replacing any earlier drafts for it. */
export async function draftDocument(
  db: Db,
  provider: DraftProvider,
  documentSlug: string,
  now: Date,
): Promise<DraftedQuestion[]> {
  const [document] = await db.select().from(rfpDocuments).where(eq(rfpDocuments.slug, documentSlug));
  if (!document) throw new Error(`unknown document ${documentSlug}`);

  const rows = await db.select().from(questions).where(eq(questions.documentId, document.id)).orderBy(questions.ordinal);
  if (rows.length > 0) {
    await db.delete(drafts).where(inArray(drafts.questionId, rows.map((row) => row.id)));
  }

  const results: DraftedQuestion[] = [];
  for (const row of rows) {
    const decision: Decision =
      row.parseStatus === 'unparsed'
        ? { status: 'needs_human', reason: 'low_confidence', detail: ['unparsed_row'], model: RULES_MODEL, flaggedEntryIds: [] }
        : await decideDraft(provider, {
            question: row.text,
            answerType: row.answerType,
            evidence: await retrieve(db, row.text),
            now,
          });
    const draftId = await saveDecision(db, row.id, decision);
    results.push({ questionId: row.id, key: `${documentSlug}:${row.ordinal}`, ordinal: row.ordinal, text: row.text, draftId, decision });
  }
  return results;
}
