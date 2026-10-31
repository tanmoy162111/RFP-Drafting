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
