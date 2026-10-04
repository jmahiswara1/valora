'use client';

import { Select } from '@/components/ui/select';

import { Field } from "../../components/ui/primitives";

export function PeriodPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <Field label="Periode laporan (Asia/Jakarta)" htmlFor="impact-period"><Select className="select" id="impact-period" value={value} onChange={(e) => onChange(e.target.value)}><option value="30">30 hari</option><option value="90">90 hari</option><option value="all">Seluruh waktu</option></Select></Field>; }
