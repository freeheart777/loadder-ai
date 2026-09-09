import { db } from '../../server/db/workspace-database.mjs';
import { seedGrowthLoopFixture } from '../../server/test-helpers/growth-loop-fixture.mjs';

const args = process.argv.slice(2);
if (args[0] === 'inspect') {
  const [, workspaceId, candidateId, leadId] = args;
  const events = db.prepare("SELECT count(*) n FROM business_events WHERE workspace_id=? AND subject_type='lead' AND subject_id=? AND event_type='lead.converted'").get(workspaceId, leadId).n;
  const evidence = db.prepare("SELECT count(*) n FROM growth_evidence_links WHERE workspace_id=? AND subject_type='CONTENT_CANDIDATE' AND subject_id=? AND evidence_kind='CRM_CONVERSION'").get(workspaceId, candidateId).n;
  const financial = db.prepare('SELECT count(*) n FROM ecommerce_financial_ledger WHERE workspace_id=?').get(workspaceId).n;
  console.log(JSON.stringify({ events, evidence, financial })); process.exit(0);
}
const mode = args[0] === 'reuse' ? 'reuse-or-create' : 'create';
const [workspaceId, userId, membershipId] = mode === 'reuse-or-create' ? args.slice(1) : args;
if (!workspaceId || !userId || !membershipId) throw Error('workspace, user and membership are required');

const result = await seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode });
console.log(JSON.stringify(result));
