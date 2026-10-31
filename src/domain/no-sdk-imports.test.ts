import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const dir = fileURLToPath(new URL('.', import.meta.url));

describe('domain import boundary', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('finds domain files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports only relative paths', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    const outside = specifiers.filter((s) => !s.startsWith('./') && !s.startsWith('../'));
    expect(outside).toEqual([]);
  });
});
