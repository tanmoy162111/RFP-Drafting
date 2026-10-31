import { describe, it, expect } from 'vitest';
import { contentWords, indexText, stem, words } from './text';

describe('words', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(words('SOC 2, Type-II!')).toEqual(['soc', '2', 'type', 'ii']);
  });
});

describe('contentWords', () => {
  it('drops stopwords and single characters', () => {
    expect(contentWords('Do you encrypt data at rest?')).toEqual(['encrypt', 'data', 'rest']);
  });
});

describe('stem', () => {
  it('strips a plural s', () => {
    expect(stem('users')).toBe('user');
  });

  it('keeps words ending in ss and short words', () => {
    expect(stem('access')).toBe('access');
    expect(stem('sms')).toBe('sms');
  });

  it('strips past and progressive endings', () => {
    expect(stem('encrypted')).toBe('encrypt');
    expect(stem('scanned')).toBe('scan');
    expect(stem('hosting')).toBe('host');
    expect(stem('hosted')).toBe('host');
  });

  it('maps common variants of one word to the same stem', () => {
    expect(stem('release')).toBe(stem('released'));
    expect(stem('classify')).toBe(stem('classified'));
    expect(new Set([stem('handle'), stem('handled'), stem('handling')]).size).toBe(1);
    expect(stem('policy')).toBe(stem('policies'));
  });
});

describe('indexText', () => {
  it('joins topic and text', () => {
    expect(indexText('Encryption', 'We encrypt data.')).toBe('Encryption. We encrypt data.');
  });
});
