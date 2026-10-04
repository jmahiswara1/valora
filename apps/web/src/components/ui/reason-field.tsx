'use client';

import { Field } from "./primitives";

export function ReasonField({ value, onChange, id = 'operation-reason' }: { value: string; onChange: (value: string) => void; id?: string }) { return <Field label="Alasan tindakan" htmlFor={id} hint="Sebutkan fakta dan konteks yang ditinjau."><textarea className="textarea" id={id} required minLength={5} maxLength={1000} value={value} onChange={(e) => onChange(e.target.value)} /></Field>; }
