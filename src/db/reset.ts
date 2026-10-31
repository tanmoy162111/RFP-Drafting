import type { Sql } from 'postgres';

/** Empties every table (used by tests, `pnpm db:seed` and the eval CLI). */
export async function resetTables(client: Sql): Promise<void> {
  await client.unsafe(
    'TRUNCATE exports, reviews, citations, drafts, audit_findings, questions, rfp_documents, library_entries, library_sources CASCADE',
  );
}
