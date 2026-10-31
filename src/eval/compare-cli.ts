import { readFileSync } from 'node:fs';
import { compareResults } from './compare';
import type { EvalResult } from './run';

const [pathA, pathB] = process.argv.slice(2);
if (!pathA || !pathB) {
  console.error('usage: pnpm eval:compare <results-a.json> <results-b.json>');
  process.exit(2);
}
const load = (path: string): EvalResult => JSON.parse(readFileSync(path, 'utf8')) as EvalResult;
console.log(compareResults(load(pathA), load(pathB)));
