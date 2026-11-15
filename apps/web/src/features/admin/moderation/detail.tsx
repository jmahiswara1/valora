'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { ModerationDetailDto } from '@valora/contracts';

import { api } from '@/lib/api';
import { useMe } from '@/lib/session';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { PrivatePhoto } from '@/features/items/photo';
import { money } from '@/features/market/process-shared';

const queuePath = '/app/admin/moderasi';

const listingLabels = {
  RESELL: 'Jual',
  DONATE: 'Donasi',
  EXCHANGE: 'Tukar',
} as const;

const handoverLabels = {
  MEETUP: 'Bertemu langsung',
  DELIVERY: 'Pengiriman',
} as const;

const decisions = {
  APPROVE: {
    label: 'Setujui dan tayangkan di Market',
    button: 'Setujui dan tayangkan',
    code: 'APPROVED',
    placeholder: 'Jelaskan apa yang sudah kamu periksa.',
  },
  REQUEST_CHANGES: {
    label: 'Minta pemilik memperbaiki pengajuan',
    button: 'Kirim permintaan perbaikan',
    code: 'COPY_CORRECTION',
    placeholder:
      'Contoh: tambahkan foto bagian kaki kursi yang retak agar kondisinya terlihat jelas.',
  },
  REJECT: {
    label: 'Tolak pengajuan',
    button: 'Tolak pengajuan',
    code: 'REJECTED',
    placeholder: 'Jelaskan alasan pengajuan ini ditolak.',
  },
} as const;

type Decision = keyof typeof decisions;
type DecisionValue = Decision | '';

export function ModerationReviewPage({
  revisionId,
}: {
  revisionId: string;
}) {
  const router = useRouter();
  const cache = useQueryClient();
  const me = useMe();

  const action = useCriticalAction(
    `moderation:${revisionId}`,
    me.data?.id ?? '',
  );

  const detail = useQuery({
    queryKey: ['admin', 'listing-review', revisionId],
    queryFn: () =>
      api<ModerationDetailDto>(`/admin/listing-reviews/${revisionId}`),
    retry: false,
  });

  const [decision, setDecision] = useState<DecisionValue>('');
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [riskText, setRiskText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const busy = saving || action.pending;

  function chooseDecision(value: DecisionValue) {
    setDecision(value);
    setReasonCode(value ? decisions[value].code : '');
    setError('');
  }

  async function returnToQueue() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['admin', 'listing-reviews'] }),
      cache.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);

    router.push(queuePath);
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !detail.data || !decision) return;

    const cleanCode = reasonCode.trim();
    const cleanReason = reason.trim();

    if (cleanCode.length < 2 || cleanReason.length < 5) {
      setError('Isi kode alasan dan tulis alasan untuk pemilik minimal 5 karakter.');
      return;
    }

    const riskFlags = riskText
      .split(',')
      .map(flag => flag.trim())
      .filter(Boolean);

    if (
      riskFlags.length > 20 ||
      riskFlags.some(flag => flag.length < 2 || flag.length > 80)
    ) {
      setError('Gunakan maksimal 20 penanda risiko, masing-masing 2–80 karakter.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const result = await action.run(
        `/admin/listing-reviews/${revisionId}/decide`,
        {
          expectedVersion: detail.data.listingVersion,
          decision,
          reasonCode: cleanCode,
          reasonText: cleanReason,
          riskFlags,
        },
      );

      if (result) await returnToQueue();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Keputusan belum bisa dikonfirmasi.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (detail.isPending) {
    return <p role="status">Memuat pengajuan barang…</p>;
  }

  if (detail.isError || !detail.data) {
    return (
      <section className="app-panel">
        <Notice kind="error">
          Detail pengajuan belum bisa dimuat. Pengajuan mungkin sudah diproses.
        </Notice>

        <ActionFeedback
          action={action}
          onRecovered={() => void returnToQueue()}
        />

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void detail.refetch()}
          >
            Coba lagi
          </Button>

          <Link className="button button-secondary" href={queuePath}>
            Kembali ke antrean
          </Link>
        </div>
      </section>
    );
  }

  const row = detail.data;
  const revision = row.revision;

  return (
    <>
      <header className="app-heading">
        <div>
          <Link href={queuePath}>← Pengajuan barang</Link>
          <h1>{revision.title}</h1>
          <p>
            {listingLabels[row.listingType]} · {row.ownerName} · {row.cityName}
          </p>
        </div>

        <span className={row.specialReview ? 'badge badge-warn' : 'badge'}>
          {row.specialReview ? 'Pemeriksaan khusus' : 'Pemeriksaan awal'}
        </span>
      </header>

      <div className="moderation-layout">
        <section className="app-panel" aria-labelledby="item-detail-heading">
          <h2 id="item-detail-heading">Detail barang</h2>

          {revision.media.length > 0 ? (
            <div className="moderation-photo-grid">
              {revision.media.map((media, index) => (
                <PrivatePhoto
                  key={media.id}
                  mediaId={media.id}
                  alt={`Foto ${index + 1} dari ${revision.title}`}
                  className="moderation-photo"
                />
              ))}
            </div>
          ) : (
            <p>Pengajuan ini belum memiliki foto.</p>
          )}

          <p>{revision.description}</p>

          <dl className="detail-list">
            <div>
              <dt>Kondisi barang</dt>
              <dd>
                {revision.condition} · Skor {revision.score ?? 'belum tersedia'}
              </dd>
            </div>

            <div>
              <dt>Keterangan kondisi dari pemilik</dt>
              <dd>{revision.conditionDisclosure}</dd>
            </div>

            {row.listingType === 'RESELL' && (
              <div>
                <dt>Harga jual</dt>
                <dd>
                  {revision.askingPriceIdr == null
                    ? 'Belum dicantumkan'
                    : money(revision.askingPriceIdr)}
                </dd>
              </div>
            )}

            {row.listingType === 'DONATE' && (
              <div>
                <dt>Catatan untuk penerima donasi</dt>
                <dd>{revision.recipientNote || 'Tidak ada catatan tambahan.'}</dd>
              </div>
            )}

            {row.listingType === 'EXCHANGE' && (
              <div>
                <dt>Barang pengganti yang dicari</dt>
                <dd>{revision.exchangePreference || 'Belum dicantumkan.'}</dd>
              </div>
            )}

            <div>
              <dt>Kota dan cara serah terima</dt>
              <dd>
                {revision.city.name}
                {' · '}
                {revision.handoverMethods
                  .map(method => handoverLabels[method])
                  .join(', ')}
              </dd>
            </div>
          </dl>

          {row.riskFlags.length > 0 && (
            <div className="review-risk-flags">
              <strong>Penanda pemeriksaan</strong>
              {row.riskFlags.map(flag => (
                <span className="badge badge-warn" key={flag}>
                  {flag}
                </span>
              ))}
            </div>
          )}

          <details>
            <summary>Detail penilaian</summary>
            <p>Versi aturan: {revision.ruleVersion}</p>
            <p>ID penilaian: {revision.assessmentId}</p>
          </details>
        </section>

        <form
          className="app-panel form-stack"
          onSubmit={submitDecision}
          aria-busy={busy}
        >
          <div>
            <span className="eyebrow">REVISI {revision.revisionNo}</span>
            <h2>Hasil pemeriksaan</h2>
          </div>

          <Field label="Keputusan" htmlFor="review-decision">
            <Select
              id="review-decision"
              className="select"
              required
              value={decision}
              disabled={busy}
              onChange={event =>
                chooseDecision(event.target.value as DecisionValue)
              }
            >
              <option value="">Pilih hasil pemeriksaan</option>
              <option value="APPROVE">{decisions.APPROVE.label}</option>
              <option value="REQUEST_CHANGES">
                {decisions.REQUEST_CHANGES.label}
              </option>
              <option value="REJECT">{decisions.REJECT.label}</option>
            </Select>
          </Field>

          <Field
            label="Alasan untuk pemilik"
            htmlFor="review-reason"
            hint="Jelaskan kondisi yang kamu periksa atau bagian yang perlu diperbaiki."
          >
            <textarea
              id="review-reason"
              className="textarea"
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              disabled={busy}
              value={reason}
              placeholder={
                decision
                  ? decisions[decision].placeholder
                  : 'Tulis hasil pemeriksaan barang.'
              }
              onChange={event => setReason(event.target.value)}
            />
          </Field>

          <Field
            label="Kode alasan"
            htmlFor="review-code"
            hint="Kode terisi saat kamu memilih keputusan dan bisa disesuaikan."
          >
            <Input
              id="review-code"
              required
              minLength={2}
              maxLength={60}
              disabled={busy || !decision}
              value={reasonCode}
              onChange={event => setReasonCode(event.target.value)}
            />
          </Field>

          <Field
            label="Penanda risiko tambahan (opsional)"
            htmlFor="review-risks"
            hint="Pisahkan beberapa penanda dengan koma."
          >
            <Input
              id="review-risks"
              disabled={busy}
              value={riskText}
              onChange={event => setRiskText(event.target.value)}
            />
          </Field>

          {error && <Notice kind="error">{error}</Notice>}

          <ActionFeedback
            action={action}
            onRecovered={() => void returnToQueue()}
          />

          <Button type="submit" disabled={busy || !decision}>
            {busy
              ? 'Menyimpan keputusan…'
              : decision
                ? decisions[decision].button
                : 'Pilih keputusan dahulu'}
          </Button>
        </form>
      </div>
    </>
  );
}