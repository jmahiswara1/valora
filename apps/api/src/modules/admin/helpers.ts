import type { RubricDto, AssessmentCreateInput } from '@valora/contracts';
import { evaluateAssessment, economicComponent } from '../assessments/engine.js';
import { rubricSeeds } from '../assessments/data.js';

export function rubricFixtures(rubric: RubricDto) {
  const codes = ['LEVEL_0', 'LEVEL_25', 'LEVEL_50', 'LEVEL_75', 'LEVEL_100']; const values = [0, 25, 50, 75, 100];
  const keys = ['function', 'physical', 'completeness', 'repairMethod', 'repairSupport', 'reuse'];
  const shape = rubric.questions.length === 6 && keys.every((key) => rubric.questions.filter((q) => q.key === key).length === 1) && rubric.questions.every((q) => q.choices.length === 5 && codes.every((code, index) => q.choices.filter((c) => c.code === code && c.value === values[index]).length === 1)) && new Set(rubric.safetyQuestions.map((q) => q.code)).size === rubric.safetyQuestions.length;
  const source = (amountIdr: number) => ({ amountIdr, sourceType: 'USER_ESTIMATE' as const, sourceNote: 'Fixture publication gate', referenceDate: '2026-10-02' });
  const input: AssessmentCreateInput = { expectedItemRevision: 1, rubricVersionId: rubric.id, contextAnswer: 'Konteks fixture lengkap', hasIssue: true, repairNeeded: true, answers: { function: 'LEVEL_75', physical: 'LEVEL_50', completeness: 'LEVEL_100', repairMethod: 'LEVEL_50', repairSupport: 'LEVEL_75', reuse: 'LEVEL_75' }, safetyAnswers: Object.fromEntries(rubric.safetyQuestions.map((q) => [q.code, 'TIDAK'])), economic: { estimatedResaleValue: source(450000), estimatedRepairCost: source(50000), comparableReplacementPrice: source(800000) } };
  const complete = evaluateAssessment(input, rubric); const partial = evaluateAssessment({ ...input, economic: {} }, rubric);
  const incomplete = evaluateAssessment({ ...input, safetyAnswers: {} }, rubric);
  const baseline = rubricSeeds.find((r) => r.rubricKey === rubric.rubricKey);
  const severity = { DISCLOSE: 0, SPECIAL_REVIEW: 1, PROHIBITED: 2 };
  const protections = Boolean(baseline) && baseline!.safetyQuestions.every((q) => rubric.safetyQuestions.some((candidate) => candidate.code === q.code && severity[candidate.effectOnYes] >= severity[q.effectOnYes]));
  const safety = protections && rubric.safetyQuestions.every((q) => { const result = evaluateAssessment({ ...input, safetyAnswers: { ...input.safetyAnswers, [q.code]: 'YA' } }, rubric); return result.safetyFlags.includes(q.effectOnYes + ':' + q.code) && (q.effectOnYes !== 'PROHIBITED' || result.recommendations.every((r) => r.status === 'INELIGIBLE')); });
  const economic = [[0, 0], [100, 25], [101, 50], [300, 50], [301, 75], [600, 75], [601, 100]].every(([amount, expected]) => economicComponent(amount, 0, 1000) === expected);
  const tests = [{ name: 'fixed-score-v1-structure', passed: shape }, { name: 'complete', passed: complete.status === 'COMPLETE' && complete.score === 72 }, { name: 'partial', passed: partial.status === 'PARTIAL_ECONOMIC' && partial.score === null && partial.label === null }, { name: 'unknown-safety', passed: incomplete.status === 'INCOMPLETE' && incomplete.score === null }, { name: 'safety-policies', passed: safety }, { name: 'economic-boundaries', passed: economic }, { name: 'rounding', passed: complete.repairability === 63 && complete.condition === 75 }];
  return { passed: tests.every((t) => t.passed), tests };
}
