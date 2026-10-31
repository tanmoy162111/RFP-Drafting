import { describe, it, expect } from 'vitest';
import { checkProvenance } from './provenance';
import { makeEvidence } from './test-helpers';

const evidence = [makeEvidence({ entryId: 'e1', text: 'We encrypt data at rest with AES-256.' })];

describe('checkProvenance', () => {
  it('passes a grounded answer', () => {
    const result = checkProvenance(
      {
        answer: 'Data at rest is encrypted with AES-256.',
        claims: [{ text: 'Data at rest uses AES-256', entryIds: ['e1'] }],
      },
      evidence,
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects a figure that no cited entry contains', () => {
    const result = checkProvenance(
      {
        answer: 'Data at rest is encrypted with AES-512.',
        claims: [{ text: 'Data at rest uses AES-512', entryIds: ['e1'] }],
      },
      evidence,
    );
    expect(result).toEqual({ ok: false, violations: ['unsupported_figure:512'] });
  });

  it('rejects a citation to an unknown entry', () => {
    const result = checkProvenance(
      { answer: 'Encrypted.', claims: [{ text: 'Encrypted', entryIds: ['zzz'] }] },
      evidence,
    );
    expect(result).toEqual({ ok: false, violations: ['unknown_citation:zzz'] });
  });

  it('rejects a claim with no citation', () => {
    const result = checkProvenance(
      { answer: 'Encrypted.', claims: [{ text: 'Encrypted', entryIds: [] }] },
      evidence,
    );
    expect(result).toEqual({ ok: false, violations: ['claim_without_citation'] });
  });

  it('rejects an empty answer and a missing claim list', () => {
    const result = checkProvenance({ answer: '  ', claims: [] }, evidence);
    expect(result).toEqual({ ok: false, violations: ['empty_answer', 'no_claims'] });
  });

  it('rejects a citation to a deprecated source', () => {
    const deprecated = [makeEvidence({ entryId: 'old', sourceStatus: 'deprecated' })];
    const result = checkProvenance(
      { answer: 'Encrypted.', claims: [{ text: 'Encrypted', entryIds: ['old'] }] },
      deprecated,
    );
    expect(result).toEqual({ ok: false, violations: ['deprecated_citation:old'] });
  });

  it('accepts a figure that appears only in a cited entry fact', () => {
    const withFact = [
      makeEvidence({
        entryId: 'e2',
        text: 'Our SOC 2 report is current.',
        facts: [{ key: 'soc2_report_date', value: '2025-03-31' }],
      }),
    ];
    const result = checkProvenance(
      {
        answer: 'Our SOC 2 report is dated 2025-03-31.',
        claims: [{ text: 'SOC 2 report date', entryIds: ['e2'] }],
      },
      withFact,
    );
    expect(result).toEqual({ ok: true });
  });
});
