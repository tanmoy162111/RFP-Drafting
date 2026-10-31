export type Decision = 'accept' | 'edit' | 'reject';

export interface Review {
  id: string;
  draftId: string;
  decision: Decision;
  finalText?: string;
}

export interface ReviewItem {
  draftId: string;
  /** Null for needs_human drafts, which carry no unreviewed text. */
  answerText: string | null;
  review?: Review;
}

export interface ExportRow {
  draftId: string;
  reviewId: string;
  text: string;
}

export class ExportRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportRefusedError';
  }
}

/**
 * The only path to an export. Throws if any item is unreviewed, mismatched or has no text.
 * Rejected items are omitted. Nothing leaves without a review record.
 */
export function selectExportRows(items: ReviewItem[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const item of items) {
    const review = item.review;
    if (!review) throw new ExportRefusedError(`draft ${item.draftId} has no review`);
    if (review.draftId !== item.draftId) {
      throw new ExportRefusedError(`review ${review.id} does not belong to draft ${item.draftId}`);
    }
    if (review.decision === 'reject') continue;

    const text = review.decision === 'edit' ? review.finalText : item.answerText;
    if (text === undefined || text === null || text.trim() === '') {
      throw new ExportRefusedError(`draft ${item.draftId} has no exportable text`);
    }
    rows.push({ draftId: item.draftId, reviewId: review.id, text });
  }
  return rows;
}
