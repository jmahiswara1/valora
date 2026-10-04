'use client';

import type { CityDto } from '@valora/contracts';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Field, Input } from "./primitives";

export function CityPicker({ value, onChange, initial, error, required }: { value: string; onChange: (city: CityDto) => void; initial?: CityDto; error?: string; required?: boolean }) {
  const [query, setQuery] = useState(initial ? `${initial.name}, ${initial.provinceName}` : '');
  const [options, setOptions] = useState<CityDto[]>([]);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => { api<CityDto[]>(`/cities?q=${encodeURIComponent(query.trim())}`).then((data) => { if (active) setOptions(data); }).catch(() => { if (active) setOptions([]); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, open]);
  const expanded = open && query.trim().length >= 2;
  return <div className="city-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <Field label="Kabupaten/kota" htmlFor="city" error={error} hint="Ketik minimal dua huruf untuk mencari kota.">
      <Input ref={input} id="city" value={query} required={required} autoComplete="off" role="combobox" aria-expanded={expanded} aria-controls={expanded ? 'city-options' : undefined} aria-autocomplete="list" aria-invalid={error ? true : undefined} aria-describedby={error ? 'city-hint city-error' : 'city-hint'} onChange={(e) => { setQuery(e.target.value); setOptions([]); setOpen(true); onChange({ id: '', code: '', name: '', provinceName: '' }); }} onFocus={() => setOpen(true)} onKeyDown={(event) => {
        if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); }
        if (event.key === 'ArrowDown' && options.length) {
          event.preventDefault(); setOpen(true);
          requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('button')?.focus());
        }
      }} placeholder="Cari kabupaten/kota" />
    </Field>
    {expanded && <div ref={list} className="city-options" id="city-options" role="listbox" aria-label="Pilihan kabupaten/kota" onKeyDown={(event) => {
      if (event.key === 'Escape') { input.current?.focus(); setOpen(false); event.stopPropagation(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
      {options.length ? options.map((city) => <button type="button" role="option" aria-selected={city.id === value} key={city.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(city); setQuery(`${city.name}, ${city.provinceName}`); input.current?.focus(); setOpen(false); }}>{city.name}<span>{city.provinceName}</span></button>) : <div style={{ padding: 12 }} className="muted">Tidak ada kota yang cocok.</div>}
    </div>}
  </div>;
}
