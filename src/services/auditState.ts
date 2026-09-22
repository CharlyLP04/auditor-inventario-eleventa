import type { Product } from '../types';
// Preserve older saved audits while distinguishing a confirmed zero from a pending count.
export const isCounted = (p: Product) => p.counted ?? (p.physicalStock > 0 || Boolean(p.lastScannedAt));
