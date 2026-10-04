'use client';

import { useId, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { ClipboardCheck, Wrench, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const cards = [
  { id: 'profile', title: 'Profil barang' },
  { id: 'condition', title: 'Kondisi & perawatan' },
  { id: 'journey', title: 'Cerita berikutnya' },
] as const;

export function PassportStack() {
  const instanceId = useId();
  const [selected, setSelected] = useState(0);

  return <div className="passport-stack">
    <div className="passport-stack-stage" role="group" aria-label="Tiga bagian Passport barang">
      {cards.map((card, index) => {
        const layer = (index - selected + cards.length) % cards.length;
        const scale = 1 - layer * 0.06;
        const active = index === selected;
        const buttonId = `${instanceId}-${card.id}-button`;
        const panelId = `${instanceId}-${card.id}-panel`;
        const style = {
          '--stack-shift': `${layer * -44}px`,
          '--stack-scale': scale,
          '--stack-tab-height': `${44 / scale}px`,
          zIndex: cards.length - layer,
        } as CSSProperties;

        return <div key={card.id} className="passport-stack-card" data-layer={layer} style={style}>
          <button id={buttonId} className="passport-stack-trigger" type="button" aria-pressed={active} aria-controls={panelId} onClick={() => setSelected(index)}>
            <span>{card.title}</span><span className="passport-stack-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          </button>
          <section id={panelId} className={`passport-stack-content passport-stack-${card.id}`} aria-labelledby={buttonId} hidden={!active}>
            {card.id === 'profile' && <>
              <Image src="/images/editorial/care-chair.png" width={1260} height={1260} sizes="(max-width: 1023px) 240px, calc(27.5vw - 47px)" alt="Ilustrasi kursi kayu dengan dudukan anyaman" />
              <div className="passport-stack-identity"><strong>Kursi kayu</strong><span>Rumah &amp; furnitur</span><span className="passport-stack-year">2026<small>Tahun pencatatan</small></span><p>Foto, identitas, dan kategori dalam satu Passport.</p></div>
            </>}
            {card.id === 'condition' && <div className="passport-stack-details">
              <p>Kenali kondisinya.<br />Simpan setiap perawatannya.</p>
              <dl>
                <div><ClipboardCheck size={20} strokeWidth={1.5} aria-hidden="true" /><div><dt>Penilaian kondisi</dt><dd>Belum dinilai</dd></div></div>
                <div><Wrench size={20} strokeWidth={1.5} aria-hidden="true" /><div><dt>Riwayat perawatan</dt><dd>Belum ada catatan</dd></div></div>
              </dl>
              <Link className="passport-stack-link" href="/cara-kerja#penilaian">Kenali penilaian <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>}
            {card.id === 'journey' && <div className="passport-stack-details">
              <p>Masih bernilai.<br />Pilih cerita berikutnya.</p>
              <ul className="passport-stack-options" aria-label="Pilihan perjalanan barang"><li>Rawat</li><li>Jual</li><li>Tukar</li><li>Donasikan</li></ul>
              <span className="passport-stack-status">Langkah berikutnya belum dipilih.</span>
              <Link className="passport-stack-link" href="/cara-kerja">Pelajari pilihanmu <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>}
          </section>
        </div>;
      })}
    </div>
    <p className="passport-stack-note">Ilustrasi Passport. Pilih kartu untuk melihat isinya.</p>
  </div>;
}
