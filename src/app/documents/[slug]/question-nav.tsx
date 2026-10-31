import { Icon, type IconName } from '../../icons';
import type { QuestionView } from '../../../review/types';

type ChipKey = 'none' | 'drafted' | 'person' | 'accepted' | 'edited' | 'rejected';

function chipState(q: QuestionView): { key: ChipKey; label: string; icon?: IconName } {
  if (!q.draft) return { key: 'none', label: 'no draft' };
  if (q.review) {
    if (q.review.decision === 'accept') return { key: 'accepted', label: 'accepted', icon: 'check' };
    if (q.review.decision === 'reject') return { key: 'rejected', label: 'rejected', icon: 'x' };
    return { key: 'edited', label: q.draft.status === 'draftable' ? 'edited' : 'written by reviewer', icon: 'pencil' };
  }
  return q.draft.status === 'draftable'
    ? { key: 'drafted', label: 'drafted, not reviewed' }
    : { key: 'person', label: 'needs a person, not reviewed', icon: 'alert' };
}

/** A numbered index of every question. State is shown by icon and by the link's label, not by colour alone. */
export function QuestionNav({ questions }: { questions: QuestionView[] }) {
  return (
    <nav aria-label="Jump to a question" className="qnav">
      <a className="qnav-skip" href="#questions">
        Skip to questions
      </a>
      <h2 className="qnav-title">Questions</h2>
      <ul className="qnav-list">
        {questions.map((q) => {
          const state = chipState(q);
          return (
            <li key={q.questionId}>
              <a className={`chip chip-${state.key}`} href={`#q-${q.ordinal}`} aria-label={`Question ${q.ordinal}: ${state.label}`}>
                {state.icon && <Icon name={state.icon} size={12} />}
                <span>{q.ordinal}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <ul className="legend" aria-label="Key">
        <li>
          <span className="dot" aria-hidden="true" /> Drafted
        </li>
        <li>
          <span className="dot dot-person" aria-hidden="true" /> Needs a person
        </li>
        <li>
          <span className="dot dot-accepted" aria-hidden="true" /> Accepted
        </li>
        <li>
          <span className="dot dot-edited" aria-hidden="true" /> Edited
        </li>
        <li>
          <span className="dot dot-rejected" aria-hidden="true" /> Rejected
        </li>
      </ul>
    </nav>
  );
}
