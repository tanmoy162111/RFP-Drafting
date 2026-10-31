export interface Chunk {
  topic: string;
  text: string;
}

const MAX_CHARS = 800;

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const candidate = current === '' ? sentence : `${current} ${sentence}`;
    if (candidate.length > max && current !== '') {
      pieces.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current !== '') pieces.push(current);
  return pieces;
}

export function chunkBody(body: string, maxChars: number = MAX_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    if (lines[0] === undefined || lines[0] === '') continue;

    let topic = 'general';
    let rest = lines;
    const heading = /^##\s+(.+)$/.exec(lines[0]);
    if (heading) {
      topic = heading[1]!.trim();
      rest = lines.slice(1);
    }

    const text = rest.join(' ').replace(/\s+/g, ' ').trim();
    if (text === '') continue;
    for (const piece of splitLong(text, maxChars)) chunks.push({ topic, text: piece });
  }
  return chunks;
}
