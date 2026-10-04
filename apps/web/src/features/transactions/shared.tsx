'use client';



export const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export const time = (s: string) => new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
