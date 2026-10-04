'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExplanationDto } from '@valora/contracts';
import { Button } from "../../components/ui/primitives";
import { LoadState } from '../../components/ui/query-state';

export function AssessmentExplanation({ id }: { id: string }) {
  const [started, setStarted] = useState(false);
  const result = useQuery({ queryKey: ['explanation', id], enabled: started, queryFn: () => api<ExplanationDto>(`/assessments/${id}/explain`, { method: 'POST' }), retry: false });
  return <section className="assessment-section"><h3>Memahami hasil penilaian</h3><p>Penjelasan mengikuti hasil dan rubrik yang tersimpan.</p>{!started && <Button variant="secondary" onClick={() => setStarted(true)}>Jelaskan hasil penilaian</Button>}{started && <LoadState query={result} />}{result.data && <div className="form-stack"><p>{result.data.summary}</p>{result.data.strengths.length > 0 && <div><h4>Komponen yang mendukung</h4><ul>{result.data.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}<div><h4>Batas dan langkah berikutnya</h4><ul>{[...result.data.limitations, ...result.data.nextSteps].map((s) => <li key={s}>{s}</li>)}</ul></div><small className="muted">Penjelasan berbasis template · {result.data.templateVersion}</small></div>}</section>;
}
