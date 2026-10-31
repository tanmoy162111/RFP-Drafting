import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { Evidence, Fact, SourceStatus } from '../domain/types';
import { embed } from '../ingest/embed';
import { indexText } from '../ingest/text';
import { fuse, lexicalScore } from './score';

/** Re-rank the whole library at demo scale. Keep above the number of library entries. */
const CANDIDATES = 100;

type Row = {
  entryId: string;
  sourceId: string;
  sourceStatus: SourceStatus;
  lastReviewedAt: string;
  topic: string;
  text: string;
  facts: Fact[] | string;
  vec: number | string;
};

/**
 * Evidence for one question: nearest entries by cosine similarity, re-ranked by blended score.
 * Returns entries of every source status; routeQuestion() decides what is usable.
 */
export async function retrieve(db: Db, question: string, limit = 8): Promise<Evidence[]> {
  const vector = JSON.stringify(embed(question));
  const rows = await db.execute<Row>(sql`
    SELECT e.id AS "entryId",
           e.source_id AS "sourceId",
           s.status AS "sourceStatus",
           s.last_reviewed_at::text AS "lastReviewedAt",
           e.topic,
           e.text,
           e.facts,
           1 - (e.embedding <=> ${vector}::vector) AS vec
    FROM library_entries e
    JOIN library_sources s ON s.id = e.source_id
    ORDER BY e.embedding <=> ${vector}::vector
    LIMIT ${CANDIDATES}`);

  return [...rows]
    .map((row): Evidence => {
      const facts = typeof row.facts === 'string' ? (JSON.parse(row.facts) as Fact[]) : row.facts;
      return {
        entryId: row.entryId,
        sourceId: row.sourceId,
        sourceStatus: row.sourceStatus,
        lastReviewedAt: row.lastReviewedAt,
        text: row.text,
        facts,
        score: fuse(Number(row.vec), lexicalScore(question, indexText(row.topic, row.text))),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
