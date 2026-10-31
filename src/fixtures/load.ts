import type { Db } from '../db/client';
import { ingestDocument, ingestSource } from '../ingest/load';
import { HELD_OUT_DOCUMENTS } from './held-out';
import { LIBRARY_SOURCES } from './library';

/** Loads the whole synthetic library and the held-out documents. All data is mock. */
export async function loadFixtures(db: Db): Promise<void> {
  for (const source of LIBRARY_SOURCES) await ingestSource(db, source);
  for (const document of HELD_OUT_DOCUMENTS) await ingestDocument(db, document);
}
