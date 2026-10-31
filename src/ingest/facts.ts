import type { Fact } from '../domain/types';

interface FactRule {
  key: string;
  pattern: RegExp;
  value: (match: RegExpMatchArray) => string;
}

/** Rule order is output order. Add a rule here to teach ingest a new comparable fact. */
const RULES: FactRule[] = [
  { key: 'soc2_report_date', pattern: /SOC 2 Type II report is dated (\d{4}-\d{2}-\d{2})/i, value: (m) => m[1]! },
  { key: 'iso27001_expiry', pattern: /ISO 27001 certificate expires (\d{4}-\d{2}-\d{2})/i, value: (m) => m[1]! },
  { key: 'encryption_at_rest', pattern: /at rest with (AES-\d+)/i, value: (m) => m[1]!.toUpperCase() },
  { key: 'uptime_sla_percent', pattern: /uptime SLA of (\d+(?:\.\d+)?)%/i, value: (m) => m[1]! },
  { key: 'data_retention_days', pattern: /retains? customer data for (\d+) days/i, value: (m) => m[1]! },
  { key: 'breach_notification_hours', pattern: /breach within (\d+) hours/i, value: (m) => m[1]! },
  { key: 'rto_hours', pattern: /recovery time objective of (\d+) hours/i, value: (m) => m[1]! },
  { key: 'rpo_hours', pattern: /recovery point objective of (\d+) hours/i, value: (m) => m[1]! },
];

export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (match) facts.push({ key: rule.key, value: rule.value(match) });
  }
  return facts;
}
