'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui/primitives';

type FilterOption<T extends string> = { value: T; label: string; Icon?: LucideIcon; count?: string | number };

/** Filters are toggle buttons, not navigation tabs: native Tab/Enter/Space behavior is retained. */
export function AccountFilters<T extends string>({ label, value, onChange, options, variant = 'tabs', className }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  variant?: 'tabs' | 'chips';
  className?: string;
}) {
  return <div className={cn('account-filters', `account-filters--${variant}`, className)} role="group" aria-label={label}>
    {options.map(({ value: optionValue, label: optionLabel, Icon, count }) => <button type="button" key={optionValue} aria-pressed={value === optionValue} onClick={() => onChange(optionValue)}>
      {Icon && <Icon size={18} strokeWidth={1.7} aria-hidden="true" />}{optionLabel}{count !== undefined && <span className="account-filter-count">{count}</span>}
    </button>)}
  </div>;
}
