export interface ReportFinding {
  kind: 'stale' | 'conflict' | 'duplicate' | 'injection' | 'gap';
  detail: string;
}

const SECTIONS: { kind: ReportFinding['kind']; heading: string }[] = [
  { kind: 'stale', heading: 'Stale or deprecated sources' },
  { kind: 'conflict', heading: 'Conflicts' },
  { kind: 'duplicate', heading: 'Near-duplicates' },
  { kind: 'injection', heading: 'Instruction-like text' },
  { kind: 'gap', heading: 'Gaps' },
];

export function renderAuditReport(findings: ReportFinding[]): string {
  const lines = ['# Content readiness audit (mock data)', '', '| Kind | Findings |', '|---|---|'];
  for (const { kind } of SECTIONS) lines.push(`| ${kind} | ${findings.filter((f) => f.kind === kind).length} |`);

  for (const { kind, heading } of SECTIONS) {
    const items = findings.filter((f) => f.kind === kind);
    if (items.length === 0) continue;
    lines.push('', `## ${heading}`, ...items.map((f) => `- ${f.detail}`));
  }
  return `${lines.join('\n')}\n`;
}
