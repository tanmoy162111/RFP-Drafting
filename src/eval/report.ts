import type { EvalResult } from './run';

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

export function renderEvalReport(result: EvalResult): string {
  const m = result.metrics;
  const lines = [
    '# Eval report (mock data)',
    '',
    `Provider: \`${result.provider}\`. Evaluation date: ${result.now}. Questions scored: ${result.items.length}.`,
    '',
    '## Metrics',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Drafted without a person | ${m.drafted} |`,
    `| Accepted without major edits (of drafted) | ${pct(m.acceptedRate)} |`,
    `| Citation coverage | ${pct(m.citationCoverage)} |`,
    `| Correct routing of traps and unanswerable questions | ${pct(m.correctRouting)} |`,
    `| Wrong facts | ${m.wrongFactCount} |`,
    `| Hours saved (estimate) | ${m.hoursSavedEstimate} |`,
    '',
    'Hours saved is an assumption (minutes per manual answer times drafted answers), not a measurement. A real client baseline must be measured first.',
    '',
    '## Gates',
    '',
    '| Gate | Result | Actual | Required |',
    '|---|---|---|---|',
    ...result.gates.map((g) => `| ${g.name} | ${g.pass ? 'PASS' : 'FAIL'} | ${g.actual} | ${g.required} |`),
    '',
    '## Routed to a person',
    '',
    ...Object.entries(result.humanByReason).map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    ...result.items.filter((i) => i.status === 'needs_human').map((i) => `- ${i.key} (${i.reason}): ${i.question}`),
    '',
    '## Drafted but not accepted as-is',
    '',
    ...result.items.filter((i) => i.status === 'draftable' && !i.accepted).map((i) => `- ${i.key}${i.wrongFact ? ' (WRONG FACT)' : ''}: ${i.question}`),
  ];
  return `${lines.join('\n')}\n`;
}
