import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflict';
import { makeEvidence } from './test-helpers';

describe('findConflicts', () => {
  it('returns nothing when no entry has facts', () => {
    expect(findConflicts([makeEvidence(), makeEvidence({ entryId: 'e2' })])).toEqual([]);
  });

  it('ignores differences in case and whitespace', () => {
    const a = makeEvidence({ entryId: 'e1', facts: [{ key: 'region', value: 'EU-West ' }] });
    const b = makeEvidence({ entryId: 'e2', facts: [{ key: 'region', value: 'eu-west' }] });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('reports different values for the same key, with the entries involved', () => {
    const a = makeEvidence({ entryId: 'e1', facts: [{ key: 'soc2_report_date', value: '2025-03-31' }] });
    const b = makeEvidence({ entryId: 'e2', facts: [{ key: 'soc2_report_date', value: '2024-03-31' }] });
    expect(findConflicts([a, b])).toEqual([
      {
        key: 'soc2_report_date',
        values: [
          { entryId: 'e1', value: '2025-03-31' },
          { entryId: 'e2', value: '2024-03-31' },
        ],
      },
    ]);
  });

  it('does not treat different keys as a conflict', () => {
    const a = makeEvidence({ entryId: 'e1', facts: [{ key: 'soc2_report_date', value: '2025-03-31' }] });
    const b = makeEvidence({ entryId: 'e2', facts: [{ key: 'iso_cert_date', value: '2024-03-31' }] });
    expect(findConflicts([a, b])).toEqual([]);
  });
});
