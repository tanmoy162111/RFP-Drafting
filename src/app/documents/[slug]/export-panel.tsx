import type { ExportState } from '../../../review/stats';
import { exportAction } from './actions';

export function ExportPanel({ slug, state, pending, total }: { slug: string; state: ExportState; pending: number; total: number }) {
  return (
    <section aria-labelledby="export-heading" className="panel">
      <h2 id="export-heading">Export (mock)</h2>
      {state === 'pending-review' && (
        <p>
          {pending} of {total} answers still need a decision before export.
        </p>
      )}
      {state === 'ready' && (
        <form action={exportAction}>
          <input type="hidden" name="slug" value={slug} />
          <p>
            Every question has a decision. Recording the export writes an approval record for each accepted or edited
            answer. Nothing is sent anywhere.
          </p>
          <button type="submit">Record mock export</button>
        </form>
      )}
      {state === 'exported' && (
        <p>
          Mock export recorded. <a href={`/documents/${encodeURIComponent(slug)}/export.csv`}>Download CSV (mock)</a>
        </p>
      )}
    </section>
  );
}
