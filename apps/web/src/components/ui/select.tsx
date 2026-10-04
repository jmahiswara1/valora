'use client';


import { Children, isValidElement, useEffect, useId, useRef, useState, type ComponentPropsWithRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './primitives';

type Option = { value: string; label: string; disabled: boolean; group?: string };
type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'multiple' | 'size' | 'ref' | 'onBlur' | 'onFocus' | 'onKeyDown'> & Pick<ComponentPropsWithRef<'button'>, 'ref' | 'onBlur' | 'onFocus' | 'onKeyDown'>;

function textContent(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? textContent(child.props.children) : String(child)).join('');
}

function collectOptions(children: ReactNode, group?: string, disabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean }>(child)) return [];
    const props = child.props;
    if (child.type === 'option') return [{ value: String(props.value ?? textContent(props.children)), label: props.label ?? textContent(props.children), disabled: disabled || !!props.disabled, group }];
    return collectOptions(props.children, child.type === 'optgroup' ? props.label : group, disabled || !!props.disabled);
  });
}

/** A select-only combobox backed by a native select for form data and validation. */
export function Select({ children, className, id, value, defaultValue, disabled, required, onChange, onInvalid, onBlur, onFocus, onKeyDown, ref, ...props }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-options`;
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const options = collectOptions(children);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ''));
  const selectedValue = String(value ?? localValue);
  const selected = options.find(option => option.value === selectedValue) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 0, maxHeight: 320 });
  const expanded = open && !disabled;

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => { setLocalValue(String(defaultValue ?? collectOptions(children).find(option => !option.disabled)?.value ?? '')); setInvalid(false); setOpen(false); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue, children]); // Options may arrive asynchronously.

  useEffect(() => {
    if (!expanded) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const width = Math.min(rect.width, (viewport?.width ?? innerWidth) - 24);
      const bottom = topEdge + (viewport?.height ?? innerHeight);
      const below = bottom - rect.bottom - 20;
      const above = rect.top - topEdge - 20;
      const upwards = below < Math.min(320, list.current?.scrollHeight ?? 320) && above > below;
      const maxHeight = Math.max(44, Math.min(320, upwards ? above : below));
      const height = Math.min(maxHeight, list.current?.scrollHeight ?? maxHeight);
      setPlacement({ left: Math.max(leftEdge + 12, Math.min(rect.left, leftEdge + (viewport?.width ?? innerWidth) - width - 12)), top: upwards ? rect.top - height - 8 : rect.bottom + 8, width, maxHeight });
    };
    const dismiss = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) setOpen(false);
    };
    position();
    const observer = new ResizeObserver(position);
    if (trigger.current) observer.observe(trigger.current);
    if (list.current) observer.observe(list.current);
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [expanded]);

  useEffect(() => {
    if (expanded) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded]);

  function show(index = options.findIndex(option => option.value === selected?.value && !option.disabled)) {
    setActive(index >= 0 ? index : options.findIndex(option => !option.disabled));
    search.current = { text: '', time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || !native.current || trigger.current?.matches(':disabled')) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
    trigger.current?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
      let next = event.key === 'End' ? enabled.at(-1) : enabled[0];
      if (event.key.startsWith('Arrow')) {
        const current = expanded ? active : options.findIndex(option => option.value === selected?.value);
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        next = enabled[Math.max(0, Math.min(enabled.length - 1, enabled.indexOf(current) + (expanded ? offset : 0)))];
      }
      if (!expanded) show(next); else setActive(next ?? -1);
      return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && (!search.current.text || Date.now() - search.current.time > 700))) {
      event.preventDefault();
      if (expanded) choose(active); else show();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - search.current.time > 700 ? '' : search.current.text) + event.key.toLocaleLowerCase('id');
      search.current = { text, time: now };
      const query = Array.from(text).every(char => char === text[0]) ? text[0] : text;
      const start = query.length === 1 ? (expanded ? active : options.indexOf(selected!)) + 1 : 0;
      const index = options.map((_, offset) => (start + offset) % options.length).find(index => !options[index].disabled && options[index].label.toLocaleLowerCase('id').startsWith(query));
      if (index !== undefined) { if (!expanded) show(index); else setActive(index); }
    }
  }

  return <div className="select-control">
    <select {...props} ref={native} id={`${controlId}-native`} className="select-native" tabIndex={-1} aria-hidden="true" value={value} defaultValue={defaultValue} disabled={disabled} required={required}
      onChange={event => { setLocalValue(event.target.value); setInvalid(false); onChange?.(event); }}
      onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); onInvalid?.(event); }}>{children}</select>
    <button ref={element => { trigger.current = element; if (typeof ref === 'function') ref(element); else if (ref) ref.current = element; }} type="button" id={controlId}
      className={cn('select', 'select-trigger', className)} role="combobox" disabled={disabled} aria-expanded={expanded} aria-haspopup="listbox" aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined} aria-required={required || undefined} aria-invalid={props['aria-invalid'] || invalid || undefined}
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={cn(props['aria-describedby'], invalid && `${controlId}-validation`) || undefined}
      onClick={() => expanded ? setOpen(false) : show()} onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented) handleKey(event); }} onFocus={onFocus}
      onBlur={event => { setOpen(false); onBlur?.(event); }}>
      <span className="select-value">{selected?.label ?? 'Tidak ada pilihan'}</span><ChevronDown className="select-chevron" size={18} aria-hidden="true" />
    </button>
    {invalid && <p className="field-error" id={`${controlId}-validation`} role="alert">Pilih salah satu opsi untuk melanjutkan.</p>}
    {expanded && createPortal(<div ref={list} id={listId} role="listbox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby'] ?? controlId} className="select-options" style={{ ...placement, visibility: placement.width ? 'visible' : 'hidden' }} onPointerDown={event => event.preventDefault()}>
      {options.length ? options.map((option, index) => <div key={`${option.value}-${index}`}>
        {option.group && option.group !== options[index - 1]?.group && <div className="select-group">{option.group}</div>}
        <div id={`${listId}-${index}`} role="option" aria-selected={option.value === selected?.value} aria-disabled={option.disabled || undefined} data-index={index} data-active={active === index || undefined}
          className="select-option" onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
          <span>{option.label}</span>{option.value === selected?.value && <Check size={17} aria-hidden="true" />}
        </div>
      </div>) : <p className="select-empty">Tidak ada pilihan tersedia.</p>}
    </div>, document.body)}
  </div>;
}
