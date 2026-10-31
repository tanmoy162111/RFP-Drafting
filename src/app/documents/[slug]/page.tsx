import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReviewDocument } from '../../../review/queries';
import { exportState, summarize } from '../../../review/stats';
import { getDb } from '../../db';
import { ExportPanel } from './export-panel';
import { QuestionCard } from './question-card';
import { ReviewSummaryPanel } from './review-summary';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  invalid: 'That request was not valid.',
  not_found: 'That item no longer exists.',
  locked: 'This answer was already exported and can no longer be changed.',
  empty_text: 'The reviewed answer cannot be empty.',
  no_draft_text: 'There is no drafted answer to accept. Write an answer or leave it blank.',
  not_ready: 'Every question needs a decision before the export can be recorded.',
  unknown: 'Something went wrong. Nothing was changed.',
};

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; filter?: string }>;
}) {
  const { slug } = await params;
  const { error, filter } = await searchParams;
  const view = await getReviewDocument(getDb(), slug);
  if (!view) notFound();

  const summary = summarize(view.questions);
  const state = exportState(view.questions);
  const todoOnly = filter === 'todo';
  const visible = todoOnly ? view.questions.filter((q) => !q.review) : view.questions;
  const base = `/documents/${encodeURIComponent(slug)}`;

  return (
    <main>
      <p className="meta">
        <Link href="/">All documents</Link>
      </p>
      <h1>{view.title}</h1>
      <p className="meta">{view.kind === 'rfp' ? 'RFP' : 'Security questionnaire'} · mock data</p>

      {error && (
        <p role="alert" className="alert">
          {ERRORS[error] ?? ERRORS.unknown}
        </p>
      )}

      <ReviewSummaryPanel summary={summary} />
      <ExportPanel slug={slug} state={state} pending={summary.pending} total={summary.questions} />

      <nav aria-label="Filter questions" className="filters">
        {todoOnly ? <Link href={base}>Show all questions</Link> : <Link href={`${base}?filter=todo`}>Only questions still to review</Link>}
      </nav>

      {visible.length === 0 ? <p>Nothing left to review.</p> : visible.map((q) => <QuestionCard key={q.questionId} slug={slug} q={q} />)}
    </main>
  );
}
