import { describe, it, expect } from 'vitest';
import { renderAuditReport, type ReportFinding } from './report';

const findings: ReportFinding[] = [
  { kind: 'stale', detail: 'legacy: last reviewed 2024-02-01' },
  { kind: 'conflict', detail: 'soc2_report_date: 2025-03-31 [a] vs 2024-03-31 [b]' },
  { kind: 'gap', detail: 'no usable evidence for: Do you hold PCI DSS certification?' },
  { kind: 'gap', detail: 'no usable evidence for: Is a government cloud region available?' },
];

describe('renderAuditReport', () => {
  it('summarises counts by kind, including kinds with zero findings', () => {
    const report = renderAuditReport(findings);
    expect(report).toContain('| stale | 1 |');
    expect(report).toContain('| conflict | 1 |');
    expect(report).toContain('| duplicate | 0 |');
    expect(report).toContain('| injection | 0 |');
    expect(report).toContain('| gap | 2 |');
  });

  it('lists each finding under its kind and marks the data as mock', () => {
    const report = renderAuditReport(findings);
    expect(report).toContain('## Conflicts');
    expect(report).toContain('- soc2_report_date: 2025-03-31 [a] vs 2024-03-31 [b]');
    expect(report).toContain('## Gaps');
    expect(report).toContain('mock');
  });
});
