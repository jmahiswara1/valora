'use client';

import type { TransactionDto } from '@valora/contracts';

export const transactionLabels: Record<TransactionDto['status'], string> = { AWAITING_HANDOVER: 'Menunggu serah terima', ONE_SIDE_CONFIRMED: 'Konfirmasi belum lengkap', DISPUTED: 'Dalam sengketa', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
