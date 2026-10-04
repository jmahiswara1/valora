'use client';

import { useState } from 'react';
import { Notice, Button } from "./primitives";
import { useCriticalAction } from '../../hooks/use-critical-action';
import { ConfirmAction } from './confirm-dialog';

export function ActionFeedback({ action, onRecovered }: { action: ReturnType<typeof useCriticalAction>; onRecovered?: () => void }) {
  const [closing, setClosing] = useState(false);
  return <><div role="status" aria-live="polite">{action.notice}</div>{action.error && <Notice kind="error">{action.error}</Notice>}{action.error && <Button type="button" variant="secondary" disabled={action.pending} onClick={async () => { const result = await action.retry(); if (result) onRecovered?.(); }}>Periksa ulang tindakan</Button>}{action.notFound && <Button type="button" variant="quiet" onClick={() => setClosing(true)}>Saya sudah memeriksa status</Button>}{closing && <ConfirmAction title="Tutup pemeriksaan tindakan" buttonLabel="Tutup pemeriksaan" pending={false} onClose={() => setClosing(false)} onConfirm={async () => { action.forget(); setClosing(false); }}><p>Hasil sebelumnya belum terkonfirmasi. Pastikan status resource sudah diperiksa. Langkah ini menghapus metadata pemulihan; tindakan tidak dikirim ulang.</p></ConfirmAction>}</>;
}
