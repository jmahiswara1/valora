import { AppException } from '../../shared/http.js';

export function period(from?: string, to?: string) {
  const start = from ? new Date(from) : null; const end = to ? new Date(to) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && start >= end)) throw new AppException(400, 'INVALID_INPUT', 'Periode harus berupa tanggal ISO dengan awal sebelum akhir.');
  return { start, end, filter: { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } };
}
