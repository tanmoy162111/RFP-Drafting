import { describe, it, expect } from 'vitest';
import { routeQuestion } from './routing';
import { makeEvidence, NOW } from './test-helpers';

describe('routeQuestion', () => {
  it('routes to a human with no_evidence when nothing was retrieved', () => {
    expect(routeQuestion([], NOW)).toEqual({ status: 'needs_human', reason: 'no_evidence' });
  });

  it('routes no_evidence when every hit is below the score floor', () => {
    const result = routeQuestion([makeEvidence({ score: 0.1 })], NOW);
    expect(result).toEqual({ status: 'needs_human', reason: 'no_evidence' });
  });

  it('routes no_evidence when the only source is an unapproved draft', () => {
    const result = routeQuestion([makeEvidence({ sourceStatus: 'draft' })], NOW);
    expect(result).toEqual({ status: 'needs_human', reason: 'no_evidence' });
  });

  it('routes stale when the only good hit is from a deprecated source', () => {
    const result = routeQuestion([makeEvidence({ sourceStatus: 'deprecated' })], NOW);
    expect(result).toEqual({ status: 'needs_human', reason: 'stale' });
  });

  it('routes conflict, naming the conflicting entries', () => {
    const a = makeEvidence({ entryId: 'e1', facts: [{ key: 'soc2_report_date', value: '2025-03-31' }] });
    const b = makeEvidence({ entryId: 'e2', facts: [{ key: 'soc2_report_date', value: '2024-03-31' }] });
    const result = routeQuestion([a, b], NOW);
    expect(result.status).toBe('needs_human');
    if (result.status === 'needs_human') {
      expect(result.reason).toBe('conflict');
      expect(result.conflicts?.[0]?.key).toBe('soc2_report_date');
    }
  });

  it('routes stale when all approved evidence is past the staleness window', () => {
    const result = routeQuestion([makeEvidence({ lastReviewedAt: '2024-01-01' })], NOW);
    expect(result).toEqual({ status: 'needs_human', reason: 'stale' });
  });

  it('drafts from the fresh entry and ignores a stale one that does not conflict', () => {
    const fresh = makeEvidence({ entryId: 'fresh', lastReviewedAt: '2026-08-01', score: 0.7 });
    const stale = makeEvidence({ entryId: 'old', lastReviewedAt: '2023-01-01', score: 0.9 });
    const result = routeQuestion([stale, fresh], NOW);
    expect(result.status).toBe('draftable');
    if (result.status === 'draftable') {
      expect(result.evidence.map((e) => e.entryId)).toEqual(['fresh']);
    }
  });

  it('is draftable with evidence sorted best score first', () => {
    const lo = makeEvidence({ entryId: 'lo', score: 0.5 });
    const hi = makeEvidence({ entryId: 'hi', score: 0.95 });
    const result = routeQuestion([lo, hi], NOW);
    expect(result.status).toBe('draftable');
    if (result.status === 'draftable') {
      expect(result.evidence.map((e) => e.entryId)).toEqual(['hi', 'lo']);
    }
  });
});
