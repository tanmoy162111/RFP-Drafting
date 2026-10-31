export const STOPWORDS = new Set(
  (
    'a an the and or of to in on for with by at is are was were be been do does did you your we our it its ' +
    'that this these those what which how when where who whom if so as from any can will have has had about ' +
    'describe provide please list there their than then them into also not no yes'
  ).split(' '),
);

/** Lowercased alphanumeric tokens. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Tokens that carry meaning: no stopwords, no single characters. */
export function contentWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Light suffix stripping, enough to match "released" with "release" and "scanned" with "scan".
 * Not a full stemmer: it only needs to be consistent between questions and library text.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}i`;
  else if (w.length > 4 && w.endsWith('ied')) w = `${w.slice(0, -3)}i`;
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);

  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('y')) w = `${w.slice(0, -1)}i`;
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
  return w;
}

/** The text that is embedded and keyword-matched for a library entry. */
export function indexText(topic: string, text: string): string {
  return `${topic}. ${text}`;
}
