import type { ReviewSummary } from '../../../review/stats';

export function ReviewSummaryPanel({ summary }: { summary: ReviewSummary }) {
  const kept = summary.acceptedWithoutMajorEdits;
  return (
    <section aria-labelledby="summary-heading" className="panel">
      <h2 id="summary-heading">Progress</h2>
      <p>
        <strong>
          {summary.reviewed} of {summary.questions} reviewed
        </strong>
      </p>
      <dl className="stats">
        <div>
          <dt>Accepted as drafted</dt>
          <dd>{summary.accepted}</dd>
        </div>
        <div>
          <dt>Edited slightly</dt>
          <dd>{summary.editedMinor}</dd>
        </div>
        <div>
          <dt>Edited heavily</dt>
          <dd>{summary.editedMajor}</dd>
        </div>
        <div>
          <dt>Written by a person</dt>
          <dd>{summary.writtenByPerson}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{summary.rejected}</dd>
        </div>
      </dl>
      <p>
        Accepted without major edits:{' '}
        <strong>{kept === null ? 'not enough reviews yet' : `${(kept * 100).toFixed(0)}%`}</strong>
      </p>
      <p className="note">
        Estimated time saved: {summary.minutesSavedEstimate} minutes. This is an assumption (minutes per manual answer
        times answers kept), not a measurement.
      </p>
    </section>
  );
}
