import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, type ComponentPropsWithRef, type ReactNode, isValidElement, cloneElement } from 'react';

export function cn(...values: ClassValue[]): string { return twMerge(clsx(values)); }

const buttonStyle = cva('button', { variants: { variant: { primary: 'button-primary', secondary: 'button-secondary', quiet: 'button-quiet', danger: 'button-danger' }, size: { normal: 'button-normal', small: 'button-small' } }, defaultVariants: { variant: 'primary', size: 'normal' } });

export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyle>) {
  return <button className={cn(buttonStyle({ variant, size }), className)} {...props} />;
}

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn('input', className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  const control = isValidElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children) ? cloneElement(children, {
    'aria-describedby': Array.from(new Set([children.props['aria-describedby'], hint && htmlFor ? `${htmlFor}-hint` : '', error && htmlFor ? `${htmlFor}-error` : ''].filter(Boolean).join(' ').split(' ').filter(Boolean))).join(' ') || undefined,
    'aria-invalid': error ? true : children.props['aria-invalid'],
  }) : children;
  return <div className="field"><label htmlFor={htmlFor}>{label}</label>{control}{hint && <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="field-hint">{hint}</p>}{error && <p id={htmlFor ? `${htmlFor}-error` : undefined} className="field-error" role="alert">{error}</p>}</div>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'success' | 'error'; children: ReactNode }) {
  return <div className={cn('notice', 'notice-' + kind)} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}
