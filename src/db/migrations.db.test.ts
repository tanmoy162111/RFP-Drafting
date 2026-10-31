import { afterAll, describe, expect, it } from 'vitest';
import { connectTest } from './test-db';

const { client, close } = connectTest();
afterAll(close);

describe('migrations', () => {
  it('enable the vector extension', async () => {
    const rows = await client`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    expect(rows).toHaveLength(1);
  });

  it('create all nine tables', async () => {
    const rows = await client<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`;
    expect(rows.map((r) => r.table_name)).toEqual([
      'audit_findings',
      'citations',
      'drafts',
      'exports',
      'library_entries',
      'library_sources',
      'questions',
      'reviews',
      'rfp_documents',
    ]);
  });

  it('store embeddings as vector(256)', async () => {
    const rows = await client<{ t: string }[]>`
      SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute
      WHERE attrelid = 'library_entries'::regclass AND attname = 'embedding'`;
    expect(rows[0]?.t).toBe('vector(256)');
  });
});
