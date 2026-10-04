import { describe, expect, it } from 'vitest';
import type { AssessmentCreateInput, RubricDto } from '@valora/contracts';
import { economicComponent, evaluateAssessment } from './engine.js';
import { rubricSeeds } from './data.js';

const seed = rubricSeeds[0];
const rubric: RubricDto = { id: '00000000-0000-4000-8000-000000000001', rubricKey: seed.rubricKey, ruleVersion: seed.ruleVersion,
  policyVersion: seed.policyVersion, recommendationVersion: seed.recommendationVersion, effectiveAt: '2026-09-28T00:00:00.000Z',
  questions: seed.questions, safetyQuestions: seed.safetyQuestions, contextPrompt: seed.contextPrompt };
const source = (amountIdr: number) => ({ amountIdr, sourceType: 'USER_ESTIMATE' as const, sourceNote: 'Perkiraan pemilik berdasarkan kondisi barang', referenceDate: '2026-09-28' });
const complete = (): AssessmentCreateInput => ({ expectedItemRevision: 1, rubricVersionId: rubric.id, contextAnswer: 'Keyboard listrik tanpa baterai',
  hasIssue: true, repairNeeded: true,
  answers: { function: 'LEVEL_75', physical: 'LEVEL_50', completeness: 'LEVEL_100', repairMethod: 'LEVEL_50', repairSupport: 'LEVEL_75', reuse: 'LEVEL_75' },
  safetyAnswers: Object.fromEntries(rubric.safetyQuestions.map(({ code }) => [code, 'TIDAK'])),
  economic: { estimatedResaleValue: source(450_000), estimatedRepairCost: source(50_000), comparableReplacementPrice: source(800_000) },
});

describe('score-v1', () => {
  it('menghasilkan contoh keyboard 72 dari komponen yang dibulatkan', () => {
    const result = evaluateAssessment(complete(), rubric);
    expect(result).toMatchObject({ status: 'COMPLETE', condition: 75, repairability: 63, economicValue: 75, reusePotential: 75, score: 72, label: 'High Circular Potential' });
  });
  it('memakai batas rasio rupiah secara persis', () => {
    for (const [resale, expected] of [[0, 0], [100, 25], [101, 50], [300, 50], [301, 75], [600, 75], [601, 100]]) expect(economicComponent(resale, 0, 1000)).toBe(expected);
    expect(economicComponent(100, 200, 1000)).toBe(0);
  });
  it('menyimpan tiga komponen tanpa Score bila ekonomi belum tersedia', () => {
    const input = complete(); input.economic = {};
    const result = evaluateAssessment(input, rubric);
    expect(result).toMatchObject({ status: 'PARTIAL_ECONOMIC', score: null, label: null, condition: 75, repairability: 63, reusePotential: 75 });
    expect(result.recommendations.find(({ action }) => action === 'RESELL')?.status).toBe('NEEDS_DATA');
    expect(result.recommendations.find(({ action }) => action === 'DONATE')?.status).toBe('ELIGIBLE');
  });
  it('menahan deklarasi keselamatan tidak tahu tanpa menyatakan aman', () => {
    const input = complete(); input.safetyAnswers.battery_or_wire = 'TIDAK_TAHU';
    const result = evaluateAssessment(input, rubric);
    expect(result.status).toBe('INCOMPLETE'); expect(result.score).toBeNull();
    expect(result.missingFields).toContain('safety:battery_or_wire');
  });
  it('memblokir transfer terlarang walau Score tinggi', () => {
    const input = complete(); input.safetyAnswers.battery_or_wire = 'YA';
    const result = evaluateAssessment(input, rubric);
    expect(result.status).toBe('COMPLETE'); expect(result.score).toBe(72);
    expect(result.recommendations.every(({ status }) => status === 'INELIGIBLE')).toBe(true);
  });
  it('memberi Repairability 100 bila perbaikan tidak diperlukan', () => {
    const input = complete(); input.repairNeeded = false; delete input.answers.repairMethod; delete input.answers.repairSupport;
    input.economic.estimatedRepairCost = source(0);
    const result = evaluateAssessment(input, rubric);
    expect(result.repairability).toBe(100);
    expect(result.repairabilityReason).toBe('NOT_NEEDED');
    expect(result.recommendations.find(({ action }) => action === 'REPAIR')?.status).toBe('INELIGIBLE');
  });
});
