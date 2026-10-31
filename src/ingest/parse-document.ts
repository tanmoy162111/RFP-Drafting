import type { AnswerType } from '../domain/types';

export type ParsedItem =
  | { kind: 'question'; ordinal: number; section: string; text: string; answerType: AnswerType }
  | { kind: 'unparsed'; ordinal: number; section: string; raw: string };

const YES_NO_OPENER = /^(do|does|did|is|are|was|were|can|could|will|would|have|has|should)\b/i;

export function inferAnswerType(text: string): AnswerType {
  return YES_NO_OPENER.test(text) && text.trimEnd().endsWith('?') ? 'yes_no' : 'narrative';
}

export function parseDocument(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  let section = 'General';
  let ordinal = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;

    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      section = heading[1]!.trim();
      continue;
    }

    ordinal += 1;
    const question = /^\d+\.\s+(.+)$/.exec(line);
    if (question) {
      const questionText = question[1]!.trim();
      items.push({ kind: 'question', ordinal, section, text: questionText, answerType: inferAnswerType(questionText) });
    } else {
      items.push({ kind: 'unparsed', ordinal, section, raw: line });
    }
  }
  return items;
}
