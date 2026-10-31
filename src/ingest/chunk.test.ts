import { describe, it, expect } from 'vitest';
import { chunkBody } from './chunk';

describe('chunkBody', () => {
  it('turns each headed block into a chunk with its topic', () => {
    const body = '## Encryption\nWe encrypt data at rest.\n\n## Backups\nBackups run daily.';
    expect(chunkBody(body)).toEqual([
      { topic: 'Encryption', text: 'We encrypt data at rest.' },
      { topic: 'Backups', text: 'Backups run daily.' },
    ]);
  });

  it('uses topic general when a block has no heading', () => {
    expect(chunkBody('Plain paragraph here.')).toEqual([{ topic: 'general', text: 'Plain paragraph here.' }]);
  });

  it('joins wrapped lines and collapses whitespace', () => {
    expect(chunkBody('## Topic\nline one\n   line two')).toEqual([{ topic: 'Topic', text: 'line one line two' }]);
  });

  it('drops empty bodies and heading-only blocks', () => {
    expect(chunkBody('')).toEqual([]);
    expect(chunkBody('## Lonely heading')).toEqual([]);
  });

  it('splits an overlong block at sentence boundaries, keeping order', () => {
    const body = '## Long\nOne is here. Two is here. Three is here.';
    const chunks = chunkBody(body, 22);
    expect(chunks.map((c) => c.text)).toEqual(['One is here.', 'Two is here.', 'Three is here.']);
    expect(chunks.every((c) => c.topic === 'Long')).toBe(true);
  });
});
