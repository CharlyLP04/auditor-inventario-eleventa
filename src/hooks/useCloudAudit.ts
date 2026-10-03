import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import type { DocumentData, Firestore } from 'firebase/firestore';
import type { Product, CountMode } from '../types';
import {
  auditRefs, toAudit, toBucket, toDepartment, toUnregistered, catalogFrom, contributorsFrom, recordCapture, undoCapture, registerUnregistered,
  editUnregistered, setUnregisteredExcluded, linkUnregistered, claimDepartment, releaseDepartment, setDepartmentStatus, reassignDepartment,
  setAuditStatus, saveAuditNotes, readCaptures,
} from '../services/cloud/repository';
import type { CloudUser, CloudAudit, CloudDepartment, CloudCompany, DepartmentStatus, AuditStatus } from '../services/cloud/repository';
import { assembleProducts, verifyIntegrity } from '../services/cloud/model';
import type { BucketData, UnregisteredDoc } from '../services/cloud/model';
import { authMessage } from './useCloudSession';

export interface CloudMember { uid: string; name: string; email?: string; role: 'admin' | 'auditor'; active: boolean; }

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

export function useCloudWorkspace(db: Firestore, user: CloudUser) {
  const [companies, setCompanies] = useState<CloudCompany[]>([]);
  const [audits, setAudits] = useState<CloudAudit[]>([]);
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const fail = (e: unknown) => setError(authMessage(e));
    const stops = [
      onSnapshot(collection(db, 'companies'), s => setCompanies(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CloudCompany, 'id'>) })).sort((a, b) => a.name.localeCompare(b.name, 'es'))), fail),
      onSnapshot(collection(db, 'audits'), s => setAudits(s.docs.map(d => toAudit(d.id, d.data())).sort((a, b) => b.period.localeCompare(a.period))), fail),
      onSnapshot(collection(db, 'members'), s => setMembers(s.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<CloudMember, 'uid'>) })).sort((a, b) => a.name.localeCompare(b.name, 'es'))), fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [db, user.uid]);
  return { companies, audits, members, error };
}

interface LastCapture { captureId: string; code: string; delta: number; department?: string; }
export function useCloudAudit(db: Firestore, user: CloudUser, auditId: string) {
  const [audit, setAudit] = useState<CloudAudit | null>(null);
  const [catalogDocs, setCatalogDocs] = useState<{ id: string; data: () => DocumentData }[]>([]);
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [departments, setDepartments] = useState<CloudDepartment[]>([]);
  const [unregistered, setUnregistered] = useState<UnregisteredDoc[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const last = useRef<LastCapture | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const refs = auditRefs(db, auditId);
    const fail = (e: unknown) => setError(authMessage(e));
    const stops = [
      onSnapshot(refs.audit, s => setAudit(s.exists() ? toAudit(s.id, s.data()) : null), fail),
      onSnapshot(refs.catalog, s => setCatalogDocs(s.docs.map(d => { const data = d.data(); return { id: d.id, data: () => data }; })), fail),
      onSnapshot(refs.counts, s => setBuckets(s.docs.map(d => toBucket(d.data()))), fail),
      onSnapshot(refs.departments, s => setDepartments(s.docs.map(d => toDepartment(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'es'))), fail),
      onSnapshot(refs.unregistered, s => setUnregistered(s.docs.map(d => toUnregistered(d.data()))), fail),
    ];
    last.current = null;
    return () => stops.forEach(stop => stop());
  }, [db, auditId]);

  const catalog = useMemo(() => catalogFrom(catalogDocs), [catalogDocs]);
  const products = useMemo(() => assembleProducts(catalog, buckets, unregistered), [catalog, buckets, unregistered]);
  const contributors = useMemo(() => contributorsFrom(buckets), [buckets]);
  const productsRef = useRef(products);
  useEffect(() => { productsRef.current = products; }, [products]);
  const loading = !audit || catalogDocs.length < (audit.catalog?.chunks ?? 0);

  // Las escrituras no se esperan para contar: sin señal quedan en la cola local y se confirman al reconectar.
  const track = useCallback((promise: Promise<unknown>) => {
    setPending(n => n + 1);
    promise.catch(e => setError(authMessage(e))).finally(() => setPending(n => n - 1));
  }, []);

  const recordCount = (code: string, quantity: number, mode: CountMode, outsideAssignment = false): Product => {
    const current = productsRef.current.find(p => p.code === code);
    if (!current) throw new Error(`El código ${code} no está en esta auditoría.`);
    if (current.excludedAt) throw new Error(`El código ${code} fue excluido del conteo. Reincorpóralo para volver a contarlo.`);
    const written = recordCapture(db, user, auditId, { code, quantity, mode, current, department: current.department, outsideAssignment });
    track(written.committed);
    last.current = { captureId: written.captureId, code, delta: written.delta, department: current.department }; setCanUndo(true);
    return { ...current, physicalStock: written.total, counted: true, lastScannedAt: new Date().toISOString() };
  };
  const register = (input: { code: string; name?: string; note?: string; quantity: number; department?: string }): Product => {
    const code = input.code.trim();
    const existing = productsRef.current.find(p => p.code === code);
    if (existing && !existing.isUnregistered) throw new Error(`El código ${code} ya existe en el catálogo; cuéntalo de forma normal.`);
    if (existing?.excludedAt) throw new Error(`El código ${code} fue excluido del conteo. Reincorpóralo antes de sumar piezas.`);
    const written = registerUnregistered(db, user, auditId, input);
    track(written.committed);
    last.current = { captureId: written.captureId, code, delta: input.quantity, department: input.department }; setCanUndo(true);
    return { code, description: existing?.description ?? (input.name?.trim() || `No encontrado ${code}`), note: input.note, cost: 0, price: 0, department: input.department || 'Sin clasificar', theoreticalStock: 0, physicalStock: (existing?.physicalStock ?? 0) + input.quantity, counted: true, isUnregistered: true };
  };
  const undo = () => {
    if (!last.current) return false;
    track(undoCapture(db, user, auditId, last.current).committed);
    last.current = null; setCanUndo(false);
    return true;
  };
  const optimistic = (promise: Promise<unknown>) => { track(promise); return true; };
  // Tomar o soltar un departamento exige leer el estado del servidor: se espera la respuesta y se informa el resultado.
  const awaited = async (action: () => Promise<unknown>) => {
    try { await action(); setError(''); return true; } catch (e) { setError(authMessage(e)); return false; }
  };
  return {
    audit, products, departments, contributors, loading, error, setError, pending, canUndo,
    recordCount, register, undo,
    editUnregistered: (code: string, patch: { name?: string; note?: string }) => optimistic(editUnregistered(db, user, auditId, code, patch)),
    excludeUnregistered: (code: string, reason: string) => optimistic(setUnregisteredExcluded(db, user, auditId, code, true, reason)),
    restoreUnregistered: (code: string) => optimistic(setUnregisteredExcluded(db, user, auditId, code, false)),
    linkUnregistered: (code: string, target: string) => {
      const source = productsRef.current.find(p => p.code === code);
      return source ? optimistic(linkUnregistered(db, user, auditId, code, target, source.physicalStock)) : false;
    },
    claim: (name: string) => awaited(() => claimDepartment(db, user, auditId, name)),
    release: (name: string) => awaited(() => releaseDepartment(db, user, auditId, name)),
    setStatus: (name: string, status: DepartmentStatus) => awaited(() => setDepartmentStatus(db, user, auditId, name, status)),
    reassign: (name: string, to: { uid: string; name: string } | null) => awaited(() => reassignDepartment(db, user, auditId, name, to)),
    setAuditStatus: (status: AuditStatus) => awaited(() => setAuditStatus(db, user, auditId, status)),
    saveNotes: (notes: string) => awaited(() => saveAuditNotes(db, user, auditId, notes)),
    verify: async () => verifyIntegrity(await readCaptures(db, auditId), buckets),
  };
}
export type CloudAuditStore = ReturnType<typeof useCloudAudit>;
