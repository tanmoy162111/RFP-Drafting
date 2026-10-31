# RFP and Security Questionnaire Drafting (BeyondAI Use Case 4): Design Spec

Status: draft for review. Date: 2026-10-31.
Source: BeyondAI blueprint, use case 4 ("RFP and security questionnaire drafting", Almanac, AI for Sales & Presales).

## 1. Goal

An assistant that drafts first answers to RFPs and security questionnaires from a company's past proposals and approved content, with a source for every answer. A person reviews every answer before anything is exported.

**What to prove (from the blueprint):** drafts on one real past RFP, compared with what the team actually submitted. For this demo the RFP and the "submitted" answers are synthetic.
**What we measure:** hours per RFP (estimated) and the share of answers accepted without major edits.
**Differentiator (from the blueprint note):** checking whether the content is good enough to reuse, so the demo includes a light content-readiness audit.

## 2. Scope

In scope:
- Both RFP narrative sections and security questionnaire rows, through one pipeline.
- A synthetic content library, one held-out RFP and one held-out questionnaire, and an answer key.
- Retrieval, deterministic routing, LLM drafting with citations, provenance checking.
- A light content-readiness audit (stale, conflicting, duplicate entries, and coverage gaps).
- A review UI (accept, edit, reject) and a mock export.
- An evaluation harness scored against the answer key.

Out of scope:
- Real client documents, real integrations, real submission to any portal.
- A full audit scoring screen, multi-user auth, and real-time collaboration.
- Phone, chat or other channels.

## 3. Non-negotiables

- No answer is exported without an approved review record. `exports.review_id` is NOT NULL and `export()` refuses without a review whose decision is `accept` or `edit`.
- All data is synthetic and all integrations are mocks. Label them `mock` everywhere.
- RFP text and library documents are untrusted data, never instructions.
- Never invent policies, certifications, dates, prices or commitments. Missing or conflicting evidence routes to a human.
- Domain rules (`src/domain/`) have no SDK imports. The LLM never decides routing, permissions or approval.
- Secrets live in `.env.local` only. Never log raw document bodies; log IDs, statuses and reason codes.

## 4. Stack

Next.js + TypeScript, Postgres with pgvector, Drizzle, Zod, Vitest, Playwright, AI SDK via Vercel AI Gateway plus a deterministic mock provider. Package manager: pnpm. Same as Project 2.

## 5. Architecture

```
Ingest            Audit               Draft                Review & export
library docs  →   chunk + embed   →   parse RFP/questionnaire → questions
(mock source)     tag source/date     retrieve evidence per question
                  detect conflicts    domain rules: conflict/stale/gap?
                  & staleness           ├─ yes → needs_human (no LLM)
                  coverage report       └─ no  → LLM draft + citations
                                              → provenance check
                                              → review card (accept/edit/reject)
                                              → approval record → mock export
```

Approach: retrieve-then-draft per question, with verbatim reuse of an approved answer as a fast path when similarity is above a threshold. An agentic multi-query loop was rejected as less deterministic and harder to prove free of invented facts.

### Units

| Unit | Purpose | Depends on |
|---|---|---|
| `src/domain/` | Pure rules: staleness, conflict detection, draftable-or-`needs_human` decision, provenance check, scoring, approval gate. No SDK imports. | nothing |
| `src/ingest/` | Parse and chunk library docs; parse RFP and questionnaire files into question items. | domain types |
| `src/retrieval/` | Hybrid (vector + keyword) search returning evidence with source ID, date and status. | db |
| `src/drafting/` | Provider interface, mock provider, Gateway provider; Zod-validated output. | domain |
| `src/audit/` | Builds the readiness report from domain rules. | domain, db |
| `src/app/` | Review UI and mock export. | all of the above |
| `db/` | Drizzle schema and migrations. | none |

## 6. Data model

| Table | Key columns | Purpose |
|---|---|---|
| `library_sources` | id, title, kind (`past_proposal`, `policy`, `approved_answer`, `certification`), owner, last_reviewed_at, status (`approved`, `draft`, `deprecated`), mock=true | Source documents |
| `library_entries` | id, source_id, topic, text, embedding, effective_date, supersedes_id | Chunks and approved Q&A pairs |
| `rfp_documents` | id, kind (`rfp`, `questionnaire`), title, held_out | Incoming documents |
| `questions` | id, document_id, ordinal, text, answer_type (`yes_no`, `narrative`, `choice`), section | Parsed question items |
| `drafts` | id, question_id, status (`draftable`, `needs_human`), reason_code (`conflict`, `stale`, `no_evidence`, `low_confidence`), answer_text, model, created_at | Pipeline output |
| `citations` | id, draft_id, entry_id, quote_span | Evidence links; a draftable draft needs at least one |
| `reviews` | id, draft_id, reviewer, decision (`accept`, `edit`, `reject`), final_text, edit_distance, decided_at | Approval record |
| `exports` | id, document_id, review_id NOT NULL, exported_at | Mock export |
| `audit_findings` | id, entry_id or source_id, kind (`stale`, `conflict`, `duplicate`, `gap`), detail | Readiness report |

Constraints:
- `answer_text` must be null when `drafts.status = needs_human`.
- Entries from `deprecated` sources are excluded at retrieval and rejected by the provenance check.
- `export()` throws without an approved review; the database constraint backs it up.

## 7. Evaluation harness

`pnpm eval` runs the full pipeline on the held-out RFP and questionnaire and compares output with `answer_key.json`. The key records the "submitted" answer and whether the library genuinely supports an answer, per question.

Fixtures: a fictional company with about 8 past proposals, 20 to 30 policy and certification entries, and about 60 approved Q&As; one held-out RFP of about 25 questions; one questionnaire of about 40 rows. Seeded traps: two conflicting SOC 2 dates, a deprecated pricing document, a duplicate answer with different wording, an injected instruction inside a document, and about 10% of questions the library cannot answer.

| Metric | Definition | Gate |
|---|---|---|
| Accepted without major edits | Share of draftable answers whose similarity to the key is at or above a threshold, with matching yes/no value | Reported |
| Citation coverage | Share of draftable answers whose claims are all backed by their citations | 100% (hard) |
| Correct routing | Share of seeded traps and unanswerable questions sent to `needs_human` | 100% on seeded traps (hard) |
| Wrong-fact rate | Draftable answers contradicting the key on a yes/no, date or number | 0 (hard) |
| Hours saved (estimate) | Questions drafted × assumed minutes per manual answer, labelled as an assumption | Reported |

Similarity is deterministic (normalized edit distance plus key-fact matching), not an LLM judge. CI uses the mock provider. `pnpm eval:live` runs the Gateway provider and reports the same metrics; it is not a CI gate. Output: `eval/report.md` plus per-question JSON. The report states that hours saved is an assumption and that a client's own baseline must be measured first.

## 8. Error handling

Any failure leads to `needs_human`, never a guessed draft.

| Failure | Behavior |
|---|---|
| No or low-score retrieval | `needs_human` (`no_evidence`); LLM not called |
| Conflicting evidence | `needs_human` (`conflict`); both sources shown |
| Stale or deprecated evidence | `needs_human` (`stale`); deprecated entries never citable |
| LLM error, timeout or invalid JSON | One retry, then `needs_human` (`low_confidence`); log the error, not document text |
| Schema or provenance check fails | Draft discarded, then `needs_human` |
| Instructions inside documents | Treated as data in a delimited block; output still validated |
| Unparseable RFP row | Kept as `needs_human` with raw row preserved |
| Export without approved review | `export()` throws |

## 9. Testing

- Domain unit tests (the bulk): conflict, staleness, draftable decision, provenance, scoring, approval gate. No SDK or database.
- Integration tests: ingest, retrieval and drafting against a test Postgres with the mock provider, one per failure row above.
- Contract test: real and mock providers satisfy the same interface and schema.
- Eval as a test: `pnpm eval` with the mock provider in CI; fails on any hard gate.
- Playwright: accept, edit and reject flows, the mock export, and export blocked while any answer is unreviewed.

## 10. Build order

1. Scaffold (Next.js, TypeScript, Drizzle, Vitest, pnpm scripts); rewrite `CLAUDE.md` and `AGENTS.md` for Project 4.
2. Domain rules and scoring (TDD).
3. Schema, migrations and constraint tests.
4. Synthetic fixtures and answer key.
5. Ingest and retrieval.
6. Drafting: provider interface, mock provider, Gateway provider.
7. Audit report.
8. Eval harness with CI gates.
9. Review UI and mock export with Playwright flows.
10. Live eval run and results write-up.

Each step ends with verified command output before the next begins. No commit, push or deploy unless asked.

## 11. Defaults to tune during the eval

- Staleness window: 12 months since `last_reviewed_at`.
- Similarity threshold for "accepted without major edits".
- Retrieval score floor for `no_evidence`.
- Verbatim-reuse similarity threshold.
- Assumed minutes per manual answer for the hours-saved estimate.

## 12. Known gaps

- `CLAUDE.md` and `AGENTS.md` currently describe Project 2 and reference a missing `codex.md`; step 1 replaces them.
- This folder is not a git repository. The spec is not committed.
