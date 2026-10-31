import type { Db } from '../db/client';
import { libraryEntries, librarySources, questions, rfpDocuments } from '../db/schema';
import { chunkBody } from './chunk';
import { embed } from './embed';
import { extractFacts } from './facts';
import { parseDocument } from './parse-document';
import { indexText } from './text';
import type { DocumentInput, SourceInput } from './types';

export async function ingestSource(db: Db, input: SourceInput): Promise<{ sourceId: string; entryCount: number }> {
  const chunks = chunkBody(input.body);
  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(librarySources)
      .values({
        slug: input.slug,
        title: input.title,
        kind: input.kind,
        owner: input.owner,
        lastReviewedAt: input.lastReviewedAt,
        status: input.status,
      })
      .returning({ id: librarySources.id });
    if (!source) throw new Error(`failed to insert source ${input.slug}`);

    if (chunks.length > 0) {
      await tx.insert(libraryEntries).values(
        chunks.map((chunk, ordinal) => ({
          sourceId: source.id,
          ordinal,
          topic: chunk.topic,
          text: chunk.text,
          embedding: embed(indexText(chunk.topic, chunk.text)),
          facts: extractFacts(chunk.text),
          effectiveDate: input.lastReviewedAt,
        })),
      );
    }
    return { sourceId: source.id, entryCount: chunks.length };
  });
}

export async function ingestDocument(
  db: Db,
  input: DocumentInput,
): Promise<{ documentId: string; questionCount: number }> {
  const items = parseDocument(input.text);
  return db.transaction(async (tx) => {
    const [document] = await tx
      .insert(rfpDocuments)
      .values({ slug: input.slug, kind: input.kind, title: input.title, heldOut: input.heldOut })
      .returning({ id: rfpDocuments.id });
    if (!document) throw new Error(`failed to insert document ${input.slug}`);

    if (items.length > 0) {
      await tx.insert(questions).values(
        items.map((item) =>
          item.kind === 'question'
            ? {
                documentId: document.id,
                ordinal: item.ordinal,
                section: item.section,
                text: item.text,
                answerType: item.answerType,
                parseStatus: 'parsed' as const,
              }
            : {
                documentId: document.id,
                ordinal: item.ordinal,
                section: item.section,
                text: item.raw,
                answerType: 'narrative' as const,
                parseStatus: 'unparsed' as const,
              },
        ),
      );
    }
    return { documentId: document.id, questionCount: items.length };
  });
}
