export interface SheetRow {
  ordinal: number;
  section: string;
  question: string;
  answer: string;
  status: string;
  sources: string;
}

const FORMULA_START = /^[=+\-@\t\r]/;
const HEADER = ['ordinal', 'section', 'question', 'answer', 'status', 'sources', 'label'];
const MOCK_LABEL = 'mock - not submitted';

/** RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet could read as a formula. */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: SheetRow[]): string {
  const lines = [
    HEADER.join(','),
    ...rows.map((r) =>
      [String(r.ordinal), r.section, r.question, r.answer, r.status, r.sources, MOCK_LABEL].map(csvCell).join(','),
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
