'use client';

import { useMe } from '@/lib/session';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { useState } from 'react';
import { Button } from "./primitives";
import { ActionFeedback } from './action-feedback';
import { ConfirmAction } from './confirm-dialog';

export function CriticalButton({ path, body, title, children, description, disabled, onDone, danger = false }: { path: string; body: unknown; title: string; children: React.ReactNode; description: string; disabled?: boolean; onDone?: (value: unknown) => void; danger?: boolean }) {
  const me = useMe(); const action = useCriticalAction(path, me.data?.id ?? ''); const [open, setOpen] = useState(false);
  return <><Button type="button" variant={danger ? 'danger' : 'secondary'} disabled={disabled || action.pending} onClick={() => setOpen(true)}>{children}</Button>{!open && <ActionFeedback action={action} onRecovered={() => { setOpen(false); onDone?.(true); }} />}{open && <ConfirmAction title={title} buttonLabel="Simpan tindakan" pending={action.pending} onClose={() => setOpen(false)} onConfirm={async () => { const result = await action.run(path, body); if (result) { setOpen(false); onDone?.(result); } }}><p>{description}</p><ActionFeedback action={action} onRecovered={() => { setOpen(false); onDone?.(true); }} /></ConfirmAction>}</>;
}
