import { registerDevice, deviceKey } from '../services/cloud/closing';
import { scopedAudits, scopedCompanies, unrestricted } from '../services/cloud/access';
import type { AccessScope } from '../services/cloud/access';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, where } from 'firebase/firestore';
import type { DocumentData, Firestore } from 'firebase/firestore';
import type { Product, CountMode } from '../types';
import {
  auditRefs, toAudit, toBucket, toDepartment, toUnregistered, catalogFrom, contributorsFrom, recordCapture, undoCapture, registerUnregistered,
  editUnregistered, setUnregisteredExcluded, linkUnregistered, claimDepartment, releaseDepartment, setDepartmentStatus, reassignDepartment,
  setAuditStatus, saveAuditNotes, verifyAuditIntegrity,
} from '../services/cloud/repository';
import type { CloudUser, CloudAudit, CloudDepartment, CloudCompany, DepartmentStatus, AuditStatus } from '../services/cloud/repository';
import { assembleProducts } from '../services/cloud/model';
import type { BucketData, UnregisteredDoc } from '../services/cloud/model';
import { authMessage } from './useCloudSession';
import { auditDataLoaded, summarizeSync } from '../services/cloud/teamState';
import type { SyncSource, SyncMetadata } from '../services/cloud/teamState';

export interface CloudMember extends AccessScope { uid: string; name: string; email?: string; role: 'admin' | 'auditor'; active: boolean; }

/** Señal de conexión del dispositivo: la interfaz la muestra junto con las capturas pendientes de enviar. */
export function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

export function useCloudWorkspace(db: Firestore, user: CloudUser, showAuditList = true) {
  const [companies, setCompanies] = useState<CloudCompany[]>([]);
  const [audits, setAudits] = useState<CloudAudit[]>([]);
  const [auditsLoaded, setAuditsLoaded] = useState(false);
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const fail = (e: unknown) => setError(authMessage(e));
    const stops = [
      ...(scopedCompanies(db, user) ? [onSnapshot(scopedCompanies(db, user)!, s => setCompanies(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CloudCompany, 'id'>) })).sort((a, b) => a.name.localeCompare(b.name, 'es'))), fail)] : []),

      user.role === 'admin' ? onSnapshot(collection(db, 'members'), s => setMembers(s.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<CloudMember, 'uid'>) })).sort((a, b) => a.name.localeCompare(b.name, 'es'))), fail) : onSnapshot(doc(db, 'members', user.uid), s => setMembers(s.exists() ? [{ uid: s.id, ...s.data() } as CloudMember] : []), fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [db, user]);
  useEffect(() => {
    if (!showAuditList) return;
    const source = scopedAudits(db, user, where('status', '==', 'in_progress'));
    if (!source) return;
    return onSnapshot(source,
      snapshot => { setAudits(snapshot.docs.map(d => toAudit(d.id, d.data())).sort((a, b) => b.period.localeCompare(a.period))); setAuditsLoaded(true); },
      error => setError(authMessage(error)));
  }, [db, user, showAuditList]);
  const loading = !error && showAuditList && !auditsLoaded && (unrestricted(user) || Boolean(user.companyIds?.length || user.auditIds?.length));
  return { companies, audits, members, error, loading };
}

interface LastCapture { captureId: string; code: string; delta: number; department?: string; }
export function useCloudAudit(db: Firestore, user: CloudUser, auditId: string) {
  const [audit, setAudit] = useState<CloudAudit | null>(null);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [catalogDocs, setCatalogDocs] = useState<{ id: string; data: () => DocumentData }[]>([]);
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [departments, setDepartments] = useState<CloudDepartment[]>([]);
  const [unregistered, setUnregistered] = useState<UnregisteredDoc[]>([]);
  const [error, setError] = useState('');
  const [listenerFailed, setListenerFailed] = useState(false);
  const [pending, setPending] = useState(0);
  const deviceRegistered = Boolean(audit?.deviceOwners?.[deviceKey(user.uid)] === user.uid);
  const [syncSources, setSyncSources] = useState<Partial<Record<SyncSource, SyncMetadata>>>({});
  const sync = summarizeSync(syncSources);
  const last = useRef<LastCapture | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const refs = auditRefs(db, auditId);
    const metadata = (key: SyncSource, value: SyncMetadata) => setSyncSources(previous => {
      const old = previous[key];
      return old?.fromCache === value.fromCache && old?.hasPendingWrites === value.hasPendingWrites ? previous : { ...previous, [key]: value };
    });
    const fail = (e: unknown) => { setListenerFailed(true); setAudit(null); setAuditLoaded(true); setError(authMessage(e)); };
    const stops = [
      onSnapshot(refs.audit, { includeMetadataChanges: true }, s => { setAudit(s.exists() ? toAudit(s.id, s.data()) : null); setAuditLoaded(true); metadata('audit', s.metadata); }, fail),
      onSnapshot(refs.catalog, { includeMetadataChanges: true }, s => { if (s.docChanges().length) setCatalogDocs(s.docs.map(d => { const data = d.data(); return { id: d.id, data: () => data }; })); metadata('catalog', s.metadata); }, fail),
      onSnapshot(refs.counts, { includeMetadataChanges: true }, s => { if (s.docChanges().length) setBuckets(s.docs.map(d => toBucket(d.data()))); metadata('counts', s.metadata); }, fail),
      onSnapshot(refs.departments, { includeMetadataChanges: true }, s => { if (s.docChanges().length) setDepartments(s.docs.map(d => toDepartment(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'es'))); metadata('departments', s.metadata); }, fail),
      onSnapshot(refs.unregistered, { includeMetadataChanges: true }, s => { if (s.docChanges().length) setUnregistered(s.docs.map(d => toUnregistered(d.data()))); metadata('unregistered', s.metadata); }, fail),
    ];
    last.current = null;
    return () => stops.forEach(stop => stop());
  }, [db, auditId]);

  useEffect(() => {
    if (deviceRegistered) return;
    if (audit?.status !== 'in_progress' || syncSources.audit?.fromCache !== false) return;
    let active = true;
    registerDevice(db, user, auditId).catch(e => { if (active) setError(authMessage(e)); });
    return () => { active = false; };
  }, [db, user, auditId, audit?.status, deviceRegistered, syncSources.audit?.fromCache]);

  const catalog = useMemo(() => catalogFrom(catalogDocs), [catalogDocs]);
  const [productCache] = useState(() => new WeakMap<Product, Product>());
  const products = useMemo(() => assembleProducts(catalog, buckets, unregistered, productCache), [catalog, buckets, unregistered, productCache]);
  const contributors = useMemo(() => contributorsFrom(buckets), [buckets]);
  const productsRef = useRef(products);
  useEffect(() => { productsRef.current = products; }, [products]);
  const loading = !auditLoaded || Boolean(audit && !auditDataLoaded(syncSources, audit.catalog?.chunks ?? 0, catalogDocs.length, buckets.length));
  const ready = !loading && sync.confirmed && pending === 0 && !error && !listenerFailed;

  // Las escrituras no se esperan para contar: sin señal quedan en la cola local y se confirman al reconectar.
  const track = useCallback((promise: Promise<unknown>) => {
    setPending(n => n + 1);
    promise.catch(e => setError(authMessage(e))).finally(() => setPending(n => n - 1));
  }, []);

  const recordCount = async (code: string, quantity: number, mode: CountMode, outsideAssignment = false): Promise<Product> => {
    if (!deviceRegistered || audit?.closingToken) throw new Error('El conteo está pausado para comprobar los dispositivos antes del cierre.');
    const current = productsRef.current.find(p => p.code === code);
    if (!current) throw new Error(`El código ${code} no está en esta auditoría.`);
    if (current.excludedAt) throw new Error(`El código ${code} fue excluido del conteo. Reincorpóralo para volver a contarlo.`);
    const written = recordCapture(db, user, auditId, { code, quantity, mode, current, department: current.department, outsideAssignment });
    if (mode === 'set') await written.committed; else track(written.committed);
    last.current = { captureId: written.captureId, code, delta: written.delta, department: current.department }; setCanUndo(true);
    return { ...current, physicalStock: written.total, counted: true, lastScannedAt: new Date().toISOString() };
  };
  const register = (input: { code: string; name?: string; note?: string; quantity: number; department?: string }): Product => {
    if (!deviceRegistered || audit?.closingToken) throw new Error('El conteo está pausado para el cierre.');
    const code = input.code.trim();
    const existing = productsRef.current.find(p => p.code === code);
    if (existing && !existing.isUnregistered) throw new Error(`El código ${code} ya existe en el catálogo; cuéntalo de forma normal.`);
    if (existing?.excludedAt) throw new Error(`El código ${code} fue excluido del conteo. Reincorpóralo antes de sumar piezas.`);
    const written = registerUnregistered(db, user, auditId, input);
    track(written.committed);
    last.current = { captureId: written.captureId, code, delta: input.quantity, department: input.department }; setCanUndo(true);
    return { code, description: existing?.description ?? (input.name?.trim() || `No encontrado ${code}`), note: input.note, cost: 0, price: 0, department: input.department || 'Sin clasificar', theoreticalStock: 0, physicalStock: (existing?.physicalStock ?? 0) + input.quantity, counted: true, isUnregistered: true };
  };
  const undo = async () => {
    if (!last.current || audit?.closingToken || !deviceRegistered) return false;
    try {
      await undoCapture(db, user, auditId, last.current).committed;
      last.current = null; setCanUndo(false); setError(''); return true;
    } catch (e) { setError(authMessage(e)); return false; }
  };
  const optimistic = (promise: Promise<unknown>) => { track(promise); return true; };
  // Tomar o soltar un departamento exige leer el estado del servidor: se espera la respuesta y se informa el resultado.
  const awaited = async (action: () => Promise<unknown>) => {
    try { await action(); setError(''); return true; } catch (e) { setError(authMessage(e)); return false; }
  };
  return {
    audit, products, departments, contributors, deviceRegistered, loading, error, setError, pending: Math.max(pending, sync.pending ? 1 : 0), synced: ready, canUndo,
    recordCount, register, undo,
    editUnregistered: (code: string, patch: { name?: string; note?: string }) => optimistic(editUnregistered(db, user, auditId, code, patch)),
    excludeUnregistered: (code: string, reason: string) => awaited(() => setUnregisteredExcluded(db, user, auditId, code, true, reason)),
    restoreUnregistered: (code: string) => awaited(() => setUnregisteredExcluded(db, user, auditId, code, false)),
    linkUnregistered: (code: string, target: string) => {
      const source = productsRef.current.find(p => p.code === code);
      return source ? awaited(() => linkUnregistered(db, user, auditId, code, target, source.physicalStock)) : false;
    },
    claim: (name: string) => awaited(() => claimDepartment(db, user, auditId, name)),
    release: (name: string) => awaited(() => releaseDepartment(db, user, auditId, name)),
    setStatus: (name: string, status: DepartmentStatus) => awaited(() => setDepartmentStatus(db, user, auditId, name, status)),
    reassign: (name: string, to: { uid: string; name: string } | null) => awaited(() => reassignDepartment(db, user, auditId, name, to)),
    setAuditStatus: (status: AuditStatus) => awaited(() => {
      if (!ready) throw new Error('Espera a que todos los cambios estén sincronizados antes de cambiar el estado.');
      return setAuditStatus(db, user, auditId, status);
    }),
    saveNotes: (notes: string, expectedNotes: string) => awaited(() => saveAuditNotes(db, user, auditId, notes, expectedNotes)),
    verify: () => verifyAuditIntegrity(db, auditId),
  };
}
export type CloudAuditStore = ReturnType<typeof useCloudAudit>;
