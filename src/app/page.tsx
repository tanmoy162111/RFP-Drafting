import Link from 'next/link';
import { listDocuments } from '../review/queries';
import { getDb } from './db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const documents = await listDocuments(getDb());
  return (
    <main>
      <h1>Documents to review</h1>
      <p className="meta">All questions, drafts and sources here are synthetic.</p>
      {documents.length === 0 ? (
        <p>
          No documents yet. Run <code>pnpm eval</code> to load the mock fixtures and draft them.
        </p>
      ) : (
        <ul className="doc-list">
          {documents.map((d) => (
            <li key={d.slug}>
              <Link href={`/documents/${d.slug}`}>{d.title}</Link>
              <p className="meta">
                {d.kind === 'rfp' ? 'RFP' : 'Security questionnaire'} · {d.total} questions · {d.draftable} drafted ·{' '}
                {d.needsHuman} need a person · {d.reviewed} reviewed
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
