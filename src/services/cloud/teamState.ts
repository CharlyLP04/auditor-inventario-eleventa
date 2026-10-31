import { BUCKETS } from './model';
export const SYNC_SOURCES = ['audit', 'catalog', 'counts', 'departments', 'unregistered'] as const;
export type SyncSource = typeof SYNC_SOURCES[number];
export interface SyncMetadata { fromCache: boolean; hasPendingWrites: boolean; }
export function summarizeSync(sources: Partial<Record<SyncSource, SyncMetadata>>) {
  return {
    confirmed: SYNC_SOURCES.every(key => sources[key] && !sources[key]!.fromCache && !sources[key]!.hasPendingWrites),
    pending: SYNC_SOURCES.some(key => sources[key]?.hasPendingWrites),
  };
}
export function sharedAuditId(search: string): string | null {
  const id = new URLSearchParams(search).get('audit');
  return id && id.length <= 300 && !id.includes('/') && id !== '.' && id !== '..' ? id : null;
}
export function auditLink(href: string, auditId: string): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('audit', auditId);
  return url.href;
}

export function auditDataLoaded(sources: Partial<Record<SyncSource, SyncMetadata>>, chunks: number, loadedChunks: number, bucketCount: number) {
  return SYNC_SOURCES.every(key => Boolean(sources[key])) && loadedChunks >= chunks && bucketCount === BUCKETS;
}
