import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadFixtures } from '../fixtures/load';
import { connectTest, resetTables } from '../db/test-db';
import { ingestDocument } from './load';

const { client, db, close } = connectTest();
afterAll(close);
beforeEach(() => resetTables(client));

const count = async (table: string): Promise<number> => {
  const rows = await client.unsafe(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0]!.n as number;
};

describe('loadFixtures', () => {
  it('writes 15 sources, 74 entries, 2 documents and 65 questions', async () => {
    await loadFixtures(db);
    expect(await count('library_sources')).toBe(15);
    expect(await count('library_entries')).toBe(74);
    expect(await count('rfp_documents')).toBe(2);
    expect(await count('questions')).toBe(65);
  });

  it('stores extracted facts and 256-dimension embeddings', async () => {
    await loadFixtures(db);
    const soc2 = await client`SELECT facts FROM library_entries WHERE topic = 'SOC 2'`;
    expect(soc2[0]!.facts).toEqual([{ key: 'soc2_report_date', value: '2025-03-31' }]);
    const dims = await client`SELECT DISTINCT vector_dims(embedding) AS d FROM library_entries`;
    expect(dims.map((r) => r.d)).toEqual([256]);
  });

  it('preserves source status and review date', async () => {
    await loadFixtures(db);
    const rows = await client`SELECT status, last_reviewed_at::text AS d FROM library_sources WHERE slug = 'pricing-2023'`;
    expect(rows[0]).toMatchObject({ status: 'deprecated', d: '2023-05-01' });
  });

  it('marks held-out documents', async () => {
    await loadFixtures(db);
    const rows = await client`SELECT held_out FROM rfp_documents`;
    expect(rows.every((r) => r.held_out === true)).toBe(true);
  });
});

describe('ingestDocument', () => {
  it('stores unparseable lines as unparsed questions with the raw text', async () => {
    await ingestDocument(db, {
      slug: 'odd',
      kind: 'rfp',
      title: 'Odd doc (mock)',
      heldOut: false,
      text: '# S\n1. Do you use MFA?\nAppendix B - see attached spreadsheet',
    });
    const rows = await client`SELECT ordinal, text, parse_status, answer_type FROM questions ORDER BY ordinal`;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ parse_status: 'parsed', answer_type: 'yes_no' });
    expect(rows[1]).toMatchObject({
      ordinal: 2,
      text: 'Appendix B - see attached spreadsheet',
      parse_status: 'unparsed',
    });
  });
});
