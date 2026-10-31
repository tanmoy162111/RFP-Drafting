import { describe, it, expect } from 'vitest';
import { extractFacts } from './facts';

describe('extractFacts', () => {
  it('extracts the SOC 2 report date', () => {
    expect(extractFacts("Northwind's SOC 2 Type II report is dated 2025-03-31 and covers security.")).toEqual([
      { key: 'soc2_report_date', value: '2025-03-31' },
    ]);
  });

  it('extracts the ISO 27001 expiry', () => {
    expect(extractFacts("Northwind's ISO 27001 certificate expires 2027-06-30.")).toEqual([
      { key: 'iso27001_expiry', value: '2027-06-30' },
    ]);
  });

  it('extracts encryption at rest in upper case', () => {
    expect(extractFacts('Northwind encrypts customer data at rest with aes-256 and in transit with TLS 1.3.')).toEqual([
      { key: 'encryption_at_rest', value: 'AES-256' },
    ]);
  });

  it('extracts uptime, retention, breach notification and recovery objectives', () => {
    expect(extractFacts('Northwind commits to a monthly uptime SLA of 99.9% with credits.')).toEqual([
      { key: 'uptime_sla_percent', value: '99.9' },
    ]);
    expect(extractFacts('Northwind retains customer data for 90 days after contract termination.')).toEqual([
      { key: 'data_retention_days', value: '90' },
    ]);
    expect(extractFacts('Customers are notified of a confirmed breach within 72 hours.')).toEqual([
      { key: 'breach_notification_hours', value: '72' },
    ]);
    expect(
      extractFacts('Northwind targets a recovery time objective of 4 hours and a recovery point objective of 24 hours.'),
    ).toEqual([
      { key: 'rto_hours', value: '4' },
      { key: 'rpo_hours', value: '24' },
    ]);
  });

  it('returns several facts from one text, in rule order', () => {
    const text = "Northwind's SOC 2 Type II report is dated 2024-03-31. Data is encrypted at rest with AES-256.";
    expect(extractFacts(text).map((f) => f.key)).toEqual(['soc2_report_date', 'encryption_at_rest']);
  });

  it('returns nothing when no rule matches', () => {
    expect(extractFacts('Northwind includes scheduled reports and dashboards in every plan.')).toEqual([]);
  });
});
