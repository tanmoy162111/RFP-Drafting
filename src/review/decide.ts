import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drafts, exportsTable, reviews } from '../db/schema';
import type { Decision } from '../domain/approval';
import { editDistance } from '../domain/scoring';

export type ReviewErrorCode = 'not_found' | 'locked' | 'empty_text' | 'no_draft_text';

export class ReviewError extends Error {
  constructor(
    readonly code: ReviewErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface ReviewInput {
  draftId: string;
  decision: Decision;
  /** Required for `edit`. */
  finalText?: string;
  reviewer: string;
}

/**
 * Records (or replaces) the one review for a draft. Refuses once the review has been exported,
 * because the export row points at it. The lock check is not atomic; acceptable for a single-reviewer demo.
 */
export async function recordReview(db: Db, input: ReviewInput): Promise<{ reviewId: string; editDistance: number }> {
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, input.draftId));
  if (!draft) throw new ReviewError('not_found', 'draft not found');

  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.draftId, draft.id));
  if (existing) {
    const [exported] = await db.select({ id: exportsTable.id }).from(exportsTable).where(eq(exportsTable.reviewId, existing.id));
    if (exported) throw new ReviewError('locked', 'this answer was already exported');
  }

  let finalText: string | null = null;
  let distance = 0;
  if (input.decision === 'accept') {
    if (draft.answerText === null) throw new ReviewError('no_draft_text', 'there is no drafted answer to accept');
  } else if (input.decision === 'edit') {
    const text = input.finalText?.trim() ?? '';
    if (text === '') throw new ReviewError('empty_text', 'the reviewed answer is empty');
    finalText = text;
    distance = draft.answerText === null ? 0 : editDistance(draft.answerText, text);
  }

  const [row] = await db
    .insert(reviews)
    .values({ draftId: draft.id, reviewer: input.reviewer, decision: input.decision, finalText, editDistance: distance })
    .onConflictDoUpdate({
      target: reviews.draftId,
      set: { reviewer: input.reviewer, decision: input.decision, finalText, editDistance: distance, decidedAt: new Date() },
    })
    .returning({ id: reviews.id });
  return { reviewId: row!.id, editDistance: distance };
}
