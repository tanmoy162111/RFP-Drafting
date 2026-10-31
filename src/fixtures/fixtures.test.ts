import { describe, it, expect } from 'vitest';
import { extractFigures } from '../domain/figures';
import { detectInjection } from '../domain/injection';
import { isStale } from '../domain/staleness';
import { NOW } from '../domain/test-helpers';
import { chunkBody } from '../ingest/chunk';
import { extractFacts } from '../ingest/facts';
import { parseDocument } from '../ingest/parse-document';
import { HELD_OUT_DOCUMENTS, ANSWER_KEY } from './held-out';
import { LIBRARY_SOURCES } from './library';

const chunksOf = (slug: string) => chunkBody(LIBRARY_SOURCES.find((s) => s.slug === slug)!.body);
const allChunks = LIBRARY_SOURCES.flatMap((s) => chunkBody(s.body));

describe('library fixtures', () => {
  it('has 15 sources that chunk into 74 entries', () => {
    expect(LIBRARY_SOURCES).toHaveLength(15);
    expect(allChunks).toHaveLength(74);
  });

  it('seeds a SOC 2 conflict between two approved, fresh sources', () => {
    const dates = LIBRARY_SOURCES.filter((s) => s.status === 'approved' && !isStale(s.lastReviewedAt, NOW, 12))
      .flatMap((s) => chunkBody(s.body))
      .flatMap((c) => extractFacts(c.text))
      .filter((f) => f.key === 'soc2_report_date')
      .map((f) => f.value);
    expect(new Set(dates)).toEqual(new Set(['2025-03-31', '2024-03-31']));
  });

  it('seeds one deprecated source, one stale source and exactly one injected entry', () => {
    expect(LIBRARY_SOURCES.filter((s) => s.status === 'deprecated').map((s) => s.slug)).toEqual(['pricing-2023']);
    const stale = LIBRARY_SOURCES.filter((s) => s.status === 'approved' && isStale(s.lastReviewedAt, NOW, 12));
    expect(stale.map((s) => s.slug)).toEqual(['legacy-support-policy']);
    expect(chunksOf('proposal-initech-2025').some((c) => /ignore all previous instructions/i.test(c.text))).toBe(true);
    expect(allChunks.filter((c) => detectInjection(c.text))).toHaveLength(1);
  });

  it('seeds two single sign-on entries with different wording', () => {
    const sso = chunksOf('approved-answers').filter((c) => /single sign-on/i.test(c.text));
    expect(sso).toHaveLength(2);
    expect(sso[0]!.text).not.toBe(sso[1]!.text);
  });

  it('extracts no facts from the generated controls, so the only conflict stays the seeded one', () => {
    const generated = [
      'privacy-policy', 'operations-runbook', 'engineering-standards', 'approved-answers-product',
      'proposal-umbrella-2025', 'proposal-wayne-2025', 'approved-answers-service',
    ].flatMap(chunksOf);
    expect(generated).toHaveLength(52);
    expect(generated.flatMap((c) => extractFacts(c.text))).toEqual([]);
  });

  it('has no mention of the topics the unanswerable questions ask about', () => {
    const everything = LIBRARY_SOURCES.map((s) => s.body).join(' ').toLowerCase();
    for (const topic of ['on-premise', 'hipaa', 'perpetual', 'pci dss', 'government cloud', 'single-tenant', 'physical security']) {
      expect(everything, topic).not.toContain(topic);
    }
  });
});

describe('held-out fixtures and answer key', () => {
  const parsed = HELD_OUT_DOCUMENTS.map((d) => ({ doc: d, items: parseDocument(d.text) }));

  it('parses 25 RFP questions and 40 questionnaire rows, none unparsed', () => {
    expect(parsed.map((p) => p.items.length)).toEqual([25, 40]);
    expect(parsed.flatMap((p) => p.items).every((i) => i.kind === 'question')).toBe(true);
  });

  it('has exactly one answer key item per parsed question', () => {
    const ids = parsed.flatMap((p) => p.items.map((i) => `${p.doc.slug}:${i.ordinal}`));
    expect(ANSWER_KEY.map((k) => k.questionId).sort()).toEqual([...ids].sort());
  });

  it('marks the expected traps and unanswerable questions', () => {
    const traps = ANSWER_KEY.filter((k) => k.trap).map((k) => k.questionId).sort();
    expect(traps).toEqual(['fabrikam-questionnaire:10', 'fabrikam-rfp:2', 'fabrikam-rfp:9']);
    const unanswerable = ANSWER_KEY.filter((k) => !k.supported && !k.trap).map((k) => k.questionId).sort();
    expect(unanswerable).toEqual([
      'fabrikam-questionnaire:11',
      'fabrikam-questionnaire:38',
      'fabrikam-questionnaire:39',
      'fabrikam-questionnaire:40',
      'fabrikam-rfp:10',
      'fabrikam-rfp:24',
      'fabrikam-rfp:25',
    ]);
  });

  it('keeps every key fact inside its own submitted answer', () => {
    for (const item of ANSWER_KEY.filter((k) => k.submittedAnswer !== '')) {
      for (const fact of item.keyFacts) {
        expect(item.submittedAnswer.toLowerCase()).toContain(fact.toLowerCase());
      }
    }
  });

  it('only uses figures that exist in the library', () => {
    const library = LIBRARY_SOURCES.map((s) => s.body).join(' ');
    const known = extractFigures(library);
    for (const item of ANSWER_KEY) {
      for (const fig of extractFigures(item.submittedAnswer)) {
        expect(known.has(fig), `${item.questionId} uses figure ${fig}`).toBe(true);
      }
    }
  });
});
