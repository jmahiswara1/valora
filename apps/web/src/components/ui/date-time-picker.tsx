'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './select';

const pad = (value: number) => String(value).padStart(2, '0');
const date = (day: string) => new Date(day + 'T12:00:00Z');
const dayString = (value: Date) => value.toISOString().slice(0, 10);
const shiftDay = (day: string, offset: number) => { const next = date(day); next.setUTCDate(next.getUTCDate() + offset); return dayString(next); };
const shiftMonth = (month: string, offset: number) => { const next = date(month + '-01'); next.setUTCMonth(next.getUTCMonth() + offset); return dayString(next).slice(0, 7); };
const format = (value: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} ${value.slice(11, 16)}` : '';
function parse(value: string): string | null {
  const localized = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value);
  const iso = localized ? `${localized[3]}-${localized[2]}-${localized[1]}T${localized[4]}:${localized[5]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return null;
  const parsed = new Date(iso + ':00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 16) === iso ? iso : null;
}
const fullDate = (day: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date(day));
const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

type Props = { id: string; value: string; onChange: (value: string) => void; min: string; max: string; today: string; zoneLabel: string; disabled?: boolean; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: boolean };

export function DateTimePicker({ id, value, onChange, min, max, today, zoneLabel, disabled, required, ...aria }: Props) {
  const input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null), popup = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState({ text: format(value), value });
  const text = draft.text;
  const [open, setOpen] = useState(false), [invalid, setInvalid] = useState(false), [portal, setPortal] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState((value || min).slice(0, 10)), [month, setMonth] = useState((value || min).slice(0, 7));
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 500 });
  if (value !== draft.value) setDraft({ text: format(value), value });
  const expanded = open && !disabled;
  const selectedDay = value.slice(0, 10), minDay = min.slice(0, 10), maxDay = max.slice(0, 10);
  function validation(raw: string) {
    if (!raw) return '';
    const parsed = parse(raw);
    return !parsed ? 'Gunakan format dd/mm/yyyy jj:mm.' : parsed < min ? 'Pilih waktu mendatang.' : parsed > max ? 'Waktu melewati batas transaksi.' : '';
  }
  useEffect(() => { input.current?.setCustomValidity(validation(text)); });
  function close(restoreFocus = true) { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); }
  function show() {
    if (disabled || input.current?.matches(':disabled')) return;
    const day = (value && value >= min && value <= max ? value : min).slice(0, 10);
    setActive(day); setMonth(day.slice(0, 7)); setPortal(trigger.current?.closest('dialog') ?? document.body); setOpen(true);
  }
  useEffect(() => {
    if (!expanded) return;
    const positionPopup = () => {
      const rect = root.current?.getBoundingClientRect(); if (!rect) return;
      const viewport = window.visualViewport, left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = Math.min(356, (viewport?.width ?? innerWidth) - 32);
      const bottom = top + (viewport?.height ?? innerHeight), below = bottom - rect.bottom - 16, above = rect.top - top - 16;
      const upwards = below < Math.min(480, popup.current?.scrollHeight ?? 480) && above > below;
      const maxHeight = Math.max(120, Math.min(500, upwards ? above : below));
      setPosition({ left: Math.max(left + 16, Math.min(rect.left, left + (viewport?.width ?? innerWidth) - width - 16)), top: upwards ? rect.top - Math.min(maxHeight, popup.current?.scrollHeight ?? maxHeight) - 8 : rect.bottom + 8, width, maxHeight });
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      // A time select opens its own list in the dialog's top layer.
      if ((target as Element).closest?.('.select-options')) return;
      if (!root.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    positionPopup(); const observer = new ResizeObserver(positionPopup);
    if (popup.current) observer.observe(popup.current);
    if (root.current) observer.observe(root.current);
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', positionPopup); window.addEventListener('scroll', positionPopup, true);
    window.visualViewport?.addEventListener('resize', positionPopup); window.visualViewport?.addEventListener('scroll', positionPopup);
    return () => { observer.disconnect(); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', positionPopup); window.removeEventListener('scroll', positionPopup, true); window.visualViewport?.removeEventListener('resize', positionPopup); window.visualViewport?.removeEventListener('scroll', positionPopup); };
  }, [expanded]);
  useEffect(() => {
    if (!expanded || !position.width) return;
    const button = popup.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`);
    const scroller = popup.current?.querySelector<HTMLElement>('.date-picker-days');
    button?.focus({ preventScroll: true });
    if (button && scroller) {
      const dayRect = button.getBoundingClientRect(), bounds = scroller.getBoundingClientRect();
      if (dayRect.bottom > bounds.bottom) scroller.scrollTop += dayRect.bottom - bounds.bottom;
      if (dayRect.top < bounds.top) scroller.scrollTop -= bounds.top - dayRect.top;
    }
  }, [active, month, expanded, position.width]);
  function commit(day: string, time = value.slice(11, 16) || '09:00') {
    let next = `${day}T${time}`; if (next < min) next = min; if (next > max) next = max;
    setDraft({ text: format(next), value: next }); onChange(next); setInvalid(false);
  }
  function selectDay(day: string) { setActive(day); setMonth(day.slice(0, 7)); commit(day); }
  function moveMonth(offset: number) {
    const nextMonth = shiftMonth(month, offset), first = nextMonth + '-01';
    if (nextMonth < minDay.slice(0, 7) || nextMonth > maxDay.slice(0, 7)) return;
    const next = first < minDay ? minDay : first > maxDay ? maxDay : first;
    setMonth(nextMonth); setActive(next);
  }
  function calendarKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    let next: string | undefined;
    const weekday = (date(day).getUTCDay() + 6) % 7;
    if (event.key === 'ArrowLeft') next = shiftDay(day, -1);
    if (event.key === 'ArrowRight') next = shiftDay(day, 1);
    if (event.key === 'ArrowUp') next = shiftDay(day, -7);
    if (event.key === 'ArrowDown') next = shiftDay(day, 7);
    if (event.key === 'Home') next = shiftDay(day, -weekday);
    if (event.key === 'End') next = shiftDay(day, 6 - weekday);
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); moveMonth(event.key === 'PageUp' ? -1 : 1); return; }
    if (next) { event.preventDefault(); next = next < minDay ? minDay : next > maxDay ? maxDay : next; setActive(next); setMonth(next.slice(0, 7)); }
  }
  function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }
  const first = month + '-01', start = shiftDay(first, -(date(first).getUTCDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => shiftDay(start, index));
  const timeValue = value || min;
  const availableHour = (hour: string) => `${selectedDay || minDay}T${hour}:59` >= min && `${selectedDay || minDay}T${hour}:00` <= max;
  return <div ref={root} className="date-time-control" onKeyDown={event => { if (expanded) escape(event); else if (event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); show(); } }}>
    <div className="date-time-input"><input {...aria} ref={input} id={id} type="text" className="input" placeholder="dd/mm/yyyy jj:mm" autoComplete="off" required={required} disabled={disabled} value={text} aria-invalid={aria['aria-invalid'] || invalid || undefined} onChange={event => { const raw = event.target.value, next = parse(raw) ?? ''; setDraft({ text: raw, value: next }); setInvalid(false); event.target.setCustomValidity(validation(raw)); onChange(next); }} onBlur={() => { if (parse(text)) setDraft({ text: format(parse(text)!), value }); }} onInvalid={() => setInvalid(true)} /><button ref={trigger} type="button" aria-label="Buka kalender" aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? id + '-calendar' : undefined} disabled={disabled} onClick={() => expanded ? close() : show()}><CalendarDays size={19} aria-hidden="true" /></button></div>
    {invalid && <p className="field-error" role="alert">{validation(text) || 'Pilih tanggal dan waktu serah terima.'}</p>}
    {expanded && portal && createPortal(<div ref={popup} id={id + '-calendar'} role="dialog" aria-label="Pilih tanggal dan waktu" className="date-picker-popover" data-compact={position.maxHeight < 360 || undefined} style={{ ...position, visibility: position.width ? 'visible' : 'hidden' }} onKeyDown={escape}>
      <div className="date-picker-heading"><p aria-live="polite">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date(first))}</p><div><button type="button" aria-label="Bulan sebelumnya" disabled={month <= minDay.slice(0, 7)} onClick={() => moveMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button><button type="button" aria-label="Bulan berikutnya" disabled={month >= maxDay.slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button></div></div>
      <div className="date-picker-days"><table className="date-picker-grid" role="grid" aria-label="Tanggal serah terima"><thead><tr>{weekdays.map(day => <th key={day} scope="col"><abbr title={day}>{day.slice(0, 3)}</abbr></th>)}</tr></thead><tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => <td key={day} aria-selected={selectedDay === day}><button type="button" data-day={day} data-outside={day.slice(0, 7) !== month || undefined} aria-label={fullDate(day)} aria-current={day === today ? 'date' : undefined} tabIndex={day === active ? 0 : -1} disabled={day < minDay || day > maxDay} onKeyDown={event => calendarKey(event, day)} onClick={() => selectDay(day)}>{Number(day.slice(8))}</button></td>)}</tr>)}</tbody></table></div>
      <div className="date-picker-time"><span>Waktu <small>{zoneLabel}</small></span>
        <div className="date-picker-time-field"><label htmlFor={id + '-hour'}>Jam</label><Select id={id + '-hour'} value={timeValue.slice(11, 13)} onChange={event => commit(selectedDay || minDay, event.target.value + ':' + timeValue.slice(14, 16))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={pad(hour)} disabled={!availableHour(pad(hour))}>{pad(hour)}</option>)}</Select></div>
        <div className="date-picker-time-field"><label htmlFor={id + '-minute'}>Menit</label><Select id={id + '-minute'} value={timeValue.slice(14, 16)} onChange={event => commit(selectedDay || minDay, timeValue.slice(11, 13) + ':' + event.target.value)}>{Array.from({ length: 60 }, (_, minute) => { const candidate = `${selectedDay || minDay}T${timeValue.slice(11, 13)}:${pad(minute)}`; return <option key={minute} value={pad(minute)} disabled={candidate < min || candidate > max}>{pad(minute)}</option>; })}</Select></div>
      </div>
      <div className="date-picker-actions"><button type="button" disabled={today < minDay || today > maxDay} onClick={() => selectDay(today)}>Hari ini</button><button type="button" className="date-picker-done" onClick={() => { if (!value) commit(minDay, min.slice(11, 16)); close(); }}>Selesai</button></div>
    </div>, portal)}
  </div>;
}
