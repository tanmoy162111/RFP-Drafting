import type { ReviewSummary } from '../../../review/stats';

export function ReviewSummaryPanel({ summary }: { summary: ReviewSummary }) {
  const kept = summary.acceptedWithoutMajorEdits;
  const percent = summary.questions === 0 ? 0 : Math.round((summary.reviewed / summary.questions) * 100);
  return (
    <section aria-labelledby="summary-heading" className="panel">
      <h2 id="summary-heading">Progress</h2>
      <p>
        <strong>
          {summary.reviewed} of {summary.questions} reviewed
        </strong>
      </p>
      <div
        className="meter"
        role="progressbar"
        aria-label="Review progress"
        aria-valuemin={0}
        aria-valuemax={summary.questions}
        aria-valuenow={summary.reviewed}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <dl className="stat-grid">
        <div className="stat">
          <dt>Accepted as drafted</dt>
          <dd>{summary.accepted}</dd>
        </div>
        <div className="stat">
          <dt>Edited slightly</dt>
          <dd>{summary.editedMinor}</dd>
        </div>
        <div className="stat">
          <dt>Edited heavily</dt>
          <dd>{summary.editedMajor}</dd>
        </div>
        <div className="stat">
          <dt>Written by a person</dt>
          <dd>{summary.writtenByPerson}</dd>
        </div>
        <div className="stat">
          <dt>Rejected</dt>
          <dd>{summary.rejected}</dd>
        </div>
      </dl>
      <div className="kpi">
        <p className="kpi-label">Accepted without major edits</p>
        <p className="kpi-value">{kept === null ? 'Not enough reviews yet' : `${(kept * 100).toFixed(0)}%`}</p>
      </div>
      <p className="note">
        Estimated time saved: {summary.minutesSavedEstimate} minutes. This is an assumption (minutes per manual answer
        times answers kept), not a measurement.
      </p>
    </section>
  );
}
