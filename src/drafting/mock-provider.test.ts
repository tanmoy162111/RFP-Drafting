import { describe, it, expect } from 'vitest';
import { makeEvidence } from '../domain/test-helpers';
import { MockDraftProvider } from './mock-provider';

const evidence = [
  makeEvidence({
    entryId: 'a',
    text: 'Access to production systems requires multi-factor authentication. Access reviews run every quarter.',
  }),
];

describe('MockDraftProvider', () => {
  it('quotes the sentence that best matches the question and cites its entry', async () => {
    const result = await new MockDraftProvider().draft({
      question: 'How often are access reviews performed?',
      answerType: 'narrative',
      evidence,
    });
    expect(result.answer).toBe('Access reviews run every quarter.');
    expect(result.claims).toEqual([{ text: 'Access reviews run every quarter.', entryIds: ['a'] }]);
    expect(result.yesNo).toBeUndefined();
  });

  it('prefixes Yes. and sets yesNo for yes/no questions', async () => {
    const result = await new MockDraftProvider().draft({
      question: 'Do you require multi-factor authentication?',
      answerType: 'yes_no',
      evidence,
    });
    expect(result.answer).toBe('Yes. Access to production systems requires multi-factor authentication.');
    expect(result.yesNo).toBe('yes');
  });

  it('is deterministic', async () => {
    const request = { question: 'How often are access reviews performed?', answerType: 'narrative' as const, evidence };
    const provider = new MockDraftProvider();
    expect(await provider.draft(request)).toEqual(await provider.draft(request));
  });

  it('refuses to draft without evidence', async () => {
    await expect(
      new MockDraftProvider().draft({ question: 'Anything?', answerType: 'narrative', evidence: [] }),
    ).rejects.toThrow('evidence');
  });
});
