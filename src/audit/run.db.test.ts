import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { NOW } from '../domain/test-helpers';
import { loadFixtures } from '../fixtures/load';
import { runAudit } from './run';

const { client, db, close } = connectTest();
afterAll(close);
beforeAll(async () => {
  await resetTables(client);
  await loadFixtures(db);
});

describe('runAudit on the fixtures', () => {
  it('finds every seeded problem and nothing else', async () => {
    const findings = await runAudit(db, NOW);
    const counts = Object.fromEntries(
      ['stale', 'conflict', 'duplicate', 'injection', 'gap'].map((k) => [k, findings.filter((f) => f.kind === k).length]),
    );
    expect(counts).toEqual({ stale: 2, conflict: 1, duplicate: 1, injection: 1, gap: 8 });
  });

  it('stores the findings and replaces them on a second run', async () => {
    await runAudit(db, NOW);
    const rows = await client`SELECT count(*)::int AS n FROM audit_findings`;
    expect(rows[0]!.n).toBe(13);
  });

  it('reports the gaps as the unanswerable and injected questions', async () => {
    const findings = await runAudit(db, NOW);
    const gaps = findings.filter((f) => f.kind === 'gap').map((f) => f.detail);
    expect(gaps.some((d) => d.includes('on-premise'))).toBe(true);
    expect(gaps.some((d) => d.includes('FedRAMP'))).toBe(true);
    expect(gaps.some((d) => d.includes('pricing'))).toBe(false);
  });
});
