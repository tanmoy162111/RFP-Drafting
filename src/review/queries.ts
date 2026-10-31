import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { citations, drafts, exportsTable, libraryEntries, librarySources, questions, reviews, rfpDocuments } from '../db/schema';
import type { CitationView, DocumentView, QuestionView, ReviewView } from './types';

export interface DocumentSummary {
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  total: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  exported: number;
}

type SummaryRow = {
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  total: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  exported: number;
};

export async function listDocuments(db: Db): Promise<DocumentSummary[]> {
  const rows = await db.execute<SummaryRow>(sql`
    SELECT d.slug, d.title, d.kind,
           count(q.id)::int AS total,
           (count(dr.id) FILTER (WHERE dr.status = 'draftable'))::int AS draftable,
           (count(dr.id) FILTER (WHERE dr.status = 'needs_human'))::int AS "needsHuman",
           count(rv.id)::int AS reviewed,
           count(ex.id)::int AS exported
    FROM rfp_documents d
    LEFT JOIN questions q ON q.document_id = d.id
    LEFT JOIN drafts dr ON dr.question_id = q.id
    LEFT JOIN reviews rv ON rv.draft_id = dr.id
    LEFT JOIN exports ex ON ex.review_id = rv.id
    GROUP BY d.id
    ORDER BY d.title`);
  return [...rows];
}

/** One document with every question, its draft, citations and review. Null when the slug is unknown. */
export async function getReviewDocument(db: Db, slug: string): Promise<DocumentView | null> {
  const [doc] = await db.select().from(rfpDocuments).where(eq(rfpDocuments.slug, slug));
  if (!doc) return null;

  const rows = await db
    .select({ q: questions, d: drafts })
    .from(questions)
    .leftJoin(drafts, eq(drafts.questionId, questions.id))
    .where(eq(questions.documentId, doc.id))
    .orderBy(questions.ordinal);

  const draftIds = rows.flatMap((r) => (r.d ? [r.d.id] : []));
  const reviewRows =
    draftIds.length === 0
      ? []
      : await db
          .select({ r: reviews, exportId: exportsTable.id })
          .from(reviews)
          .leftJoin(exportsTable, eq(exportsTable.reviewId, reviews.id))
          .where(inArray(reviews.draftId, draftIds));
  const citationRows =
    draftIds.length === 0
      ? []
      : await db
          .select({
            draftId: citations.draftId,
            entryId: citations.entryId,
            quote: citations.quoteSpan,
            topic: libraryEntries.topic,
            sourceTitle: librarySources.title,
            sourceStatus: librarySources.status,
            reviewedAt: librarySources.lastReviewedAt,
          })
          .from(citations)
          .innerJoin(libraryEntries, eq(libraryEntries.id, citations.entryId))
          .innerJoin(librarySources, eq(librarySources.id, libraryEntries.sourceId))
          .where(inArray(citations.draftId, draftIds));

  const reviewByDraft = new Map<string, ReviewView>(
    reviewRows.map(({ r, exportId }) => [
      r.draftId,
      { id: r.id, decision: r.decision, finalText: r.finalText, editDistance: r.editDistance, exported: exportId !== null },
    ]),
  );
  const citationsByDraft = new Map<string, CitationView[]>();
  for (const c of citationRows) {
    const list = citationsByDraft.get(c.draftId) ?? [];
    list.push({
      entryId: c.entryId,
      sourceTitle: c.sourceTitle,
      sourceStatus: c.sourceStatus,
      topic: c.topic,
      reviewedAt: c.reviewedAt,
      quote: c.quote,
    });
    citationsByDraft.set(c.draftId, list);
  }

  const views: QuestionView[] = rows.map(({ q, d }) => ({
    questionId: q.id,
    ordinal: q.ordinal,
    section: q.section,
    text: q.text,
    parseStatus: q.parseStatus,
    draft: d
      ? { id: d.id, status: d.status, reasonCode: d.reasonCode, answerText: d.answerText, model: d.model }
      : null,
    citations: d ? (citationsByDraft.get(d.id) ?? []) : [],
    review: d ? (reviewByDraft.get(d.id) ?? null) : null,
  }));

  return { id: doc.id, slug: doc.slug, title: doc.title, kind: doc.kind, questions: views };
}
