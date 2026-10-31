import Link from 'next/link';
import { listDocuments } from '../review/queries';
import { getDb } from './db';
import { Icon } from './icons';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const documents = await listDocuments(getDb());
  return (
    <main id="main" tabIndex={-1}>
      <h1>Documents to review</h1>
      <p className="meta">All questions, drafts and sources here are synthetic.</p>
      {documents.length === 0 ? (
        <p className="empty">
          <Icon name="alert" />
          <span>
            No documents yet. Run <code>pnpm eval</code> to load the mock fixtures and draft them.
          </span>
        </p>
      ) : (
        <ul className="doc-list">
          {documents.map((d) => {
            const percent = d.total === 0 ? 0 : Math.round((d.reviewed / d.total) * 100);
            return (
              <li key={d.slug} className="doc-card">
                <div>
                  <Link className="doc-title" href={`/documents/${d.slug}`}>
                    {d.title}
                  </Link>
                  <p className="meta">
                    {d.kind === 'rfp' ? 'RFP' : 'Security questionnaire'} · {d.total} questions · {d.draftable} drafted ·{' '}
                    {d.needsHuman} need a person · {d.reviewed} reviewed
                  </p>
                </div>
                <div
                  className="meter"
                  role="progressbar"
                  aria-label={`Review progress for ${d.title}`}
                  aria-valuemin={0}
                  aria-valuemax={d.total}
                  aria-valuenow={d.reviewed}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div>
                  <Link className="btn btn-secondary" href={`/documents/${d.slug}`} aria-label={`Open review: ${d.title}`}>
                    Open review
                    <Icon name="arrow" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
