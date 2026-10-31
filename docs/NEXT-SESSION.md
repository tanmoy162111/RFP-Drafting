# Next session: what remains

Written 2026-10-31 at the end of the first build session. Read `CLAUDE.md` first, then this file.

## Where things stand

The whole system is built and verified with the **mock** provider. The one step not done is the **live model eval**.

| Check | Last result |
|---|---|
| `pnpm test` (unit) | 178 pass |
| `pnpm test:db` (needs Docker) | 143 pass |
| `pnpm e2e` (Playwright, builds the app) | 9 pass |
| `pnpm typecheck`, `pnpm build` | clean |
| `pnpm eval` (mock provider) | 3 of 3 hard gates pass: 55 drafted, 94.5% accepted, 0 wrong facts, 100% citation coverage, 100% correct routing |

Built, in order (specs and plans are in `docs/superpowers/`):
1. Domain rules in `src/domain/` (routing, provenance, injection screen, scoring, export gate). No SDK imports; a test enforces it.
2. Postgres + pgvector in Docker, Drizzle schema with guard triggers, 74-entry synthetic library, 65-question held-out answer key, retrieval.
3. Drafting pipeline (mock and AI Gateway providers), content-readiness audit, eval harness with CI gates.
4. Review UI (Next.js 16): accept, edit or reject, progress and edit-distance measurement, recorded mock export and CSV, Playwright tests. Then an accessibility-focused redesign (light and dark themes, question index, filter tabs).

Everything is synthetic and every integration is a mock. Nothing is ever sent anywhere.

## 1. Run the live eval (the main open item)

Needs an AI Gateway key, which only the user can provide, and costs about 55 model calls (one per drafted question; routed questions make no call). The user has already approved the run; only the key is missing.

1. User puts `AI_GATEWAY_API_KEY=...` in `.env.local` (gitignored). Never create or read that file, and never print the key. Check it exists with: `grep -q '^AI_GATEWAY_API_KEY=.' .env.local && echo present`.
2. `pnpm db:up`, then `pnpm eval:live`. It is report-only (always exits 0). Default model is `anthropic/claude-sonnet-5.5`; override with `DRAFT_MODEL` in `.env.local` if the Gateway has renamed it.
3. `cp eval/results.json docs/superpowers/results/live-results.json` and `cp eval/report.md docs/superpowers/results/live-report.md`.
4. `pnpm eval:compare docs/superpowers/results/mock-results.json docs/superpowers/results/live-results.json > docs/superpowers/results/comparison.md`.
5. Update `docs/superpowers/results/2026-10-31-rfp-drafting-results.md`: remove the "live eval was NOT run" banner, paste the comparison, and for every question the live model handled differently say whether it is a **real error** or a **scoring artefact** (the scorer treats any figure outside the answer key as a wrong fact, even a correct one). Use only numbers from the result files.
6. If the live run shows retrieval-limited misses (right answer exists, wrong or no evidence retrieved), that is the evidence for the retrieval upgrade below.

`pnpm eval` and `pnpm eval:live` both **reset the dev database**, which discards any reviews made in the UI. After a live run the dev UI shows the live model's drafts; run `pnpm eval` to go back to mock drafts.

## 2. Known limits and follow-ups

Retrieval and eval
- **Retrieval is a baseline.** A deterministic local embedder plus keyword overlap. Every supported question scores 0.37 or more against a 0.35 floor, and the fixtures were worded to be matched. Real client content will paraphrase more. The upgrade is a real embedding model, which needs a migration for the vector dimension (currently 256).
- **No negative-polarity questions** (correct answer is "No") in the fixtures, and the mock never answers no. Add some before trusting yes/no accuracy.
- **Scoring flags true but extra figures** as wrong facts. Consider scoring against figures present in the cited evidence, not only the answer key.
- **The mock eval is circular by design** (the key was derived from the library), so its 94.5% accepted rate says nothing about model quality. The three hard gates (grounding, routing, wrong facts) are the meaningful part.
- Fixtures are about two-thirds of the spec's scale (74 entries; the spec said about 100). Questions match the spec (25 RFP, 40 questionnaire).

Product
- **No login.** One mock reviewer identity (`demo reviewer (mock)`). Multi-user auth is out of scope in the spec.
- **Export is CSV only** (no DOCX or PDF).
- **The review lock check is not atomic**: two simultaneous reviewers could race. Fine for one reviewer.
- A reviewed card still shows a primary "Accept" button; a "Change decision" label would be clearer.
- The CSV 409 message can include a raw draft id (for example "draft <uuid> has no review"). Replace it with a plain sentence.
- Playwright covers the review and export flow but not the filter tabs, the question index, dark mode or a phone viewport, and there is no automated accessibility check (for example axe).

## 3. Housekeeping and decisions to revisit

- The GitHub repo https://github.com/tanmoy162111/RFP-Drafting is **public**. Everything in it is synthetic, but decide whether that is intended.
- Commits carry the author email `princedevil818@gmail.com`. Use GitHub's private `noreply` address going forward if that should not be public.
- `pnpm-workspace.yaml` sets `esbuild: false` (pnpm 11 blocks build scripts until told). Everything works with it; set it to `true` if the scripts are wanted.
- `AGENTS.md` contains a block added automatically by `next dev` ("This is NOT the Next.js you know"). It is tool boilerplate, not project policy.
- The project has no CI. A GitHub Action running `pnpm test`, `pnpm typecheck`, and `pnpm test:db` with a pgvector service would be a natural next step.

## Starting up

```
pnpm install
pnpm db:up          # Postgres + pgvector in Docker (container rfp-drafting-db, port 5435)
pnpm db:migrate     # apply migrations to the dev database
pnpm eval           # seed, draft with the mock provider, score, write eval/report.md
pnpm dev            # http://127.0.0.1:3100
```

Ports 5432 to 5434 belong to other projects on this machine; never touch those containers. Dev server is 3100, Playwright uses 3101.

Verify the baseline above before changing anything.
