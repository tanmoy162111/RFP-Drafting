import type { ExportState } from '../../../review/stats';
import { Icon } from '../../icons';
import { SubmitButton } from '../../submit-button';
import { exportAction } from './actions';

export function ExportPanel({ slug, state, pending, total }: { slug: string; state: ExportState; pending: number; total: number }) {
  return (
    <section aria-labelledby="export-heading" className="panel">
      <h2 id="export-heading">Export (mock)</h2>
      {state === 'pending-review' && (
        <>
          <p>
            {pending} of {total} answers still need a decision before export.
          </p>
          <p className="hint">Accept, edit or reject every question. Nothing is exported until each one has a decision.</p>
        </>
      )}
      {state === 'ready' && (
        <form action={exportAction}>
          <input type="hidden" name="slug" value={slug} />
          <p>
            Every question has a decision. Recording the export writes an approval record for each accepted or edited
            answer. Nothing is sent anywhere.
          </p>
          <div className="actions">
            <SubmitButton pendingLabel="Recording…" icon="check">
              Record mock export
            </SubmitButton>
          </div>
        </form>
      )}
      {state === 'exported' && (
        <>
          <p className="status-ok">
            <Icon name="check" size={18} />
            <span>Mock export recorded.</span>
          </p>
          <a className="btn btn-primary" href={`/documents/${encodeURIComponent(slug)}/export.csv`}>
            <Icon name="download" />
            Download CSV (mock)
          </a>
        </>
      )}
    </section>
  );
}
