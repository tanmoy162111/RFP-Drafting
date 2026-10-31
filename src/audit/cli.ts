import { createDb } from '../db/client';
import { appUrl } from '../db/urls';
import { EVAL_NOW } from '../eval/config';
import { renderAuditReport } from './report';
import { runAudit } from './run';

const { db, close } = createDb(appUrl(), 1);
try {
  const findings = await runAudit(db, EVAL_NOW);
  console.log(renderAuditReport(findings));
} finally {
  await close();
}
