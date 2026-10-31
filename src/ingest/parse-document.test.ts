import { describe, it, expect } from 'vitest';
import { inferAnswerType, parseDocument } from './parse-document';

describe('inferAnswerType', () => {
  it('treats do/does/is/are questions ending in ? as yes_no', () => {
    expect(inferAnswerType('Do you support single sign-on?')).toBe('yes_no');
    expect(inferAnswerType('Is data encrypted at rest?')).toBe('yes_no');
  });

  it('treats a yes/no opener followed by a follow-up question as yes_no', () => {
    expect(inferAnswerType('Do you hold an ISO 27001 certificate? If so, when does it expire?')).toBe('yes_no');
  });

  it('treats open questions and statements as narrative', () => {
    expect(inferAnswerType('Describe how data is encrypted.')).toBe('narrative');
    expect(inferAnswerType('How long do you retain data?')).toBe('narrative');
    expect(inferAnswerType('Do you encrypt data')).toBe('narrative');
  });
});

describe('parseDocument', () => {
  it('assigns sections and sequential ordinals', () => {
    const text = '# Security\n1. Describe your controls.\n2. Do you use MFA?\n\n# Delivery\n3. How long is onboarding?';
    expect(parseDocument(text)).toEqual([
      { kind: 'question', ordinal: 1, section: 'Security', text: 'Describe your controls.', answerType: 'narrative' },
      { kind: 'question', ordinal: 2, section: 'Security', text: 'Do you use MFA?', answerType: 'yes_no' },
      { kind: 'question', ordinal: 3, section: 'Delivery', text: 'How long is onboarding?', answerType: 'narrative' },
    ]);
  });

  it('defaults the section to General', () => {
    expect(parseDocument('1. Any question?')[0]).toMatchObject({ section: 'General' });
  });

  it('keeps unparseable lines as unparsed items with the raw text, never dropping them', () => {
    const text = '# Security\n1. Do you use MFA?\nAppendix B - see attached spreadsheet\n2. Is data encrypted?';
    const items = parseDocument(text);
    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({
      kind: 'unparsed',
      ordinal: 2,
      section: 'Security',
      raw: 'Appendix B - see attached spreadsheet',
    });
    expect(items[2]).toMatchObject({ kind: 'question', ordinal: 3 });
  });

  it('ignores blank lines', () => {
    expect(parseDocument('\n\n1. Do you use MFA?\n\n')).toHaveLength(1);
  });
});
