import { isMinorEdit } from '../../../review/stats';
import type { QuestionView } from '../../../review/types';
import { reviewAction } from './actions';

const REASONS: Record<string, string> = {
  conflict: 'Sources disagree',
  stale: 'Sources are out of date',
  no_evidence: 'No approved source answers this',
  low_confidence: 'Could not be drafted safely',
};

function reviewedLabel(q: QuestionView): string {
  const { review, draft } = q;
  if (!review) return '';
  if (review.decision === 'accept') return 'accepted';
  if (review.decision === 'reject') return 'rejected';
  return draft?.status === 'draftable' ? 'edited' : 'written by reviewer';
}

function HiddenFields({ slug, draftId, ordinal }: { slug: string; draftId: string; ordinal: number }) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="ordinal" value={ordinal} />
    </>
  );
}

export function QuestionCard({ slug, q }: { slug: string; q: QuestionView }) {
  const { draft, review } = q;
  const drafted = draft?.status === 'draftable';
  const locked = review?.exported === true;
  const titleId = `q-${q.ordinal}-title`;

  return (
    <article id={`q-${q.ordinal}`} data-testid={`question-${q.ordinal}`} className="card" aria-labelledby={titleId}>
      <p className="eyebrow">
        {q.section} · question {q.ordinal}
      </p>
      <h3 id={titleId}>{q.text}</h3>
      {drafted ? (
        <span className="badge badge-drafted">Drafted</span>
      ) : (
        <span className="badge badge-person">Needs a person</span>
      )}

      {draft?.answerText ? (
        <>
          <h4>Draft answer</h4>
          <p className="answer">{draft.answerText}</p>
          {q.citations.length > 0 && (
            <>
              <h4>Sources</h4>
              <ul className="sources">
                {q.citations.map((c) => (
                  <li key={c.entryId}>
                    {c.sourceTitle} · {c.topic} · last reviewed {c.reviewedAt}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="note">
          {draft
            ? `${REASONS[draft.reasonCode ?? ''] ?? 'Review needed'} (${draft.reasonCode ?? 'unknown'}). No answer was drafted.`
            : 'No draft was generated for this question.'}
        </p>
      )}

      {review && (
        <p className="reviewed">
          Reviewed: {reviewedLabel(q)}
          {review.decision === 'edit' && drafted && (
            <>
              {' '}
              · Edit distance: {review.editDistance} (
              {isMinorEdit(draft?.answerText ?? '', review.finalText ?? '') ? 'minor edit' : 'major edit'})
            </>
          )}
        </p>
      )}

      {locked ? (
        <p className="note">Exported (mock). This answer can no longer be changed.</p>
      ) : (
        draft && (
          <>
            <form action={reviewAction} className="actions">
              <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
              {drafted && (
                <button type="submit" name="decision" value="accept">
                  Accept
                </button>
              )}
              <button type="submit" name="decision" value="reject" className="secondary">
                {drafted ? 'Reject' : 'Leave blank'}
              </button>
            </form>
            <details className="edit">
              <summary>{drafted ? 'Edit answer' : 'Write answer'}</summary>
              <form action={reviewAction}>
                <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
                <input type="hidden" name="decision" value="edit" />
                <label htmlFor={`text-${q.ordinal}`}>Reviewed answer</label>
                <textarea
                  id={`text-${q.ordinal}`}
                  name="finalText"
                  rows={5}
                  required
                  defaultValue={review?.finalText ?? draft.answerText ?? ''}
                />
                <div className="actions">
                  <button type="submit">Save edit</button>
                </div>
              </form>
            </details>
          </>
        )
      )}
    </article>
  );
}
