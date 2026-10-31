import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReviewDocument } from '../../../review/queries';
import { exportState, summarize } from '../../../review/stats';
import { getDb } from '../../db';
import { Icon } from '../../icons';
import { ExportPanel } from './export-panel';
import { QuestionCard } from './question-card';
import { QuestionNav } from './question-nav';
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

type Filter = 'all' | 'todo' | 'person';

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; filter?: string }>;
}) {
  const { slug } = await params;
  const { error, filter: rawFilter } = await searchParams;
  const view = await getReviewDocument(getDb(), slug);
  if (!view) notFound();

  const summary = summarize(view.questions);
  const state = exportState(view.questions);
  const filter: Filter = rawFilter === 'todo' || rawFilter === 'person' ? rawFilter : 'all';
  const base = `/documents/${encodeURIComponent(slug)}`;

  const tabs: { key: Filter; label: string; count: number; href: string }[] = [
    { key: 'all', label: 'All', count: view.questions.length, href: base },
    { key: 'todo', label: 'To review', count: view.questions.filter((q) => !q.review).length, href: `${base}?filter=todo` },
    {
      key: 'person',
      label: 'Needs a person',
      count: view.questions.filter((q) => q.draft?.status === 'needs_human').length,
      href: `${base}?filter=person`,
    },
  ];
  const visible =
    filter === 'todo'
      ? view.questions.filter((q) => !q.review)
      : filter === 'person'
        ? view.questions.filter((q) => q.draft?.status === 'needs_human')
        : view.questions;

  return (
    <main id="main" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">All documents</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{view.title}</span>
      </nav>
      <h1>{view.title}</h1>
      <p className="meta">{view.kind === 'rfp' ? 'RFP' : 'Security questionnaire'} · mock data</p>

      {error && (
        <p role="alert" className="alert">
          <Icon name="alert" size={18} />
          <span>{ERRORS[error] ?? ERRORS.unknown}</span>
        </p>
      )}

      <div className="panels">
        <ReviewSummaryPanel summary={summary} />
        <ExportPanel slug={slug} state={state} pending={summary.pending} total={summary.questions} />
      </div>

      <div className="doc-grid">
        <QuestionNav questions={view.questions} />
        <section id="questions" tabIndex={-1} aria-label="Questions">
          <nav aria-label="Filter questions" className="tabs">
            {tabs.map((tab) => (
              <Link key={tab.key} href={tab.href} className="tab" aria-current={tab.key === filter ? 'page' : undefined}>
                {tab.label}
                <span className="tab-count">{tab.count}</span>
              </Link>
            ))}
          </nav>
          {visible.length === 0 ? (
            <p className="empty">
              <Icon name="check" />
              <span>Nothing here. Every question in this view has been handled.</span>
            </p>
          ) : (
            visible.map((q) => <QuestionCard key={q.questionId} slug={slug} q={q} />)
          )}
        </section>
      </div>
    </main>
  );
}
