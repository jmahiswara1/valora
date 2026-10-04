import type { ActionRecommendation, AssessmentCreateInput, IndicatorKey, RubricDto } from '@valora/contracts';

export interface Evaluation {
  status: 'INCOMPLETE' | 'PARTIAL_ECONOMIC' | 'COMPLETE';
  condition: number | null;
  repairability: number | null;
  repairabilityReason: 'NOT_NEEDED' | null;
  economicValue: number | null;
  reusePotential: number | null;
  score: number | null;
  label: string | null;
  missingFields: string[];
  safetyFlags: string[];
  recommendations: ActionRecommendation[];
}

const levelValue = { LEVEL_0: 0, LEVEL_25: 25, LEVEL_50: 50, LEVEL_75: 75, LEVEL_100: 100 } as const;
const actionOrder = ['REPAIR', 'RESELL', 'EXCHANGE', 'DONATE'] as const;
const statusOrder = { ELIGIBLE: 0, NEEDS_DATA: 1, INELIGIBLE: 2 } as const;
const roundedAverage = (values: number[]) => Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length + 0.5);

function component(input: AssessmentCreateInput, keys: IndicatorKey[], missing: string[]): number | null {
  const values = keys.map((key) => input.answers[key]);
  for (let index = 0; index < keys.length; index++) if (!values[index]) missing.push(keys[index]);
  return values.every(Boolean) ? roundedAverage(values.map((value) => levelValue[value!])) : null;
}

export function economicComponent(resale: number, repairCost: number, replacement: number): number {
  if (replacement <= 0 || resale < 0 || repairCost < 0) throw new Error('Economic amounts must be valid nonnegative rupiah and replacement must be positive');
  const net = BigInt(Math.max(0, resale - repairCost));
  const reference = BigInt(replacement);
  if (net === 0n) return 0;
  if (net * 10n <= reference) return 25;
  if (net * 10n <= reference * 3n) return 50;
  if (net * 5n <= reference * 3n) return 75;
  return 100;
}

export function evaluateAssessment(input: AssessmentCreateInput, rubric: RubricDto): Evaluation {
  const missingFields: string[] = [];
  const condition = component(input, ['function', 'physical', 'completeness'], missingFields);
  const reusePotential = component(input, ['reuse'], missingFields);
  let repairability: number | null = null;
  if (input.repairNeeded === null) missingFields.push('repairNeeded');
  else if (!input.repairNeeded) repairability = 100;
  else repairability = component(input, ['repairMethod', 'repairSupport'], missingFields);
  if (input.hasIssue === null) missingFields.push('hasIssue');
  if (rubric.contextPrompt && !input.contextAnswer?.trim()) missingFields.push('contextAnswer');

  const safetyFlags: string[] = [];
  for (const question of rubric.safetyQuestions) {
    const answer = input.safetyAnswers[question.code];
    if (!answer || answer === 'TIDAK_TAHU') missingFields.push(`safety:${question.code}`);
    else if (answer === 'YA') safetyFlags.push(`${question.effectOnYes}:${question.code}`);
  }

  const economic = input.economic;
  const economicMissing = ['estimatedResaleValue', 'estimatedRepairCost', 'comparableReplacementPrice'].filter((key) => !economic[key as keyof typeof economic]);
  let economicValue: number | null = null;
  if (!economicMissing.length) {
    economicValue = economicComponent(economic.estimatedResaleValue!.amountIdr, economic.estimatedRepairCost!.amountIdr, economic.comparableReplacementPrice!.amountIdr);
  }
  const status = missingFields.length ? 'INCOMPLETE' : economicMissing.length ? 'PARTIAL_ECONOMIC' : 'COMPLETE';
  const score = status === 'COMPLETE' ? Math.floor((condition! * 30 + repairability! * 25 + economicValue! * 25 + reusePotential! * 20) / 100 + 0.5) : null;
  const label = score === null ? null : score < 40 ? 'Low' : score < 70 ? 'Moderate' : 'High Circular Potential';
  const prohibited = safetyFlags.some((flag) => flag.startsWith('PROHIBITED:'));

  const recommendations: ActionRecommendation[] = actionOrder.map((action): ActionRecommendation => {
    if (prohibited) return { action, status: 'INELIGIBLE', reasons: safetyFlags.filter((flag) => flag.startsWith('PROHIBITED:')) };
    if (missingFields.length) return { action, status: 'NEEDS_DATA', reasons: missingFields };
    if (action === 'REPAIR') {
      if (!input.hasIssue) return { action, status: 'INELIGIBLE', reasons: ['NO_REPORTED_ISSUE'] };
      if (!input.repairNeeded) return { action, status: 'INELIGIBLE', reasons: ['NO_REPAIR_NEEDED'] };
      return repairability! >= 50 ? { action, status: 'ELIGIBLE', reasons: ['REPAIR_POSSIBLE'] } : { action, status: 'INELIGIBLE', reasons: ['REPAIRABILITY_BELOW_50'] };
    }
    if (action === 'RESELL') {
      if (economicMissing.length) return { action, status: 'NEEDS_DATA', reasons: economicMissing };
      const reasons = [...(condition! < 50 ? ['CONDITION_BELOW_50'] : []), ...(economicValue! < 50 ? ['ECONOMIC_BELOW_50'] : [])];
      return { action, status: reasons.length ? 'INELIGIBLE' : 'ELIGIBLE', reasons: reasons.length ? reasons : ['THRESHOLD_MET'] };
    }
    return reusePotential! >= 50 ? { action, status: 'ELIGIBLE', reasons: ['REUSE_POTENTIAL_MET'] } : { action, status: 'INELIGIBLE', reasons: ['REUSE_BELOW_50'] };
  }).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || actionOrder.indexOf(a.action) - actionOrder.indexOf(b.action));

  return { status, condition, repairability, repairabilityReason: input.repairNeeded === false ? 'NOT_NEEDED' : null, economicValue, reusePotential, score, label, missingFields: [...missingFields, ...economicMissing], safetyFlags, recommendations };
}
