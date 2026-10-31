# RFP drafting: eval results (2026-10-31)

**The live eval was NOT run.** No API key is configured (`AI_GATEWAY_API_KEY` is not set), and the user will run it later themselves. The "live" column is therefore empty, and nothing below describes live-model behaviour. Everything here comes from `mock-results.json` and `mock-report.md` in this folder. All data is synthetic and the provider is a deterministic mock.

## 1. What was run

- Commands: `pnpm eval` (resets and re-seeds the dev database, then drafts with the mock provider). Output was copied to `mock-report.md` and `mock-results.json`.
- Provider, exactly as in the results file: `mock-extractive`.
- Evaluation date: 2026-10-31.
- Fixture sizes (from the files): 65 questions scored; 55 drafted without a person; 10 routed to a person (1 conflict, 1 stale, 8 no_evidence); 10 questions marked as guarded (traps or unanswerable). Library: 74 entries across 15 sources, and the split of the 10 guarded questions is 3 traps (conflicting SOC 2 dates, a deprecated pricing sheet, an injected FedRAMP instruction) plus 7 unanswerable. These two facts are not in the results files; they are asserted by `src/fixtures/fixtures.test.ts` and `src/audit/run.db.test.ts`, which pass.

## 2. Results (mock provider only)

| Metric | mock-extractive |
|---|---|
| Drafted without a person | 55 |
| Accepted without major edits (of drafted) | 94.5% (52 of 55) |
| Citation coverage | 100.0% |
| Correct routing of traps and unanswerable questions | 100.0% |
| Wrong facts | 0 |
| Hours saved (estimate) | 18.33 |

Hard gates:

| Gate | Result | Actual | Required |
|---|---|---|---|
| Citation coverage | PASS | 1 | = 100% |
| Correct routing of traps and unanswerable questions | PASS | 1 | = 100% |
| Wrong facts | PASS | 0 | = 0 |

Live column: not run. No comparison table was generated, because `pnpm eval:compare` needs two results files.

## 3. What the live model did differently

Pending the live run. To produce it later:

1. Put `AI_GATEWAY_API_KEY` in `.env.local`.
2. `pnpm eval:live`
3. `cp eval/results.json docs/superpowers/results/live-results.json`
4. `pnpm eval:compare docs/superpowers/results/mock-results.json docs/superpowers/results/live-results.json`

Note: `pnpm eval:live` makes about 55 model calls (one per drafted question).

The mock drafted three questions that were not accepted as-is:

- `fabrikam-rfp:1`: Describe how customer data is encrypted at rest and in transit.
- `fabrikam-rfp:4`: Describe your incident response process and breach notification timeline.
- `fabrikam-questionnaire:12`: Do you maintain a list of subprocessors?

Why the extractive mock misses them (from the fixture definitions in `src/fixtures/`, not from the results files, which hold no draft text): the mock quotes one sentence of the best entry. For `fabrikam-rfp:4` the submitted answer is two sentences (plan, then the 72-hour notification), so a one-sentence quote omits the 72-hour fact. For `fabrikam-rfp:1` the submitted answer is worded differently from the library sentence the mock quotes. For `fabrikam-questionnaire:12` the submitted answer is the second sentence of the entry, and the mock picked the first. None is a wrong fact; all three are wording or sentence-choice differences, which the live model may handle differently.

## 4. What the numbers mean and do not mean

- The mock accepted rate (94.5%) is high by construction: the answer key was derived from the library, and the mock extracts from the library.
- Hours saved (18.33) is an assumption (minutes per manual answer times drafted answers), not a measurement. A real client baseline must be measured first.
- Retrieval is a baseline. Every supported question scored 0.37 or more against the 0.35 floor, so the margin is thin and the result depends on the fixtures being worded to be matched.
- The fixtures are synthetic.
- No negative-polarity questions (where the right answer is "no, we do not") were tested.
- Passing the three gates on the mock shows the routing and citation machinery works. It says nothing about model quality.

## 5. Recommended next steps

1. Run the live eval with the commands in section 3, and read the "handled differently" list before drawing any conclusion. Evidence: the live column is empty.
2. Look at the three not-accepted drafts (`fabrikam-rfp:1`, `fabrikam-rfp:4`, `fabrikam-questionnaire:12`) and decide whether each is a real gap or a scoring artefact. Evidence: 52 of 55 accepted.
3. Add negative-polarity questions to the fixtures. Evidence: none were tested.
4. Measure a real manual-answer baseline before quoting hours saved. Evidence: 18.33 is an assumption.
5. Consider a real embedding model only if the live run shows retrieval-limited misses. Evidence: today's minimum supported score of 0.37 sits close to the 0.35 floor.
