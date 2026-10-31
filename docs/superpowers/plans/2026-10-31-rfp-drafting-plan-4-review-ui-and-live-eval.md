# RFP Drafting, Plan 4: Review UI, Mock Export and Live Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a person a web UI to review every drafted answer (accept, edit, reject), record an approval for each exported answer, download a mock completed sheet, measure "accepted without major edits" from real reviews, and then run the live eval and write up the results.

**Architecture:** A framework-free review layer in `src/review/` (queries, review decisions, export, stats, CSV) that is fully tested without a browser. A thin Next.js 16 App Router UI in `src/app/` calls it through server components and server actions (plain HTML forms, no client JavaScript required). Playwright drives the real UI end to end against a throwaway database. The export path is guarded three times: the pure `selectExportRows()` gate, the `exports.review_id NOT NULL` column, and the database trigger that rejects rejected reviews.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle/Postgres (Docker), Zod, Vitest, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-31-rfp-drafting-design.md` (sections 3, 5, 7, 9, 10). **Previous plans:** Plans 1 to 3, all done.

**Checkpoints, not commits:** The folder is not a git repository and `CLAUDE.md` says not to commit unless asked.

**Prerequisites:** `pnpm db:up` is running (`rfp-drafting-db`, port 5435). Baseline from Plan 3: 153 unit tests, 126 DB tests, `pnpm eval` passes its three hard gates. Never touch other containers.

---

## Facts verified before writing this plan (2026-10-31)

| Fact | Result |
|---|---|
| Versions on the registry | `next` 16.4.3, `react` and `react-dom` 19.3.1, `@playwright/test` 1.64.1 |
| Playwright browser | 1.64.1 needs Chromium revision 1248, which is already in `~/.cache/ms-playwright`, so no download is needed |
| Next 16 build | A scratch app built cleanly: async `params` and `searchParams`, a server-action form with `redirect`, and a `route.ts` returning CSV all worked |
| Real browser | A Playwright test submitted the server-action form and downloaded the CSV against `next start` |
| Database in the server bundle | `drizzle-orm` and `postgres` imported in a server component, built with no extra config and read 74 rows from the dev database |
| tsconfig | `next build` rewrites `tsconfig.json` (adds `jsx: react-jsx`, `isolatedModules`, `esModuleInterop`, `resolveJsonModule`, the `next` plugin and the `dom` libs). Task 4 writes these up front so the file is stable |

## Decisions made in this plan

| Item | Decision | Why |
|---|---|---|
| Reviewer identity | One constant, `demo reviewer (mock)`. No login. | Spec excludes multi-user auth. The review record still stores who decided. |
| Export model | Two steps: "Record mock export" writes one `exports` row per accepted or edited answer; the CSV download is only served once those rows exist. | Matches the spec's non-negotiable: nothing leaves without an approval record. |
| Rejected answers | Not exported. They appear in the CSV as blank rows marked `rejected - left for a person`. | A completed sheet keeps every question, and a person can see what is missing. |
| Review after export | Locked. The UI shows no forms and `recordReview()` refuses. | The exports table points at the review; changing it afterwards would break the audit trail. |
| Changing your mind before export | Allowed. One review per draft, replaced on change. | Reviewers misclick. |
| "Accepted without major edits" | Accepted as drafted, plus edits whose similarity to the draft is at least `DEFAULT_CONFIG.similarityThreshold` (0.8). Measured over reviewed drafts that had text. | Same definition as the eval, so UI and eval numbers are comparable. |
| CSV safety | Cells starting with `=`, `+`, `-`, `@`, tab or carriage return get a leading `'`. | Answers come from library text and reviewer edits; this blocks spreadsheet formula injection. |
| E2E database | A separate database `rfp_drafting_e2e`, recreated per run, reset and re-seeded before every test. | Never touches the dev data. |
| E2E server | Production build (`next build` then `next start`) on port 3101. Dev server uses 3100. | Tests what ships. Avoids ports used by other projects. |
| Live eval | Needs `AI_GATEWAY_API_KEY` in `.env.local` and the user's go-ahead (about 55 model calls). The controller confirms before dispatching Task 7. | Cost and secrets belong to the user. |

---

## File structure

| File | Responsibility |
|---|---|
| `src/domain/scoring.ts` (modify) | Export `editDistance()` |
| `src/review/types.ts` | View types shared by queries, stats, sheet and UI |
| `src/review/stats.ts` | `summarize()`, `exportState()`, `isMinorEdit()` |
| `src/review/csv.ts` | `csvCell()`, `toCsv()` with formula-injection protection |
| `src/review/sheet.ts` | `buildSheetRows()` |
| `src/review/queries.ts` | `listDocuments()`, `getReviewDocument()` |
| `src/review/decide.ts` | `recordReview()`, `ReviewError` |
| `src/review/export.ts` | `exportDocument()`, `exportSheet()`, `ExportNotRecordedError` |
| `src/app/db.ts` | Shared database handle for the UI |
| `src/app/layout.tsx`, `globals.css`, `page.tsx` | Shell, styles, document list |
| `src/app/documents/[slug]/page.tsx` | Review page |
| `src/app/documents/[slug]/question-card.tsx`, `review-summary.tsx`, `export-panel.tsx` | Page parts |
| `src/app/documents/[slug]/actions.ts` | Server actions: review and export |
| `src/app/documents/[slug]/export.csv/route.ts` | CSV download |
| `playwright.config.ts`, `e2e/*` | End-to-end tests |
| `src/eval/compare.ts`, `compare-cli.ts` | Mock vs live comparison table |
| `docs/superpowers/results/` | Eval evidence and the written results |

---

### Task 1: Edit distance in the domain

The review layer stores how far a reviewer's edit is from the draft. The Levenshtein code already exists privately in `scoring.ts`; this exports a normalised version of it.

**Files:**
- Modify: `src/domain/scoring.ts`, `src/domain/scoring.test.ts`

- [ ] **Step 1: Read both files, then append this block to the end of `src/domain/scoring.test.ts` and add `editDistance` to its import from `./scoring`**

```ts
describe('editDistance', () => {
  it('is 0 for text that differs only in case and spacing', () => {
    expect(editDistance('Hello   World', 'hello world')).toBe(0);
  });

  it('counts single-character changes', () => {
    expect(editDistance('abc', 'abd')).toBe(1);
    expect(editDistance('retains data for 90 days', 'retains data for 60 days')).toBe(1);
  });

  it('is the length of the other text when one side is empty', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/domain/scoring.test.ts`
Expected: FAIL, `editDistance` is not exported.

- [ ] **Step 3: Add the export to `src/domain/scoring.ts`, directly below the `similarity` function**

```ts
/** Character edit distance between two texts, ignoring case and spacing differences. */
export function editDistance(a: string, b: string): number {
  return levenshtein(normalize(a), normalize(b));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test src/domain/scoring.test.ts && pnpm test src/domain/no-sdk-imports.test.ts`
Expected: scoring tests pass (16 in total); the import-boundary guard passes.

- [ ] **Step 5: Checkpoint**

Run: `pnpm test && pnpm typecheck`
Expected: all pass, exit 0.

---

### Task 2: Pure review logic (types, stats, CSV, sheet)

Everything the UI shows that is not a database read: progress statistics, the export state machine, the CSV encoder and the sheet builder. No database and no framework.

**Files:**
- Create: `src/review/types.ts`, `src/review/stats.ts`, `src/review/csv.ts`, `src/review/sheet.ts`
- Test: `src/review/stats.test.ts`, `src/review/csv.test.ts`, `src/review/sheet.test.ts`

- [ ] **Step 1: Create `src/review/types.ts`**

```ts
import type { Decision } from '../domain/approval';
import type { ReasonCode, SourceStatus } from '../domain/types';

export interface CitationView {
  entryId: string;
  sourceTitle: string;
  sourceStatus: SourceStatus;
  topic: string;
  /** ISO date the source was last reviewed. */
  reviewedAt: string;
  quote: string | null;
}

export interface DraftView {
  id: string;
  status: 'draftable' | 'needs_human';
  reasonCode: ReasonCode | null;
  answerText: string | null;
  model: string;
}

export interface ReviewView {
  id: string;
  decision: Decision;
  finalText: string | null;
  editDistance: number;
  /** True once an export row exists for this review. */
  exported: boolean;
}

export interface QuestionView {
  questionId: string;
  ordinal: number;
  section: string;
  /** For unparsed rows this is the raw line. */
  text: string;
  parseStatus: 'parsed' | 'unparsed';
  draft: DraftView | null;
  citations: CitationView[];
  review: ReviewView | null;
}

export interface DocumentView {
  id: string;
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  questions: QuestionView[];
}
```

- [ ] **Step 2: Write the failing stats test, `src/review/stats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { exportState, isMinorEdit, summarize } from './stats';
import type { QuestionView, ReviewView } from './types';

const DRAFT_TEXT = 'Northwind retains customer data for 90 days.';

function question(ordinal: number, overrides: Partial<QuestionView> = {}): QuestionView {
  return {
    questionId: `q${ordinal}`,
    ordinal,
    section: 'S',
    text: `Question ${ordinal}?`,
    parseStatus: 'parsed',
    draft: { id: `d${ordinal}`, status: 'draftable', reasonCode: null, answerText: DRAFT_TEXT, model: 'mock' },
    citations: [],
    review: null,
    ...overrides,
  };
}

const review = (overrides: Partial<ReviewView> = {}): ReviewView => ({
  id: 'r',
  decision: 'accept',
  finalText: null,
  editDistance: 0,
  exported: false,
  ...overrides,
});

const needsPerson = (ordinal: number, r: ReviewView | null = null): QuestionView =>
  question(ordinal, {
    draft: { id: `d${ordinal}`, status: 'needs_human', reasonCode: 'conflict', answerText: null, model: 'mock' },
    review: r,
  });

describe('isMinorEdit', () => {
  it('treats a one-character change as minor and a rewrite as major', () => {
    expect(isMinorEdit(DRAFT_TEXT, 'Northwind retains customer data for 60 days.')).toBe(true);
    expect(isMinorEdit(DRAFT_TEXT, 'We keep data for as long as the customer asks.')).toBe(false);
  });
});

describe('summarize', () => {
  it('counts drafted, needs-person, reviewed and pending questions', () => {
    const s = summarize([question(1), question(2, { review: review() }), needsPerson(3)]);
    expect(s).toMatchObject({ questions: 3, draftable: 2, needsHuman: 1, reviewed: 1, pending: 2 });
  });

  it('classifies decisions', () => {
    const s = summarize([
      question(1, { review: review({ decision: 'accept' }) }),
      question(2, { review: review({ decision: 'edit', finalText: 'Northwind retains customer data for 60 days.' }) }),
      question(3, { review: review({ decision: 'edit', finalText: 'Something else entirely, rewritten by hand.' }) }),
      question(4, { review: review({ decision: 'reject' }) }),
      needsPerson(5, review({ decision: 'edit', finalText: 'Written by a person.' })),
      needsPerson(6, review({ decision: 'reject' })),
    ]);
    expect(s).toMatchObject({ accepted: 1, editedMinor: 1, editedMajor: 1, writtenByPerson: 1, rejected: 2 });
  });

  it('measures accepted without major edits over drafts that were judged', () => {
    const s = summarize([
      question(1, { review: review({ decision: 'accept' }) }),
      question(2, { review: review({ decision: 'edit', finalText: 'Northwind retains customer data for 60 days.' }) }),
      question(3, { review: review({ decision: 'edit', finalText: 'Something else entirely, rewritten by hand.' }) }),
      question(4, { review: review({ decision: 'reject' }) }),
    ]);
    expect(s.acceptedWithoutMajorEdits).toBeCloseTo(0.5);
    expect(s.minutesSavedEstimate).toBe(40);
  });

  it('reports null until something has been judged', () => {
    expect(summarize([question(1)]).acceptedWithoutMajorEdits).toBeNull();
  });
});

describe('exportState', () => {
  it('is pending-review while any question lacks a draft or a review', () => {
    expect(exportState([question(1, { review: review() }), question(2)])).toBe('pending-review');
    expect(exportState([question(1, { draft: null })])).toBe('pending-review');
  });

  it('is ready once every question is reviewed but not yet exported', () => {
    expect(exportState([question(1, { review: review() }), needsPerson(2, review({ decision: 'reject' }))])).toBe('ready');
  });

  it('is exported once every non-rejected review has an export record', () => {
    const done = [question(1, { review: review({ exported: true }) }), needsPerson(2, review({ decision: 'reject' }))];
    expect(exportState(done)).toBe('exported');
  });

  it('stays ready when everything was rejected, because nothing can be exported', () => {
    expect(exportState([question(1, { review: review({ decision: 'reject' }) })])).toBe('ready');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test src/review/stats.test.ts`
Expected: FAIL, cannot resolve `./stats`.

- [ ] **Step 4: Create `src/review/stats.ts`**

```ts
import { DEFAULT_CONFIG, type DomainConfig } from '../domain/config';
import { similarity } from '../domain/scoring';
import type { QuestionView } from './types';

export interface ReviewSummary {
  questions: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  pending: number;
  accepted: number;
  editedMinor: number;
  editedMajor: number;
  writtenByPerson: number;
  rejected: number;
  /** Share of judged drafts accepted as drafted or edited slightly. Null until a draft has been judged. */
  acceptedWithoutMajorEdits: number | null;
  /** An assumption (minutes per manual answer times answers kept), not a measurement. */
  minutesSavedEstimate: number;
}

/** An edit is minor when the reviewed text is still close to the draft (same threshold as the eval). */
export function isMinorEdit(draftText: string, finalText: string, config: DomainConfig = DEFAULT_CONFIG): boolean {
  return similarity(draftText, finalText) >= config.similarityThreshold;
}

export function summarize(questions: QuestionView[], config: DomainConfig = DEFAULT_CONFIG): ReviewSummary {
  const counts = {
    questions: questions.length,
    draftable: 0,
    needsHuman: 0,
    reviewed: 0,
    pending: 0,
    accepted: 0,
    editedMinor: 0,
    editedMajor: 0,
    writtenByPerson: 0,
    rejected: 0,
  };
  let rejectedDrafts = 0;

  for (const q of questions) {
    if (q.draft?.status === 'draftable') counts.draftable += 1;
    if (q.draft?.status === 'needs_human') counts.needsHuman += 1;
    if (!q.draft || !q.review) {
      counts.pending += 1;
      continue;
    }
    counts.reviewed += 1;
    const { decision, finalText } = q.review;
    if (decision === 'accept') {
      counts.accepted += 1;
    } else if (decision === 'reject') {
      counts.rejected += 1;
      if (q.draft.status === 'draftable') rejectedDrafts += 1;
    } else if (q.draft.status === 'needs_human') {
      counts.writtenByPerson += 1;
    } else if (isMinorEdit(q.draft.answerText ?? '', finalText ?? '', config)) {
      counts.editedMinor += 1;
    } else {
      counts.editedMajor += 1;
    }
  }

  const kept = counts.accepted + counts.editedMinor;
  const judged = kept + counts.editedMajor + rejectedDrafts;
  return {
    ...counts,
    acceptedWithoutMajorEdits: judged === 0 ? null : kept / judged,
    minutesSavedEstimate: kept * config.minutesPerManualAnswer,
  };
}

export type ExportState = 'pending-review' | 'ready' | 'exported';

/** pending-review: something still needs a decision. ready: all decided, export not recorded. exported: recorded. */
export function exportState(questions: QuestionView[]): ExportState {
  if (questions.some((q) => !q.draft || !q.review)) return 'pending-review';
  const exportable = questions.filter((q) => q.review!.decision !== 'reject');
  return exportable.length > 0 && exportable.every((q) => q.review!.exported) ? 'exported' : 'ready';
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm test src/review/stats.test.ts`
Expected: 9 passed.

- [ ] **Step 6: Write the failing CSV test, `src/review/csv.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('plain text')).toBe('plain text');
  });

  it('quotes cells with commas, quotes and newlines, doubling inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
});

describe('toCsv', () => {
  const row = {
    ordinal: 3,
    section: 'Security',
    question: 'Do you encrypt data?',
    answer: 'Yes, with AES-256.',
    status: 'accepted',
    sources: 'Policy (mock)',
  };

  it('writes a header, CRLF line endings and a mock label on every row', () => {
    const csv = toCsv([row]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('ordinal,section,question,answer,status,sources,label');
    expect(lines[1]).toBe('3,Security,Do you encrypt data?,"Yes, with AES-256.",accepted,Policy (mock),mock - not submitted');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes only the header for no rows', () => {
    expect(toCsv([])).toBe('ordinal,section,question,answer,status,sources,label\r\n');
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm test src/review/csv.test.ts`
Expected: FAIL, cannot resolve `./csv`.

- [ ] **Step 8: Create `src/review/csv.ts`**

```ts
export interface SheetRow {
  ordinal: number;
  section: string;
  question: string;
  answer: string;
  status: string;
  sources: string;
}

const FORMULA_START = /^[=+\-@\t\r]/;
const HEADER = ['ordinal', 'section', 'question', 'answer', 'status', 'sources', 'label'];
const MOCK_LABEL = 'mock - not submitted';

/** RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet could read as a formula. */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: SheetRow[]): string {
  const lines = [
    HEADER.join(','),
    ...rows.map((r) =>
      [String(r.ordinal), r.section, r.question, r.answer, r.status, r.sources, MOCK_LABEL].map(csvCell).join(','),
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `pnpm test src/review/csv.test.ts`
Expected: 5 passed.

- [ ] **Step 10: Write the failing sheet test, `src/review/sheet.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildSheetRows } from './sheet';
import type { QuestionView } from './types';

const base = (ordinal: number, overrides: Partial<QuestionView> = {}): QuestionView => ({
  questionId: `q${ordinal}`,
  ordinal,
  section: 'S',
  text: `Question ${ordinal}?`,
  parseStatus: 'parsed',
  draft: { id: `d${ordinal}`, status: 'draftable', reasonCode: null, answerText: 'Drafted answer.', model: 'mock' },
  citations: [
    { entryId: 'e1', sourceTitle: 'Policy (mock)', sourceStatus: 'approved', topic: 'T', reviewedAt: '2026-01-01', quote: null },
    { entryId: 'e2', sourceTitle: 'Policy (mock)', sourceStatus: 'approved', topic: 'U', reviewedAt: '2026-01-01', quote: null },
  ],
  review: null,
  ...overrides,
});

const review = (decision: 'accept' | 'edit' | 'reject', finalText: string | null = null) => ({
  id: 'r',
  decision,
  finalText,
  editDistance: 0,
  exported: true,
});

describe('buildSheetRows', () => {
  it('uses the drafted text for accepted answers and lists each source title once', () => {
    const [row] = buildSheetRows([base(1, { review: review('accept') })]);
    expect(row).toEqual({
      ordinal: 1,
      section: 'S',
      question: 'Question 1?',
      answer: 'Drafted answer.',
      status: 'accepted',
      sources: 'Policy (mock)',
    });
  });

  it('uses the reviewer text for edited answers', () => {
    const [row] = buildSheetRows([base(1, { review: review('edit', 'Reviewed answer.') })]);
    expect(row).toMatchObject({ answer: 'Reviewed answer.', status: 'edited by reviewer', sources: 'Policy (mock)' });
  });

  it('marks a person-written answer and gives it no sources', () => {
    const q = base(2, {
      draft: { id: 'd2', status: 'needs_human', reasonCode: 'conflict', answerText: null, model: 'mock' },
      citations: [],
      review: review('edit', 'Written by a person.'),
    });
    expect(buildSheetRows([q])[0]).toMatchObject({ answer: 'Written by a person.', status: 'written by reviewer', sources: '' });
  });

  it('leaves rejected answers blank and says why', () => {
    expect(buildSheetRows([base(3, { review: review('reject') })])[0]).toMatchObject({
      answer: '',
      status: 'rejected - left for a person',
      sources: '',
    });
  });

  it('marks unreviewed questions', () => {
    expect(buildSheetRows([base(4)])[0]).toMatchObject({ answer: '', status: 'not reviewed' });
  });
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `pnpm test src/review/sheet.test.ts`
Expected: FAIL, cannot resolve `./sheet`.

- [ ] **Step 12: Create `src/review/sheet.ts`**

```ts
import type { SheetRow } from './csv';
import type { QuestionView } from './types';

/** One row per question, in order. Only accepted and edited answers carry text; the export gate lives in export.ts. */
export function buildSheetRows(questions: QuestionView[]): SheetRow[] {
  return questions.map((q) => {
    const row = { ordinal: q.ordinal, section: q.section, question: q.text };
    const { review, draft } = q;
    if (!review || !draft) return { ...row, answer: '', status: 'not reviewed', sources: '' };
    if (review.decision === 'reject') {
      return { ...row, answer: '', status: 'rejected - left for a person', sources: '' };
    }

    const sources = [...new Set(q.citations.map((c) => c.sourceTitle))].join('; ');
    if (review.decision === 'accept') {
      return { ...row, answer: draft.answerText ?? '', status: 'accepted', sources };
    }
    return draft.status === 'draftable'
      ? { ...row, answer: review.finalText ?? '', status: 'edited by reviewer', sources }
      : { ...row, answer: review.finalText ?? '', status: 'written by reviewer', sources: '' };
  });
}
```

- [ ] **Step 13: Run it to verify it passes**

Run: `pnpm test src/review/sheet.test.ts`
Expected: 5 passed.

- [ ] **Step 14: Checkpoint**

Run: `pnpm test && pnpm typecheck`
Expected: all pass, exit 0.

---

### Task 3: Review database layer

Reads (document list, one document with drafts, citations and reviews), review decisions and the export. All three are tested against the real database, including the approval rules.

**Files:**
- Create: `src/review/queries.ts`, `src/review/decide.ts`, `src/review/export.ts`
- Test: `src/review/review.db.test.ts`

- [ ] **Step 1: Write the failing test, `src/review/review.db.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { ExportRefusedError } from '../domain/approval';
import { MockDraftProvider } from '../drafting/mock-provider';
import { draftDocument } from '../drafting/run';
import { EVAL_NOW } from '../eval/config';
import { HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { loadFixtures } from '../fixtures/load';
import { recordReview, ReviewError } from './decide';
import { ExportNotRecordedError, exportDocument, exportSheet } from './export';
import { getReviewDocument, listDocuments } from './queries';
import { exportState } from './stats';
import type { DocumentView, QuestionView } from './types';

const { client, db, close } = connectTest();
afterAll(close);

const SLUG = 'fabrikam-rfp';
const REVIEWER = 'test reviewer';

beforeEach(async () => {
  await resetTables(client);
  await loadFixtures(db);
  for (const doc of HELD_OUT_DOCUMENTS) await draftDocument(db, new MockDraftProvider(), doc.slug, EVAL_NOW);
});

const load = async (): Promise<DocumentView> => (await getReviewDocument(db, SLUG))!;
const at = (view: DocumentView, ordinal: number): QuestionView => view.questions.find((q) => q.ordinal === ordinal)!;
const count = async (table: string): Promise<number> =>
  (await client.unsafe(`SELECT count(*)::int AS n FROM ${table}`))[0]!.n as number;

/** Accept every drafted answer and reject every question that needs a person. */
async function reviewEverything(): Promise<void> {
  for (const q of (await load()).questions) {
    await recordReview(db, {
      draftId: q.draft!.id,
      decision: q.draft!.status === 'draftable' ? 'accept' : 'reject',
      reviewer: REVIEWER,
    });
  }
}

describe('queries', () => {
  it('lists both documents with their counts', async () => {
    const documents = await listDocuments(db);
    const rfp = documents.find((d) => d.slug === SLUG)!;
    expect(documents).toHaveLength(2);
    expect(rfp).toMatchObject({ total: 25, draftable: 20, needsHuman: 5, reviewed: 0, exported: 0 });
    expect(documents.find((d) => d.slug === 'fabrikam-questionnaire')).toMatchObject({ total: 40, draftable: 35, needsHuman: 5 });
  });

  it('returns null for an unknown document', async () => {
    expect(await getReviewDocument(db, 'nope')).toBeNull();
  });

  it('returns a drafted question with its citation and no review', async () => {
    const q = at(await load(), 3);
    expect(q.draft).toMatchObject({ status: 'draftable', reasonCode: null });
    expect(q.draft!.answerText).toContain('retains customer data for 90 days');
    expect(q.citations).toHaveLength(1);
    expect(q.citations[0]).toMatchObject({ sourceTitle: 'Information Security Policy (mock)', topic: 'Data retention' });
    expect(q.review).toBeNull();
  });

  it('returns a question that needs a person with its reason and no citations', async () => {
    const q = at(await load(), 2);
    expect(q.draft).toMatchObject({ status: 'needs_human', reasonCode: 'conflict', answerText: null });
    expect(q.citations).toEqual([]);
  });
});

describe('recordReview', () => {
  it('records an accept with edit distance 0', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    expect(at(await load(), 3).review).toMatchObject({ decision: 'accept', editDistance: 0, exported: false });
  });

  it('records an edit with its edit distance and text', async () => {
    const q = at(await load(), 3);
    const text = q.draft!.answerText!.replace('90 days', '60 days');
    const result = await recordReview(db, { draftId: q.draft!.id, decision: 'edit', finalText: text, reviewer: REVIEWER });
    expect(result.editDistance).toBe(1);
    expect(at(await load(), 3).review).toMatchObject({ decision: 'edit', finalText: text, editDistance: 1 });
  });

  it('lets a person write an answer for a question that needs one', async () => {
    const q = at(await load(), 2);
    await recordReview(db, { draftId: q.draft!.id, decision: 'edit', finalText: 'Our SOC 2 report is dated 2025-03-31.', reviewer: REVIEWER });
    expect(at(await load(), 2).review).toMatchObject({ decision: 'edit', editDistance: 0 });
  });

  it('refuses an empty edit, accepting a question with no draft text, and an unknown draft', async () => {
    const view = await load();
    await expect(
      recordReview(db, { draftId: at(view, 3).draft!.id, decision: 'edit', finalText: '   ', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'empty_text' });
    await expect(
      recordReview(db, { draftId: at(view, 2).draft!.id, decision: 'accept', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'no_draft_text' });
    await expect(
      recordReview(db, { draftId: crypto.randomUUID(), decision: 'accept', reviewer: REVIEWER }),
    ).rejects.toBeInstanceOf(ReviewError);
  });

  it('replaces the earlier review when the reviewer changes their mind', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    await recordReview(db, { draftId: q.draft!.id, decision: 'reject', reviewer: REVIEWER });
    expect(await count('reviews')).toBe(1);
    expect(at(await load(), 3).review?.decision).toBe('reject');
  });
});

describe('exportDocument', () => {
  it('refuses while any question is unreviewed', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    await expect(exportDocument(db, SLUG)).rejects.toBeInstanceOf(ExportRefusedError);
    expect(await count('exports')).toBe(0);
  });

  it('records one export per accepted or edited answer and none for rejected ones', async () => {
    await reviewEverything();
    expect(await exportDocument(db, SLUG)).toEqual({ exported: 20 });
    expect(await count('exports')).toBe(20);
    expect(exportState((await load()).questions)).toBe('exported');
  });

  it('is safe to run twice', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    await exportDocument(db, SLUG);
    expect(await count('exports')).toBe(20);
  });

  it('locks reviews once they are exported', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    const q = at(await load(), 3);
    await expect(
      recordReview(db, { draftId: q.draft!.id, decision: 'reject', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'locked' });
  });

  it('rejects an unknown document', async () => {
    await expect(exportDocument(db, 'nope')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('exportSheet', () => {
  it('refuses until the export has been recorded', async () => {
    await reviewEverything();
    await expect(exportSheet(db, SLUG)).rejects.toBeInstanceOf(ExportNotRecordedError);
  });

  it('refuses while questions are unreviewed', async () => {
    await expect(exportSheet(db, SLUG)).rejects.toBeInstanceOf(ExportRefusedError);
  });

  it('returns a sheet with one row per question once the export is recorded', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    const { csv } = await exportSheet(db, SLUG);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(26);
    expect(lines[0]).toBe('ordinal,section,question,answer,status,sources,label');
    expect(csv.match(/rejected - left for a person/g)).toHaveLength(5);
    expect(csv).toContain('mock - not submitted');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db src/review/review.db.test.ts`
Expected: FAIL, cannot resolve `./decide`, `./export` and `./queries`.

- [ ] **Step 3: Create `src/review/queries.ts`**

```ts
import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { citations, drafts, exportsTable, libraryEntries, librarySources, questions, reviews, rfpDocuments } from '../db/schema';
import type { CitationView, DocumentView, QuestionView, ReviewView } from './types';

export interface DocumentSummary {
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  total: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  exported: number;
}

type SummaryRow = {
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  total: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  exported: number;
};

export async function listDocuments(db: Db): Promise<DocumentSummary[]> {
  const rows = await db.execute<SummaryRow>(sql`
    SELECT d.slug, d.title, d.kind,
           count(q.id)::int AS total,
           (count(dr.id) FILTER (WHERE dr.status = 'draftable'))::int AS draftable,
           (count(dr.id) FILTER (WHERE dr.status = 'needs_human'))::int AS "needsHuman",
           count(rv.id)::int AS reviewed,
           count(ex.id)::int AS exported
    FROM rfp_documents d
    LEFT JOIN questions q ON q.document_id = d.id
    LEFT JOIN drafts dr ON dr.question_id = q.id
    LEFT JOIN reviews rv ON rv.draft_id = dr.id
    LEFT JOIN exports ex ON ex.review_id = rv.id
    GROUP BY d.id
    ORDER BY d.title`);
  return [...rows];
}

/** One document with every question, its draft, citations and review. Null when the slug is unknown. */
export async function getReviewDocument(db: Db, slug: string): Promise<DocumentView | null> {
  const [doc] = await db.select().from(rfpDocuments).where(eq(rfpDocuments.slug, slug));
  if (!doc) return null;

  const rows = await db
    .select({ q: questions, d: drafts })
    .from(questions)
    .leftJoin(drafts, eq(drafts.questionId, questions.id))
    .where(eq(questions.documentId, doc.id))
    .orderBy(questions.ordinal);

  const draftIds = rows.flatMap((r) => (r.d ? [r.d.id] : []));
  const reviewRows =
    draftIds.length === 0
      ? []
      : await db
          .select({ r: reviews, exportId: exportsTable.id })
          .from(reviews)
          .leftJoin(exportsTable, eq(exportsTable.reviewId, reviews.id))
          .where(inArray(reviews.draftId, draftIds));
  const citationRows =
    draftIds.length === 0
      ? []
      : await db
          .select({
            draftId: citations.draftId,
            entryId: citations.entryId,
            quote: citations.quoteSpan,
            topic: libraryEntries.topic,
            sourceTitle: librarySources.title,
            sourceStatus: librarySources.status,
            reviewedAt: librarySources.lastReviewedAt,
          })
          .from(citations)
          .innerJoin(libraryEntries, eq(libraryEntries.id, citations.entryId))
          .innerJoin(librarySources, eq(librarySources.id, libraryEntries.sourceId))
          .where(inArray(citations.draftId, draftIds));

  const reviewByDraft = new Map<string, ReviewView>(
    reviewRows.map(({ r, exportId }) => [
      r.draftId,
      { id: r.id, decision: r.decision, finalText: r.finalText, editDistance: r.editDistance, exported: exportId !== null },
    ]),
  );
  const citationsByDraft = new Map<string, CitationView[]>();
  for (const c of citationRows) {
    const list = citationsByDraft.get(c.draftId) ?? [];
    list.push({
      entryId: c.entryId,
      sourceTitle: c.sourceTitle,
      sourceStatus: c.sourceStatus,
      topic: c.topic,
      reviewedAt: c.reviewedAt,
      quote: c.quote,
    });
    citationsByDraft.set(c.draftId, list);
  }

  const views: QuestionView[] = rows.map(({ q, d }) => ({
    questionId: q.id,
    ordinal: q.ordinal,
    section: q.section,
    text: q.text,
    parseStatus: q.parseStatus,
    draft: d
      ? { id: d.id, status: d.status, reasonCode: d.reasonCode, answerText: d.answerText, model: d.model }
      : null,
    citations: d ? (citationsByDraft.get(d.id) ?? []) : [],
    review: d ? (reviewByDraft.get(d.id) ?? null) : null,
  }));

  return { id: doc.id, slug: doc.slug, title: doc.title, kind: doc.kind, questions: views };
}
```

- [ ] **Step 4: Create `src/review/decide.ts`**

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drafts, exportsTable, reviews } from '../db/schema';
import type { Decision } from '../domain/approval';
import { editDistance } from '../domain/scoring';

export type ReviewErrorCode = 'not_found' | 'locked' | 'empty_text' | 'no_draft_text';

export class ReviewError extends Error {
  constructor(
    readonly code: ReviewErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface ReviewInput {
  draftId: string;
  decision: Decision;
  /** Required for `edit`. */
  finalText?: string;
  reviewer: string;
}

/**
 * Records (or replaces) the one review for a draft. Refuses once the review has been exported,
 * because the export row points at it. The lock check is not atomic; acceptable for a single-reviewer demo.
 */
export async function recordReview(db: Db, input: ReviewInput): Promise<{ reviewId: string; editDistance: number }> {
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, input.draftId));
  if (!draft) throw new ReviewError('not_found', 'draft not found');

  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.draftId, draft.id));
  if (existing) {
    const [exported] = await db.select({ id: exportsTable.id }).from(exportsTable).where(eq(exportsTable.reviewId, existing.id));
    if (exported) throw new ReviewError('locked', 'this answer was already exported');
  }

  let finalText: string | null = null;
  let distance = 0;
  if (input.decision === 'accept') {
    if (draft.answerText === null) throw new ReviewError('no_draft_text', 'there is no drafted answer to accept');
  } else if (input.decision === 'edit') {
    const text = input.finalText?.trim() ?? '';
    if (text === '') throw new ReviewError('empty_text', 'the reviewed answer is empty');
    finalText = text;
    distance = draft.answerText === null ? 0 : editDistance(draft.answerText, text);
  }

  const [row] = await db
    .insert(reviews)
    .values({ draftId: draft.id, reviewer: input.reviewer, decision: input.decision, finalText, editDistance: distance })
    .onConflictDoUpdate({
      target: reviews.draftId,
      set: { reviewer: input.reviewer, decision: input.decision, finalText, editDistance: distance, decidedAt: new Date() },
    })
    .returning({ id: reviews.id });
  return { reviewId: row!.id, editDistance: distance };
}
```

- [ ] **Step 5: Create `src/review/export.ts`**

```ts
import type { Db } from '../db/client';
import { exportsTable } from '../db/schema';
import { ExportRefusedError, selectExportRows, type ReviewItem } from '../domain/approval';
import { toCsv } from './csv';
import { ReviewError } from './decide';
import { getReviewDocument } from './queries';
import { buildSheetRows } from './sheet';
import type { DocumentView } from './types';

export class ExportNotRecordedError extends Error {
  constructor() {
    super('The export has not been recorded yet.');
    this.name = 'ExportNotRecordedError';
  }
}

/** Maps the view to the domain's review items. A question with no draft cannot be exported. */
function toReviewItems(view: DocumentView): ReviewItem[] {
  return view.questions.map((q) => {
    if (!q.draft) throw new ExportRefusedError(`question ${q.ordinal} has no draft`);
    return {
      draftId: q.draft.id,
      answerText: q.draft.answerText,
      review: q.review
        ? { id: q.review.id, draftId: q.draft.id, decision: q.review.decision, finalText: q.review.finalText ?? undefined }
        : undefined,
    };
  });
}

/**
 * Writes one export row per accepted or edited answer. The domain gate (selectExportRows) runs first and
 * throws if anything is unreviewed; the database trigger independently refuses rejected reviews.
 */
export async function exportDocument(db: Db, slug: string): Promise<{ exported: number }> {
  const view = await getReviewDocument(db, slug);
  if (!view) throw new ReviewError('not_found', 'document not found');

  const rows = selectExportRows(toReviewItems(view));
  if (rows.length > 0) {
    await db
      .insert(exportsTable)
      .values(rows.map((row) => ({ documentId: view.id, reviewId: row.reviewId })))
      .onConflictDoNothing({ target: exportsTable.reviewId });
  }
  return { exported: rows.length };
}

/** The mock completed sheet. Only served when every exportable answer has an export record. */
export async function exportSheet(db: Db, slug: string): Promise<{ csv: string; filename: string }> {
  const view = await getReviewDocument(db, slug);
  if (!view) throw new ReviewError('not_found', 'document not found');

  const rows = selectExportRows(toReviewItems(view));
  const recorded = new Set(view.questions.flatMap((q) => (q.review?.exported ? [q.review.id] : [])));
  if (rows.length === 0 || !rows.every((row) => recorded.has(row.reviewId))) throw new ExportNotRecordedError();

  return { csv: toCsv(buildSheetRows(view.questions)), filename: `${view.slug}-mock-export.csv` };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm test:db src/review/review.db.test.ts`
Expected: 17 passed. If a count differs, report the actual values; do not change fixtures, thresholds or tests.

- [ ] **Step 7: Checkpoint**

Run: `pnpm test && pnpm test:db && pnpm typecheck`
Expected: all pass, exit 0.

---

### Task 4: Next.js scaffold and the document list

**Files:**
- Modify: `package.json`, `tsconfig.json`, `.gitignore`
- Create: `src/app/db.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Install**

Run: `pnpm add next react react-dom && pnpm add -D @types/react @types/react-dom @playwright/test`
Expected: installs `next` 16.x, `react` and `react-dom` 19.x, and Playwright 1.64.x. If pnpm reports `ERR_PNPM_IGNORED_BUILDS`, set that package to `false` under `allowBuilds` in `pnpm-workspace.yaml` (as was done for esbuild) and report which one.

- [ ] **Step 2: Add scripts to `package.json`**

Read the file, then add to `scripts`:

```json
"dev": "next dev -p 3100",
"build": "next build",
"start": "next start -p 3100",
"e2e": "playwright test"
```

- [ ] **Step 3: Replace `tsconfig.json` with**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "incremental": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"],
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src", "e2e", "playwright.config.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Append to `.gitignore`**

```
next-env.d.ts
*.tsbuildinfo
test-results
playwright-report
```

- [ ] **Step 5: Create `src/app/db.ts`**

```ts
import { createDb, type Db } from '../db/client';
import { appUrl } from '../db/urls';

const globalForDb = globalThis as unknown as { __rfpDb?: Db };

/** One shared handle per server process (survives hot reloads in dev). */
export function getDb(): Db {
  globalForDb.__rfpDb ??= createDb(appUrl(), 5).db;
  return globalForDb.__rfpDb;
}
```

- [ ] **Step 6: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RFP drafting review (mock data)',
  description: 'Review drafted RFP and security questionnaire answers. All data is synthetic.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            RFP drafting review
          </Link>
          <span className="mock-pill">Mock data · nothing is sent anywhere</span>
        </header>
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create `src/app/globals.css`**

```css
:root {
  --ink: #1b1f24;
  --muted: #4b5563;
  --line: #d4d9e0;
  --surface: #ffffff;
  --page: #f4f6f8;
  --accent: #1d4ed8;
  --accent-ink: #ffffff;
  --warn-bg: #fff4e5;
  --warn-ink: #7a3e00;
  --ok-bg: #e7f6ec;
  --ok-ink: #14532d;
  --err-bg: #fdecec;
  --err-ink: #7f1d1d;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--ink);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--page); line-height: 1.5; }
a { color: var(--accent); }
a:focus-visible, button:focus-visible, summary:focus-visible, textarea:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }

.site-header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; background: var(--surface); border-bottom: 1px solid var(--line); }
.brand { font-weight: 700; color: var(--ink); text-decoration: none; }
.mock-pill { font-size: 0.85rem; padding: 0.15rem 0.6rem; border: 1px solid var(--warn-ink); border-radius: 999px; background: var(--warn-bg); color: var(--warn-ink); }
.page { max-width: 62rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }

h1 { margin: 0 0 0.5rem; font-size: 1.6rem; }
h2 { font-size: 1.15rem; margin: 0 0 0.5rem; }
h3 { font-size: 1.05rem; margin: 0.25rem 0 0.5rem; }
h4 { font-size: 0.85rem; margin: 0.75rem 0 0.25rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }

.doc-list { list-style: none; padding: 0; margin: 1rem 0; display: grid; gap: 0.75rem; }
.doc-list li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 0.9rem 1rem; }
.doc-list a { font-weight: 600; }
.meta { color: var(--muted); font-size: 0.9rem; margin: 0.15rem 0 0; }

.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
.stats { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin: 0.5rem 0; }
.stats div { min-width: 7rem; }
.stats dt { color: var(--muted); font-size: 0.85rem; }
.stats dd { margin: 0; font-weight: 700; font-size: 1.2rem; }
.note { color: var(--muted); font-size: 0.9rem; }
.alert { background: var(--err-bg); color: var(--err-ink); border: 1px solid var(--err-ink); border-radius: 8px; padding: 0.6rem 0.9rem; margin: 1rem 0; }
.filters { display: flex; gap: 1rem; margin: 1rem 0; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 1rem; margin: 0.9rem 0; scroll-margin-top: 1rem; }
.eyebrow { margin: 0; color: var(--muted); font-size: 0.85rem; }
.badge { display: inline-block; font-size: 0.8rem; font-weight: 600; padding: 0.1rem 0.55rem; border-radius: 999px; border: 1px solid; }
.badge-drafted { background: var(--ok-bg); color: var(--ok-ink); border-color: var(--ok-ink); }
.badge-person { background: var(--warn-bg); color: var(--warn-ink); border-color: var(--warn-ink); }
.answer { white-space: pre-wrap; margin: 0.25rem 0; }
.sources { margin: 0.25rem 0; padding-left: 1.1rem; font-size: 0.92rem; }
.reviewed { margin: 0.75rem 0 0; font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }

button { font: inherit; padding: 0.45rem 0.9rem; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink); cursor: pointer; }
button.secondary { background: var(--surface); color: var(--accent); }
details.edit { margin-top: 0.6rem; }
details.edit summary { cursor: pointer; color: var(--accent); font-weight: 600; }
label { display: block; font-weight: 600; margin: 0.6rem 0 0.25rem; }
textarea { width: 100%; font: inherit; padding: 0.5rem; border: 1px solid var(--line); border-radius: 6px; }
```

- [ ] **Step 8: Create `src/app/page.tsx`**

```tsx
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
```

- [ ] **Step 9: Typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: typecheck exits 0 (if `isolatedModules` flags a type re-export in existing code, report the exact error and the file; fix it only by changing `export { X }` to `export type { X }` for type-only exports). `pnpm build` ends with a route table that lists `/` as dynamic (ƒ). If the build rewrites `tsconfig.json` again, report the diff.

- [ ] **Step 10: Checkpoint**

Run: `pnpm test && pnpm test:db`
Expected: all pass (the Next setup must not disturb the unit or DB suites).

---

### Task 5: Review page, server actions and CSV route

The review experience. Every control is an ordinary HTML form posting to a server action, so it works without client JavaScript and is easy to test.

**Files:**
- Create: `src/app/documents/[slug]/actions.ts`, `page.tsx`, `question-card.tsx`, `review-summary.tsx`, `export-panel.tsx`
- Create: `src/app/documents/[slug]/export.csv/route.ts`

- [ ] **Step 1: Create `src/app/documents/[slug]/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ExportRefusedError } from '../../../domain/approval';
import { recordReview, ReviewError } from '../../../review/decide';
import { exportDocument } from '../../../review/export';
import { getDb } from '../../db';

const REVIEWER = 'demo reviewer (mock)';

const reviewSchema = z.object({
  slug: z.string().min(1),
  draftId: z.uuid(),
  ordinal: z.coerce.number().int().positive(),
  decision: z.enum(['accept', 'edit', 'reject']),
  finalText: z.string().max(10000).optional(),
});

const exportSchema = z.object({ slug: z.string().min(1) });

const back = (slug: string, error?: string, anchor?: string): string =>
  `/documents/${encodeURIComponent(slug)}${error ? `?error=${error}` : ''}${anchor ? `#${anchor}` : ''}`;

export async function reviewAction(formData: FormData): Promise<void> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(back(String(formData.get('slug') ?? ''), 'invalid'));
  const { slug, draftId, ordinal, decision, finalText } = parsed.data;

  let error: string | undefined;
  try {
    await recordReview(getDb(), { draftId, decision, finalText, reviewer: REVIEWER });
  } catch (caught) {
    error = caught instanceof ReviewError ? caught.code : 'unknown';
  }
  // Without this the client keeps the old page: a redirect that only adds a #hash is treated as in-page navigation.
  revalidatePath(`/documents/${slug}`);
  redirect(back(slug, error, `q-${ordinal}`));
}

export async function exportAction(formData: FormData): Promise<void> {
  const parsed = exportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(back('', 'invalid'));
  const { slug } = parsed.data;

  let error: string | undefined;
  try {
    await exportDocument(getDb(), slug);
  } catch (caught) {
    if (caught instanceof ExportRefusedError) error = 'not_ready';
    else if (caught instanceof ReviewError) error = caught.code;
    else error = 'unknown';
  }
  revalidatePath(`/documents/${slug}`);
  redirect(back(slug, error, 'export-heading'));
}
```

- [ ] **Step 2: Create `src/app/documents/[slug]/review-summary.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `src/app/documents/[slug]/export-panel.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `src/app/documents/[slug]/question-card.tsx`**

```tsx
import { isMinorEdit } from '../../../review/stats';
import type { QuestionView } from '../../../review/types';
import { reviewAction } from './actions';

const REASONS: Record<string, string> = {
  conflict: 'Sources disagree',
  stale: 'Sources are out of date',
  no_evidence: 'No approved source answers this',
  low_confidence: 'Could not be drafted safely',
};

function reviewedLabel(q: QuestionView): string {
  const { review, draft } = q;
  if (!review) return '';
  if (review.decision === 'accept') return 'accepted';
  if (review.decision === 'reject') return 'rejected';
  return draft?.status === 'draftable' ? 'edited' : 'written by reviewer';
}

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

  return (
    <article id={`q-${q.ordinal}`} data-testid={`question-${q.ordinal}`} className="card" aria-labelledby={titleId}>
      <p className="eyebrow">
        {q.section} · question {q.ordinal}
      </p>
      <h3 id={titleId}>{q.text}</h3>
      {drafted ? (
        <span className="badge badge-drafted">Drafted</span>
      ) : (
        <span className="badge badge-person">Needs a person</span>
      )}

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
                    {c.sourceTitle} · {c.topic} · last reviewed {c.reviewedAt}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="note">
          {draft
            ? `${REASONS[draft.reasonCode ?? ''] ?? 'Review needed'} (${draft.reasonCode ?? 'unknown'}). No answer was drafted.`
            : 'No draft was generated for this question.'}
        </p>
      )}

      {review && (
        <p className="reviewed">
          Reviewed: {reviewedLabel(q)}
          {review.decision === 'edit' && drafted && (
            <>
              {' '}
              · Edit distance: {review.editDistance} (
              {isMinorEdit(draft?.answerText ?? '', review.finalText ?? '') ? 'minor edit' : 'major edit'})
            </>
          )}
        </p>
      )}

      {locked ? (
        <p className="note">Exported (mock). This answer can no longer be changed.</p>
      ) : (
        draft && (
          <>
            <form action={reviewAction} className="actions">
              <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
              {drafted && (
                <button type="submit" name="decision" value="accept">
                  Accept
                </button>
              )}
              <button type="submit" name="decision" value="reject" className="secondary">
                {drafted ? 'Reject' : 'Leave blank'}
              </button>
            </form>
            <details className="edit">
              <summary>{drafted ? 'Edit answer' : 'Write answer'}</summary>
              <form action={reviewAction}>
                <HiddenFields slug={slug} draftId={draft.id} ordinal={q.ordinal} />
                <input type="hidden" name="decision" value="edit" />
                <label htmlFor={`text-${q.ordinal}`}>Reviewed answer</label>
                <textarea
                  id={`text-${q.ordinal}`}
                  name="finalText"
                  rows={5}
                  required
                  defaultValue={review?.finalText ?? draft.answerText ?? ''}
                />
                <div className="actions">
                  <button type="submit">Save edit</button>
                </div>
              </form>
            </details>
          </>
        )
      )}
    </article>
  );
}
```

- [ ] **Step 5: Create `src/app/documents/[slug]/page.tsx`**

```tsx
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
```

- [ ] **Step 6: Create `src/app/documents/[slug]/export.csv/route.ts`**

```ts
import { ExportRefusedError } from '../../../../domain/approval';
import { ReviewError } from '../../../../review/decide';
import { ExportNotRecordedError, exportSheet } from '../../../../review/export';
import { getDb } from '../../../db';

export const dynamic = 'force-dynamic';

const text = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  try {
    const { csv, filename } = await exportSheet(getDb(), slug);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ReviewError && error.code === 'not_found') return text('Unknown document.', 404);
    if (error instanceof ExportRefusedError || error instanceof ExportNotRecordedError) return text(error.message, 409);
    throw error;
  }
}
```

- [ ] **Step 7: Typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: typecheck exits 0; the build's route table lists `/`, `/documents/[slug]` and `/documents/[slug]/export.csv` as dynamic (ƒ). If `z.uuid()` is not available in the installed zod, report the error rather than switching APIs.

- [ ] **Step 8: Eyeball it against the dev database**

Run: `pnpm eval` (seeds and drafts the dev database with the mock provider), then `pnpm dev`, open `http://127.0.0.1:3100/` and `http://127.0.0.1:3100/documents/fabrikam-rfp`, check the page renders, and stop the server. Report what you saw (document list, first card, a needs-person card). Do not leave a dev server running.

- [ ] **Step 9: Checkpoint**

Run: `pnpm test && pnpm test:db && pnpm typecheck`
Expected: all pass, exit 0.

---

### Task 6: Playwright end-to-end tests

Real browser, production build, throwaway database `rfp_drafting_e2e`, reset and re-seeded before every test.

**Files:**
- Create: `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`, `e2e/global-setup.ts`, `e2e/prepare-db.ts`, `e2e/review.spec.ts`

- [ ] **Step 1: Create `e2e/env.ts`**

```ts
export const E2E_URL = process.env.E2E_DATABASE_URL ?? 'postgres://rfp:rfp@127.0.0.1:5435/rfp_drafting_e2e';
export const E2E_PORT = 3101;
```

- [ ] **Step 2: Create `e2e/global-setup.ts`**

```ts
import setup from '../src/db/global-setup';
import { E2E_URL } from './env';

/** Drops, recreates and migrates the e2e database. Reuses the Vitest DB setup by pointing it at the e2e URL. */
export default async function globalSetup(): Promise<void> {
  process.env.TEST_DATABASE_URL = E2E_URL;
  await setup();
}
```

- [ ] **Step 2b: Create `e2e/prepare-db.ts`**

Playwright starts `webServer` before it runs `globalSetup`, so the e2e database must exist before the app is probed. This script creates it as the first part of the server command (the config in Step 4 has no `globalSetup`).

```ts
import globalSetup from './global-setup';

globalSetup().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
```

- [ ] **Step 3: Create `e2e/helpers.ts`**

```ts
import type { Sql } from 'postgres';
import { createDb, type Db } from '../src/db/client';
import { resetTables } from '../src/db/reset';
import { MockDraftProvider } from '../src/drafting/mock-provider';
import { draftDocument } from '../src/drafting/run';
import { EVAL_NOW } from '../src/eval/config';
import { HELD_OUT_DOCUMENTS } from '../src/fixtures/held-out';
import { loadFixtures } from '../src/fixtures/load';
import { recordReview } from '../src/review/decide';
import { getReviewDocument } from '../src/review/queries';
import { E2E_URL } from './env';

async function withDb<T>(fn: (db: Db, client: Sql) => Promise<T>): Promise<T> {
  const { db, client, close } = createDb(E2E_URL, 1);
  try {
    return await fn(db, client);
  } finally {
    await close();
  }
}

/** Empties the e2e database, loads the mock fixtures and drafts both documents with the mock provider. */
export async function resetAndSeed(): Promise<void> {
  await withDb(async (db, client) => {
    await resetTables(client);
    await loadFixtures(db);
    for (const doc of HELD_OUT_DOCUMENTS) await draftDocument(db, new MockDraftProvider(), doc.slug, EVAL_NOW);
  });
}

/** Reviews every question of a document except one: accepts drafts, rejects questions that need a person. */
export async function reviewAllExcept(slug: string, exceptOrdinal: number): Promise<void> {
  await withDb(async (db) => {
    const view = await getReviewDocument(db, slug);
    for (const q of view!.questions) {
      if (q.ordinal === exceptOrdinal) continue;
      await recordReview(db, {
        draftId: q.draft!.id,
        decision: q.draft!.status === 'draftable' ? 'accept' : 'reject',
        reviewer: 'e2e',
      });
    }
  });
}
```

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
import { E2E_PORT, E2E_URL } from './e2e/env';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${E2E_PORT}` },
  webServer: {
    command: `pnpm exec tsx e2e/prepare-db.ts && pnpm exec next build && pnpm exec next start -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_URL },
  },
});
```

- [ ] **Step 5: Create `e2e/review.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { resetAndSeed, reviewAllExcept } from './helpers';

const RFP = '/documents/fabrikam-rfp';

test.beforeEach(async () => {
  await resetAndSeed();
});

test('lists both documents with their counts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Documents to review' })).toBeVisible();
  const rfp = page.getByRole('listitem').filter({ hasText: 'Fabrikam Retail RFP (mock)' });
  await expect(rfp).toContainText('25 questions · 20 drafted · 5 need a person · 0 reviewed');
  const questionnaire = page.getByRole('listitem').filter({ hasText: 'Fabrikam Security Questionnaire (mock)' });
  await expect(questionnaire).toContainText('40 questions · 35 drafted · 5 need a person · 0 reviewed');
});

test('shows a drafted answer with its source, and a question that needs a person', async ({ page }) => {
  await page.goto(RFP);
  const drafted = page.getByTestId('question-3');
  await expect(drafted).toContainText('retains customer data for 90 days');
  await expect(drafted).toContainText('Information Security Policy (mock)');
  await expect(drafted.getByRole('button', { name: 'Accept' })).toBeVisible();

  const person = page.getByTestId('question-2');
  await expect(person).toContainText('Needs a person');
  await expect(person).toContainText('Sources disagree');
  await expect(person.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});

test('accepts a drafted answer and updates the progress', async ({ page }) => {
  await page.goto(RFP);
  await expect(page.getByText('0 of 25 reviewed')).toBeVisible();
  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card).toContainText('Reviewed: accepted');
  await expect(page.getByText('1 of 25 reviewed')).toBeVisible();
});

test('records a slight edit as a minor edit with its edit distance', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByText('Edit answer').click();
  await card
    .getByLabel('Reviewed answer')
    .fill('Northwind retains customer data for 60 days after contract termination, then deletes it.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('Reviewed: edited');
  await expect(card).toContainText('Edit distance: 1 (minor edit)');
  await expect(page.getByText('Edited slightly')).toBeVisible();
});

test('records a rewrite as a major edit', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByText('Edit answer').click();
  await card.getByLabel('Reviewed answer').fill('We keep data for as long as the customer asks us to.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('major edit');
});

test('lets a person write the answer to a question that needs one', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-2');
  await card.getByText('Write answer').click();
  await card.getByLabel('Reviewed answer').fill('Our SOC 2 Type II report is dated 2025-03-31.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('Reviewed: written by reviewer');
});

test('rejects a drafted answer', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Reject' }).click();
  await expect(card).toContainText('Reviewed: rejected');
});

test('blocks the export while questions are unreviewed', async ({ page, request }) => {
  await page.goto(RFP);
  await expect(page.getByText('25 of 25 answers still need a decision before export.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record mock export' })).toHaveCount(0);
  const response = await request.get(`${RFP}/export.csv`);
  expect(response.status()).toBe(409);
});

test('exports once everything is decided, serves the mock CSV and locks the answers', async ({ page, request }) => {
  await reviewAllExcept('fabrikam-rfp', 3);
  await page.goto(RFP);
  await expect(page.getByText('1 of 25 answers still need a decision before export.')).toBeVisible();

  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('button', { name: 'Record mock export' })).toBeVisible();

  // The CSV is still refused until the export is recorded.
  expect((await request.get(`${RFP}/export.csv`)).status()).toBe(409);

  await page.getByRole('button', { name: 'Record mock export' }).click();
  await expect(page.getByText('Mock export recorded.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download CSV (mock)' })).toBeVisible();
  await expect(card).toContainText('Exported (mock)');
  await expect(card.getByRole('button', { name: 'Accept' })).toHaveCount(0);

  const response = await request.get(`${RFP}/export.csv`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/csv');
  const csv = await response.text();
  expect(csv).toContain('ordinal,section,question,answer,status,sources,label');
  expect(csv).toContain('Northwind retains customer data for 90 days');
  expect(csv).toContain('mock - not submitted');
  expect(csv).toContain('rejected - left for a person');
});
```

- [ ] **Step 6: Make sure the browser is available**

Run: `pnpm exec playwright --version`
Expected: `Version 1.64.x`. The matching Chromium (revision 1248) is already in `~/.cache/ms-playwright`; if the first test run says the executable is missing, run `pnpm exec playwright install chromium` and report that a download was needed.

- [ ] **Step 7: Run the end-to-end tests**

Run: `pnpm e2e`
Expected: 9 passed. The first run builds the app, which takes a while. If a test fails, report the test name, the Playwright error and what the page showed; do not loosen assertions or edit UI text to fit a test without reporting it.

- [ ] **Step 8: Checkpoint**

Run: `pnpm test && pnpm test:db && pnpm typecheck && pnpm e2e`
Expected: all pass, typecheck exits 0.

---

### Task 7: Live eval, comparison and results write-up

**Controller note (not for the subagent):** before dispatching this task, confirm with the user that (a) `AI_GATEWAY_API_KEY` is in `.env.local` and (b) they accept the model cost of one live run (about 55 drafting calls, one per drafted question; routed questions make no model call). If either is missing, run only Steps 1 to 3 and Step 9 with the live column marked "not run", and tell the user what is needed.

**Files:**
- Create: `src/eval/compare.ts`, `src/eval/compare-cli.ts`, `src/eval/compare.test.ts`
- Create: `docs/superpowers/results/` (evidence and write-up)
- Modify: `package.json`

- [ ] **Step 1: Write the failing comparison test, `src/eval/compare.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { compareResults } from './compare';
import type { EvalResult } from './run';

const result = (provider: string, overrides: Partial<EvalResult> = {}): EvalResult => ({
  provider,
  now: '2026-10-31',
  metrics: { drafted: 2, acceptedRate: 1, citationCoverage: 1, correctRouting: 1, wrongFactCount: 0, hoursSavedEstimate: 0.67 },
  gates: [{ name: 'Wrong facts', pass: true, actual: 0, required: '= 0' }],
  humanByReason: { no_evidence: 1 },
  items: [
    { key: 'a:1', question: 'Q1?', status: 'draftable', accepted: true, wrongFact: false, guarded: false },
    { key: 'a:2', question: 'Q2?', status: 'needs_human', reason: 'no_evidence', accepted: false, wrongFact: false, guarded: true },
  ],
  ...overrides,
});

describe('compareResults', () => {
  it('puts both providers side by side', () => {
    const md = compareResults(result('mock'), result('live-model'));
    expect(md).toContain('| Metric | mock | live-model |');
    expect(md).toContain('| Drafted without a person | 2 | 2 |');
    expect(md).toContain('| Wrong facts | 0 | 0 |');
  });

  it('says so when nothing differs', () => {
    expect(compareResults(result('mock'), result('live'))).toContain('No question was handled differently.');
  });

  it('lists every question handled differently', () => {
    const live = result('live', {
      items: [
        { key: 'a:1', question: 'Q1?', status: 'draftable', accepted: false, wrongFact: true, guarded: false },
        { key: 'a:2', question: 'Q2?', status: 'draftable', accepted: false, wrongFact: false, guarded: true },
      ],
    });
    const md = compareResults(result('mock'), live);
    expect(md).toContain('a:1');
    expect(md).toContain('WRONG FACT');
    expect(md).toContain('a:2');
    expect(md).toContain('needs a person (no_evidence)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/eval/compare.test.ts`
Expected: FAIL, cannot resolve `./compare`.

- [ ] **Step 3: Create `src/eval/compare.ts`**

```ts
import type { EvalItem, EvalResult } from './run';

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function describeItem(item: EvalItem): string {
  if (item.status === 'needs_human') return `needs a person (${item.reason ?? 'unknown'})`;
  return `drafted, ${item.accepted ? 'accepted' : 'not accepted'}${item.wrongFact ? ', WRONG FACT' : ''}`;
}

/** Markdown comparison of two eval runs: metrics side by side, then every question handled differently. */
export function compareResults(a: EvalResult, b: EvalResult): string {
  const row = (label: string, pick: (r: EvalResult) => string): string => `| ${label} | ${pick(a)} | ${pick(b)} |`;
  const lines = [
    `| Metric | ${a.provider} | ${b.provider} |`,
    '|---|---|---|',
    row('Drafted without a person', (r) => String(r.metrics.drafted)),
    row('Accepted without major edits (of drafted)', (r) => pct(r.metrics.acceptedRate)),
    row('Citation coverage', (r) => pct(r.metrics.citationCoverage)),
    row('Correct routing of traps and unanswerable questions', (r) => pct(r.metrics.correctRouting)),
    row('Wrong facts', (r) => String(r.metrics.wrongFactCount)),
    row('Hard gates passed', (r) => `${r.gates.filter((g) => g.pass).length} of ${r.gates.length}`),
    '',
    '## Questions handled differently',
    '',
  ];

  const other = new Map(b.items.map((item) => [item.key, item]));
  const different = a.items.filter((item) => {
    const match = other.get(item.key);
    return match === undefined || match.status !== item.status || match.accepted !== item.accepted || match.wrongFact !== item.wrongFact;
  });

  if (different.length === 0) {
    lines.push('No question was handled differently.');
  } else {
    for (const item of different) {
      const match = other.get(item.key);
      lines.push(`- ${item.key}: ${a.provider} ${describeItem(item)}; ${b.provider} ${match ? describeItem(match) : 'missing'}. ${item.question}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test src/eval/compare.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Create `src/eval/compare-cli.ts` and add the script**

```ts
import { readFileSync } from 'node:fs';
import { compareResults } from './compare';
import type { EvalResult } from './run';

const [pathA, pathB] = process.argv.slice(2);
if (!pathA || !pathB) {
  console.error('usage: pnpm eval:compare <results-a.json> <results-b.json>');
  process.exit(2);
}
const load = (path: string): EvalResult => JSON.parse(readFileSync(path, 'utf8')) as EvalResult;
console.log(compareResults(load(pathA), load(pathB)));
```

In `package.json` add to `scripts`: `"eval:compare": "tsx src/eval/compare-cli.ts"`.

- [ ] **Step 6: Save the mock baseline as evidence**

Run: `mkdir -p docs/superpowers/results && pnpm eval && cp eval/report.md docs/superpowers/results/mock-report.md && cp eval/results.json docs/superpowers/results/mock-results.json`
Expected: `pnpm eval` prints three PASS lines; both files are copied.

- [ ] **Step 7: Check for the key without printing it**

Run: `if [ -f .env.local ] && grep -q '^AI_GATEWAY_API_KEY=.' .env.local; then echo "key present"; else echo "key missing"; fi`
Expected: `key present` to continue. If `key missing`, STOP this task here: report NEEDS_USER_ACTION ("put AI_GATEWAY_API_KEY in .env.local") and do Step 9 with the live column marked "not run". Do not create `.env.local`, do not read its contents, and never print the key.

- [ ] **Step 8: Run the live eval and save the evidence**

Run: `pnpm eval:live; echo "exit=$?"`
Expected: it prints one PASS or FAIL line per hard gate and a drafted/accepted summary, then `exit=0` (live runs report only). Then: `cp eval/report.md docs/superpowers/results/live-report.md && cp eval/results.json docs/superpowers/results/live-results.json`.
If the run errors (authentication, model id, rate limit), report the exact message with any key material removed. A common fix is to set `DRAFT_MODEL` in `.env.local` to another listed model, but do that only after reporting.

- [ ] **Step 9: Generate the comparison**

Run: `pnpm eval:compare docs/superpowers/results/mock-results.json docs/superpowers/results/live-results.json > docs/superpowers/results/comparison.md && cat docs/superpowers/results/comparison.md`
Expected: a metrics table and a list of questions handled differently. (If the live run did not happen, skip this step.)

- [ ] **Step 10: Write `docs/superpowers/results/2026-10-31-rfp-drafting-results.md`**

Write the document from the real files only. Every number must be copied from `mock-results.json`, `live-results.json` or `comparison.md`; if a value is not in them, say it is unknown. Required sections, in order:

1. **What was run:** the commands, the provider names exactly as in the results files, the evaluation date, the fixture sizes (library entries, questions, traps, unanswerable).
2. **Results:** the generated comparison table pasted verbatim, then the three hard gates for each provider with PASS or FAIL.
3. **What the live model did differently:** one bullet per question in the "handled differently" list, with the question text and what each provider did. For every live wrong fact or not-accepted draft, say whether it is a real error or a scoring artefact, based on reading the draft and the key (the scorer flags any figure outside the key even if true).
4. **What the numbers mean and do not mean:** the mock accepted rate is high by construction (the key was derived from the library); the hours-saved figure is an assumption; retrieval is a baseline that scored every supported question at 0.37 or more against a 0.35 floor; fixtures are synthetic and worded to be matched; no negative-polarity questions were tested.
5. **Recommended next steps:** at most five, each tied to a number or a failure above (for example "swap in a real embedding model" only if the live run shows retrieval-limited misses).

State plainly at the top whether the live run happened. Do not describe results the files do not contain.

- [ ] **Step 11: Checkpoint**

Run: `pnpm test && pnpm typecheck`
Expected: all pass, exit 0. Report the paths of every file written under `docs/superpowers/results/`.

---

### Task 8: Project docs and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read `CLAUDE.md`, then replace its `## Stack` paragraph and append a `## Review UI` section**

Replace the line beginning `Next.js + TypeScript, Postgres (pgvector)` with:

```markdown
Next.js 16 + TypeScript, Postgres (pgvector), Drizzle, Zod, Vitest, Playwright, AI SDK v7 via Vercel AI Gateway (plus a deterministic mock provider). Package manager: pnpm. Plans 1 to 4 are built: domain rules, data and retrieval, drafting/audit/eval, and the review UI with mock export.
```

Add after `## Local database`:

```markdown
## Review UI
- `pnpm eval` first (it seeds and drafts the dev database), then `pnpm dev` and open http://127.0.0.1:3100. Running `pnpm eval` again resets the dev database, which discards any reviews.
- `pnpm e2e` builds the app and runs the Playwright tests on port 3101 against a throwaway database `rfp_drafting_e2e`. The Chromium build it needs is cached in `~/.cache/ms-playwright`.
- The reviewer is a single mock identity; there is no login. Reviews lock once exported.
- Eval evidence and the written results live in `docs/superpowers/results/`.
```

- [ ] **Step 2: Run everything fresh**

Run: `pnpm test && pnpm test:db && pnpm typecheck && pnpm build && pnpm e2e && pnpm eval; echo "exit=$?"`
Expected: unit, DB and typecheck pass; the build succeeds; 9 end-to-end tests pass; `pnpm eval` prints three PASS lines; `exit=0`. Quote the real summary lines for each.

- [ ] **Step 3: Confirm the rules still hold**

Run: `pnpm test src/domain/no-sdk-imports.test.ts`
Expected: all pass (Plan 4 adds only `editDistance` to `src/domain/`, with no imports).

Run: `grep -rnE "sk-|AI_GATEWAY_API_KEY=[^ ]" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yml' --include='*.md' . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.planning --exclude-dir=docs --exclude-dir=eval | head`
Expected: no output.

Run: `ls .env.local 2>&1 | head -1; git status 2>&1 | head -1`
Expected: whatever the user has set up for `.env.local`; this folder is still not a git repository.

- [ ] **Step 4: Report with the real output**

Quote the final summary lines of `pnpm test`, `pnpm test:db`, `pnpm e2e`, `pnpm eval` and `pnpm typecheck`. State whether the live eval ran. Do not claim done without them.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Review UI: per-question cards with draft, cited sources, needs-person flag, accept/edit/reject (2, 5, 10) | 5 |
| Approved answers export to a mock completed sheet (2, 10) | 3, 5 |
| Edit distance logged to measure "accepted without major edits" (2, 7, 10) | 1, 3, 5 |
| Nothing is exported without an approved review record; `exports.review_id` NOT NULL (3, 6) | 3 (domain gate, unique export rows), tests |
| Rejected reviews can never be exported (6) | 3 (rejected omitted by the gate; trigger from Plan 2 as the backstop) |
| Everything labelled mock; nothing sent anywhere (3) | 4, 5 (header pill, panel copy, CSV label column) |
| Hours per RFP and share accepted without major edits, measured (1) | 5 (progress panel), 7 |
| Playwright: accept, edit, reject flows, mock export, export blocked while unreviewed (9) | 6 |
| Live eval run and results summary (10) | 7 |
| Secrets only in `.env.local`; no document bodies in logs (3) | 7 (key checked without printing), 8 |

## Known gaps and deliberate decisions

- **No login.** One mock reviewer identity. Multi-user auth and collaboration are out of scope in the spec.
- **Export is a CSV.** There is no DOCX or PDF. The spec says "CSV/DOCX-style".
- **The lock check is not atomic.** Two simultaneous reviewers could race between the lock check and the write. Fine for a single-reviewer demo; a real deployment needs a transaction or a database constraint.
- **`pnpm eval` resets the dev database**, which discards reviews made in the UI. The e2e tests use their own database and never touch the dev data.
- **Playwright runs against mock drafts.** It tests the review workflow, not the quality of any model.
- **Accepted-rate is only meaningful for the live model.** The mock scores about 95% because the key was derived from the library. Read the live column, and read it as a first indication on synthetic data, not a benchmark.
- **Scoring flags true but extra figures** as wrong facts, so a live model that adds a correct, cited figure may be marked down. The write-up must separate real errors from this artefact.
- **Retrieval is a baseline.** The local embedder and keyword overlap work because the fixtures were worded to be matched. A real embedding model (and a vector-dimension migration) is the main upgrade if the live run shows retrieval-limited misses.
- **Live eval cost and secrets.** The live run makes about 55 model calls. It runs only with the user's key in `.env.local` and their go-ahead.
