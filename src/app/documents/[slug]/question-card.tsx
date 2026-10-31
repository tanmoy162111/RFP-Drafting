import { isMinorEdit } from '../../../review/stats';
import type { QuestionView } from '../../../review/types';
import { Icon, type IconName } from '../../icons';
import { SubmitButton } from '../../submit-button';
import { reviewAction } from './actions';

const REASONS: Record<string, string> = {
  conflict: 'Sources disagree',
  stale: 'Sources are out of date',
  no_evidence: 'No approved source answers this',
  low_confidence: 'Could not be drafted safely',
};

type Tone = 'plain' | 'person' | 'accepted' | 'edited' | 'rejected';

function reviewedLabel(q: QuestionView): string {
  const { review, draft } = q;
  if (!review) return '';
  if (review.decision === 'accept') return 'accepted';
  if (review.decision === 'reject') return 'rejected';
  return draft?.status === 'draftable' ? 'edited' : 'written by reviewer';
}

function tone(q: QuestionView): Tone {
  if (q.review) return q.review.decision === 'accept' ? 'accepted' : q.review.decision === 'reject' ? 'rejected' : 'edited';
  return q.draft?.status === 'needs_human' ? 'person' : 'plain';
}

const TONE_ICON: Record<Tone, IconName> = { plain: 'file', person: 'alert', accepted: 'check', edited: 'pencil', rejected: 'x' };

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
  const cardTone = tone(q);

  return (
    <article id={`q-${q.ordinal}`} data-testid={`question-${q.ordinal}`} className={`card card--${cardTone}`} aria-labelledby={titleId}>
      <header className="card-head">
        <p className="eyebrow">
          {q.section} · question {q.ordinal}
        </p>
        {drafted ? (
          <span className="badge badge-info">
            <Icon name="file" size={14} />
            Drafted
          </span>
        ) : (
          <span className="badge badge-warn">
            <Icon name="alert" size={14} />
            Needs a person
          </span>
        )}
      </header>
      <h3 id={titleId}>{q.text}</h3>

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
                    <Icon name="file" size={14} />
                    <span>
                      {c.sourceTitle} · {c.topic} · last reviewed {c.reviewedAt}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <div className="callout">
          <Icon name="alert" size={18} />
          <p>
            {draft
              ? `${REASONS[draft.reasonCode ?? ''] ?? 'Review needed'} (${draft.reasonCode ?? 'unknown'}). No answer was drafted.`
              : 'No draft was generated for this question.'}
          </p>
        </div>
      )}

      {review && (
        <p className={`reviewed reviewed--${cardTone}`} role="status">
          <Icon name={TONE_ICON[cardTone]} size={18} />
          <span>
            Reviewed: {reviewedLabel(q)}
            {review.decision === 'edit' && drafted && (
              <>
                {' '}
                · Edit distance: {review.editDistance} (
                {isMinorEdit(draft?.answerText ?? '', review.finalText ?? '') ? 'minor edit' : 'major edit'})
              </>
            )}
          </span>
        </p>
      )}

      {locked ? (
        <p className="note note--lock">
          <Icon name="lock" />
          <span>Exported (mock). This answer can no longer be changed.</span>
        </p>
      ) : (
        draft && (
          <>
            <form action={reviewAction} className="actions">
              <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
              {drafted && (
                <SubmitButton name="decision" value="accept" icon="check">
                  Accept
                </SubmitButton>
              )}
              <SubmitButton name="decision" value="reject" variant="secondary" icon="x">
                {drafted ? 'Reject' : 'Leave blank'}
              </SubmitButton>
            </form>
            <details className="edit">
              <summary>
                <Icon name="pencil" />
                {drafted ? 'Edit answer' : 'Write answer'}
              </summary>
              <form action={reviewAction} className="edit-form">
                <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
                <input type="hidden" name="decision" value="edit" />
                <label htmlFor={`text-${q.ordinal}`}>Reviewed answer</label>
                <textarea
                  id={`text-${q.ordinal}`}
                  name="finalText"
                  rows={5}
                  required
                  aria-describedby={`hint-${q.ordinal}`}
                  defaultValue={review?.finalText ?? draft.answerText ?? ''}
                />
                <p id={`hint-${q.ordinal}`} className="hint">
                  Your text replaces the draft in the export, and the size of your change is recorded.
                </p>
                <div className="actions">
                  <SubmitButton>Save edit</SubmitButton>
                </div>
              </form>
            </details>
          </>
        )
      )}
    </article>
  );
}
