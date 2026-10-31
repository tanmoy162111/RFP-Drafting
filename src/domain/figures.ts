const FIGURE = /\d+(?:[.,/-]\d+)*/g;

/** Numbers and dates in text, as a set of tokens. Dates must be ISO (YYYY-MM-DD) to match as one token. */
export function extractFigures(text: string): Set<string> {
  return new Set(text.match(FIGURE) ?? []);
}
