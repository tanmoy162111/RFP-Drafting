import type { Db } from '../db/client';
import { exportsTable } from '../db/schema';
import { ExportRefusedError, selectExportRows, type ReviewItem } from '../domain/approval';
import { toCsv } from './csv';
import { ReviewError } from './decide';
import { getReviewDocument } from './queries';
import { buildSheetRows } from './sheet';
import type { DocumentView } from './types';

export class ExportNotRecordedError extends Error {
  constructor() {
    super('The export has not been recorded yet.');
    this.name = 'ExportNotRecordedError';
  }
}

/** Maps the view to the domain's review items. A question with no draft cannot be exported. */
function toReviewItems(view: DocumentView): ReviewItem[] {
  return view.questions.map((q) => {
    if (!q.draft) throw new ExportRefusedError(`question ${q.ordinal} has no draft`);
    return {
      draftId: q.draft.id,
      answerText: q.draft.answerText,
      review: q.review
        ? { id: q.review.id, draftId: q.draft.id, decision: q.review.decision, finalText: q.review.finalText ?? undefined }
        : undefined,
    };
  });
}

/**
 * Writes one export row per accepted or edited answer. The domain gate (selectExportRows) runs first and
 * throws if anything is unreviewed; the database trigger independently refuses rejected reviews.
 */
export async function exportDocument(db: Db, slug: string): Promise<{ exported: number }> {
  const view = await getReviewDocument(db, slug);
  if (!view) throw new ReviewError('not_found', 'document not found');

  const rows = selectExportRows(toReviewItems(view));
  if (rows.length > 0) {
    await db
      .insert(exportsTable)
      .values(rows.map((row) => ({ documentId: view.id, reviewId: row.reviewId })))
      .onConflictDoNothing({ target: exportsTable.reviewId });
  }
  return { exported: rows.length };
}

/** The mock completed sheet. Only served when every exportable answer has an export record. */
export async function exportSheet(db: Db, slug: string): Promise<{ csv: string; filename: string }> {
  const view = await getReviewDocument(db, slug);
  if (!view) throw new ReviewError('not_found', 'document not found');

  const rows = selectExportRows(toReviewItems(view));
  const recorded = new Set(view.questions.flatMap((q) => (q.review?.exported ? [q.review.id] : [])));
  if (rows.length === 0 || !rows.every((row) => recorded.has(row.reviewId))) throw new ExportNotRecordedError();

  return { csv: toCsv(buildSheetRows(view.questions)), filename: `${view.slug}-mock-export.csv` };
}
