import { mkdirSync, writeFileSync } from 'node:fs';
import { createDb } from '../db/client';
import { resetTables } from '../db/reset';
import { appUrl } from '../db/urls';
import { MockDraftProvider } from '../drafting/mock-provider';
import { createGatewayProvider } from '../drafting/gateway-provider';
import { loadFixtures } from '../fixtures/load';
import { EVAL_NOW } from './config';
import { renderEvalReport } from './report';
import { allGatesPass, runEval } from './run';

const live = process.argv.includes('--live');

if (live && !process.env.AI_GATEWAY_API_KEY) {
  console.error('eval:live needs AI_GATEWAY_API_KEY. Put it in .env.local (never commit it) and retry.');
  process.exit(2);
}

const provider = live ? createGatewayProvider() : new MockDraftProvider();
const { db, client, close } = createDb(appUrl(), 1);
let passed = true;
try {
  console.log(`Resetting the dev database and loading mock fixtures, then drafting with ${provider.name}...`);
  await resetTables(client);
  await loadFixtures(db);
  const result = await runEval(db, provider, EVAL_NOW);

  mkdirSync('eval', { recursive: true });
  writeFileSync('eval/report.md', renderEvalReport(result));
  writeFileSync('eval/results.json', `${JSON.stringify(result, null, 2)}\n`);

  for (const gate of result.gates) console.log(`${gate.pass ? 'PASS' : 'FAIL'}  ${gate.name}: ${gate.actual} (${gate.required})`);
  console.log(`drafted ${result.metrics.drafted}, accepted ${(result.metrics.acceptedRate * 100).toFixed(1)}%, report in eval/report.md`);
  passed = allGatesPass(result);
} finally {
  await close();
}
// The mock run is a CI gate. The live run only reports.
process.exit(live || passed ? 0 : 1);
