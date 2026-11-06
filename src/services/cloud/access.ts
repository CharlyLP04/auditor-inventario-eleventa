import { collection, documentId, and, or, query, where } from 'firebase/firestore';
import type { Firestore, QueryFieldFilterConstraint, QueryNonFilterConstraint } from 'firebase/firestore';
export interface AccessScope { allAccess?: boolean; companyIds?: string[]; auditIds?: string[]; visibleCompanyIds?: string[]; }
export const unrestricted = (user: AccessScope & { role: string }) => user.role === 'admin' || user.allAccess !== false;
export function scopedAudits(db: Firestore, user: AccessScope & { role: string }, status: QueryFieldFilterConstraint, ...constraints: QueryNonFilterConstraint[]) {
  const ref = collection(db, 'audits');
  if (unrestricted(user)) return query(ref, status, ...constraints);
  const filters = [];
  if (user.companyIds?.length) filters.push(where('companyId', 'in', user.companyIds));
  if (user.auditIds?.length) filters.push(where(documentId(), 'in', user.auditIds));
  return filters.length ? query(ref, and(or(...filters), status), ...constraints) : null;
}
export function scopedCompanies(db: Firestore, user: AccessScope & { role: string }) {
  const ref = collection(db, 'companies');
  if (unrestricted(user)) return query(ref);
  const ids = [...new Set([...(user.companyIds ?? []), ...(user.visibleCompanyIds ?? [])])];
  return ids.length ? query(ref, where(documentId(), 'in', ids)) : null;
}
