'use client';



export function periodQuery(days: string) {
  if (days === 'all') return '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const midnight = new Date(today + 'T00:00:00+07:00');
  return '?from=' + encodeURIComponent(new Date(midnight.getTime() - (Number(days) - 1) * 86400000).toISOString()) + '&to=' + encodeURIComponent(new Date(midnight.getTime() + 86400000).toISOString());
}
