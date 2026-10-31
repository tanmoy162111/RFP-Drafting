import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { connectTest, resetTables } from './test-db';

const { client, close } = connectTest();
afterAll(close);
beforeEach(() => resetTables(client));

interface Ids {
  sourceId: string;
  entryId: string;
  documentId: string;
  questionId: string;
}

async function seed(sql: Sql): Promise<Ids> {
  const [source] = await sql<{ id: string }[]>`
    INSERT INTO library_sources (slug, title, kind, owner, last_reviewed_at, status)
    VALUES ('s', 'S', 'policy', 'o', '2026-01-01', 'approved') RETURNING id`;
  const [entry] = await sql<{ id: string }[]>`
    INSERT INTO library_entries (source_id, ordinal, topic, text, embedding)
    VALUES (${source!.id}, 0, 't', 'x', array_fill(0::real, ARRAY[256])::vector) RETURNING id`;
  const [doc] = await sql<{ id: string }[]>`
    INSERT INTO rfp_documents (slug, kind, title) VALUES ('d', 'rfp', 'D') RETURNING id`;
  const [question] = await sql<{ id: string }[]>`
    INSERT INTO questions (document_id, ordinal, section, text, answer_type)
    VALUES (${doc!.id}, 1, 's', 'q?', 'narrative') RETURNING id`;
  return { sourceId: source!.id, entryId: entry!.id, documentId: doc!.id, questionId: question!.id };
}

/** A draftable draft plus its citation, in one transaction (the deferred guard checks at commit). */
async function draftWithCitation(sql: Sql, ids: Ids): Promise<string> {
  return sql.begin(async (tx) => {
    const [draft] = await tx<{ id: string }[]>`
      INSERT INTO drafts (question_id, status, answer_text, model)
      VALUES (${ids.questionId}, 'draftable', 'An answer.', 'mock') RETURNING id`;
    await tx`INSERT INTO citations (draft_id, entry_id) VALUES (${draft!.id}, ${ids.entryId})`;
    return draft!.id;
  });
}

describe('mock labelling', () => {
  it('rejects a source that is not labelled mock', async () => {
    await expect(
      client`INSERT INTO library_sources (slug, title, kind, owner, last_reviewed_at, status, mock)
             VALUES ('x', 'X', 'policy', 'o', '2026-01-01', 'approved', false)`,
    ).rejects.toThrow(/library_sources_mock_true/);
  });
});

describe('draft shape', () => {
  it('rejects a needs_human draft that carries answer text', async () => {
    const ids = await seed(client);
    await expect(
      client`INSERT INTO drafts (question_id, status, reason_code, answer_text, model)
             VALUES (${ids.questionId}, 'needs_human', 'conflict', 'leaked text', 'mock')`,
    ).rejects.toThrow(/drafts_needs_human_shape/);
  });

  it('rejects a needs_human draft with no reason code', async () => {
    const ids = await seed(client);
    await expect(
      client`INSERT INTO drafts (question_id, status, model) VALUES (${ids.questionId}, 'needs_human', 'mock')`,
    ).rejects.toThrow(/drafts_needs_human_shape/);
  });

  it('rejects a draftable draft with no answer text', async () => {
    const ids = await seed(client);
    await expect(
      client`INSERT INTO drafts (question_id, status, model) VALUES (${ids.questionId}, 'draftable', 'mock')`,
    ).rejects.toThrow(/drafts_draftable_shape/);
  });

  it('accepts a valid needs_human draft', async () => {
    const ids = await seed(client);
    await client`INSERT INTO drafts (question_id, status, reason_code, model)
                 VALUES (${ids.questionId}, 'needs_human', 'conflict', 'mock')`;
    const rows = await client`SELECT 1 FROM drafts`;
    expect(rows).toHaveLength(1);
  });
});

describe('citation guard', () => {
  it('rejects a draftable draft with no citation when the transaction commits', async () => {
    const ids = await seed(client);
    await expect(
      client.begin(async (tx) => {
        await tx`INSERT INTO drafts (question_id, status, answer_text, model)
                 VALUES (${ids.questionId}, 'draftable', 'An answer.', 'mock')`;
      }),
    ).rejects.toThrow(/has no citation/);
    expect(await client`SELECT 1 FROM drafts`).toHaveLength(0);
  });

  it('accepts a draftable draft that has a citation in the same transaction', async () => {
    const ids = await seed(client);
    await draftWithCitation(client, ids);
    expect(await client`SELECT 1 FROM drafts`).toHaveLength(1);
    expect(await client`SELECT 1 FROM citations`).toHaveLength(1);
  });
});

describe('review and export guards', () => {
  it('rejects an edit review with no final text', async () => {
    const ids = await seed(client);
    const draftId = await draftWithCitation(client, ids);
    await expect(
      client`INSERT INTO reviews (draft_id, reviewer, decision) VALUES (${draftId}, 'r', 'edit')`,
    ).rejects.toThrow(/reviews_edit_needs_text/);
  });

  it('rejects an export with no review', async () => {
    const ids = await seed(client);
    await expect(
      client`INSERT INTO exports (document_id, review_id) VALUES (${ids.documentId}, NULL)`,
    ).rejects.toThrow(/null value in column "review_id"/);
  });

  it('rejects an export that points at a rejected review', async () => {
    const ids = await seed(client);
    const draftId = await draftWithCitation(client, ids);
    const [review] = await client<{ id: string }[]>`
      INSERT INTO reviews (draft_id, reviewer, decision) VALUES (${draftId}, 'r', 'reject') RETURNING id`;
    await expect(
      client`INSERT INTO exports (document_id, review_id) VALUES (${ids.documentId}, ${review!.id})`,
    ).rejects.toThrow(/rejection/);
  });

  it('accepts an export that points at an accepted review', async () => {
    const ids = await seed(client);
    const draftId = await draftWithCitation(client, ids);
    const [review] = await client<{ id: string }[]>`
      INSERT INTO reviews (draft_id, reviewer, decision) VALUES (${draftId}, 'r', 'accept') RETURNING id`;
    await client`INSERT INTO exports (document_id, review_id) VALUES (${ids.documentId}, ${review!.id})`;
    expect(await client`SELECT 1 FROM exports`).toHaveLength(1);
  });
});

describe('audit findings', () => {
  it('rejects a finding that points at nothing', async () => {
    await expect(client`INSERT INTO audit_findings (kind, detail) VALUES ('stale', 'x')`).rejects.toThrow(
      /audit_findings_has_target/,
    );
  });
});
