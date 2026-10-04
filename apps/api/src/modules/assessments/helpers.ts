import type { RubricDto } from '@valora/contracts';
import type { RubricRow } from './shared.js';

export function rubricDto(row: RubricRow): RubricDto {
  const questions = row.questionConfig as unknown as { questions: RubricDto['questions']; contextPrompt: string | null };
  const safety = row.safetyConfig as unknown as { safetyQuestions: RubricDto['safetyQuestions'] };
  return { id: row.id, rubricKey: row.rubricKey, ruleVersion: row.ruleVersion, policyVersion: row.policyVersion,
    recommendationVersion: row.recommendationVersion, effectiveAt: row.effectiveAt.toISOString(),
    questions: questions.questions, safetyQuestions: safety.safetyQuestions, contextPrompt: questions.contextPrompt };
}
