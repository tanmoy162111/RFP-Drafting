import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('plain text')).toBe('plain text');
  });

  it('quotes cells with commas, quotes and newlines, doubling inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
});

describe('toCsv', () => {
  const row = {
    ordinal: 3,
    section: 'Security',
    question: 'Do you encrypt data?',
    answer: 'Yes, with AES-256.',
    status: 'accepted',
    sources: 'Policy (mock)',
  };

  it('writes a header, CRLF line endings and a mock label on every row', () => {
    const csv = toCsv([row]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('ordinal,section,question,answer,status,sources,label');
    expect(lines[1]).toBe('3,Security,Do you encrypt data?,"Yes, with AES-256.",accepted,Policy (mock),mock - not submitted');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes only the header for no rows', () => {
    expect(toCsv([])).toBe('ordinal,section,question,answer,status,sources,label\r\n');
  });
});
