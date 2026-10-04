

export interface ImpactDto { from: string | null; to: string | null; metrics: { metric: string; value: string | null; unit: string }[]; weightCoverage: { known: string; total: string }; notes: string[] }
