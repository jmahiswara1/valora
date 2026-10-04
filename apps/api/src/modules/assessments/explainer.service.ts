import { Injectable } from '@nestjs/common';
import { AssessmentsService } from "./service.js";
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AssessmentDto, explanationSchema } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { json } from '../../shared/transactions.js';
import { type ExplanationProvider, templateExplanation, templateVersion } from './explanation.js';

@Injectable()
export class ExplainerService implements ExplanationProvider {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly assessments: AssessmentsService, private readonly db: DatabaseService) {}
  async explain(assessment: AssessmentDto) { return templateExplanation(assessment); }
  async get(actorId: string, id: string) {
    // Authorization is checked even when a cached result exists.
    const assessment = await this.assessments.get(actorId, id);
    const now = Date.now(); const previous = this.attempts.get(actorId); const window = previous && previous.until > now ? previous : { count: 0, until: now + 60000 };
    if (++window.count > 10) throw new AppException(429, 'RATE_LIMITED', 'Maksimal sepuluh penjelasan per menit.'); this.attempts.set(actorId, window);
    for (const [user, attempt] of this.attempts) if (attempt.until < now) this.attempts.delete(user);
    const row = await this.db.assessment.findUniqueOrThrow({ where: { id } });
    const key = [id, row.version, templateVersion, assessment.answers ? 'CREATOR' : 'OWNER', assessment.isCurrent ? 'CURRENT' : 'HISTORICAL'].join(':');
    const cached = await this.db.explanationCache.findUnique({ where: { key } });
    if (cached) return explanationSchema.parse(cached.output);
    const result = await this.explain(assessment);
    await this.db.explanationCache.upsert({ where: { key }, update: {}, create: { key, assessmentId: id, templateVersion, output: json(result) } });
    return result;
  }
}
