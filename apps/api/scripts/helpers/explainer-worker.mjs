import { DatabaseService } from '../../dist/infrastructure/database.service.js';
import { AssessmentsService } from '../../dist/modules/assessments/service.js';
import { ExplainerService } from '../../dist/modules/assessments/explainer.service.js';
import { requestContext } from '../../dist/shared/request-context.js';
const db = new DatabaseService();
process.once('message', async ({ actor, id }) => {
  try {
    const service = new ExplainerService(new AssessmentsService(db), db);
    const result = await requestContext.run({ actor }, () => service.get(actor.id, id));
    process.send({ source: result.source, cached: result.cached });
  } catch (error) { process.send({ failure: error.code ?? 'WORKER_FAILED' }); }
  finally { await db.$disconnect(); process.disconnect(); }
});
