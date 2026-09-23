import { useRef, useState } from 'react';
import { Building2, ChevronDown, NotebookPen, Save, Check, LockKeyhole } from 'lucide-react';
import type { AuditRecord } from '../types';

interface Props {
  audit: AuditRecord;
  companyName?: string;
  busy: boolean;
  pendingCount: number;
  updateAudit: (id: string, patch: Pick<AuditRecord, 'status' | 'notes'>) => Promise<boolean>;
}

export function AuditContext({ audit, companyName, busy, pendingCount, updateAudit }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const notes = draft ?? audit.notes ?? '';
  const dirty = notes !== (audit.notes ?? '');
  const readOnly = audit.status !== 'in_progress';
  const closeEditor = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return <section className="audit-ribbon" aria-label="Auditoría activa">
    <div className="audit-ribbon-heading">
      <span className="audit-ribbon-icon"><Building2 size={19} aria-hidden="true" /></span>
      <div><strong>{companyName || 'Empresa'}</strong><span>{audit.title}</span></div>
    </div>
    <label className={`audit-status-pill status-${audit.status}`}>
      <span className="audit-status-dot" aria-hidden="true" />
      <span className="sr-only">Estado de auditoría</span>
      <select disabled={busy || dirty} title={dirty ? 'Guarda o descarta las notas antes de cambiar el estado' : 'Cambiar estado de auditoría'} value={audit.status} onChange={async e => {
        const status = e.target.value as AuditRecord['status'];
        if (status !== 'in_progress' && !window.confirm(`¿Finalizar esta auditoría? Quedan ${pendingCount} productos pendientes. El conteo quedará en modo lectura y podrás reabrirlo.`)) return;
        await updateAudit(audit.id, { status, notes: audit.notes });
      }}><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="closed">Cerrada</option></select>
    </label>
    <>
      <button type="button" ref={trigger} className="audit-notes-trigger" aria-expanded={open} aria-controls={`notes-panel-${audit.id}`} onClick={() => setOpen(value => !value)}>
        <NotebookPen size={17} aria-hidden="true" /><span>{dirty ? 'Notas · sin guardar' : 'Notas'}</span>
        {Boolean(audit.notes?.trim()) && !dirty && <span className="notes-saved-mark" aria-label="Con notas guardadas"><Check size={12} aria-hidden="true" /></span>}
        <ChevronDown size={15} className="notes-chevron" aria-hidden="true" />
      </button>
      <form id={`notes-panel-${audit.id}`} hidden={!open} className="audit-notes-editor" onSubmit={async e => {
        e.preventDefault();
        if (busy || readOnly) return;
        setFeedback('');
        if (await updateAudit(audit.id, { status: audit.status, notes })) {
          setDraft(null); setFeedback('Notas guardadas.'); closeEditor();
        } else setFeedback('No se guardaron las notas. Tu texto sigue aquí para volver a intentarlo.');
      }}>
        <div className="audit-notes-heading"><span className="audit-notes-icon"><NotebookPen size={20} aria-hidden="true" /></span><div><h3>Lo que el conteo no cuenta.</h3><p>Hallazgos y observaciones que aparecerán en el dictamen.</p></div></div>
        <label className="sr-only" htmlFor={`audit-notes-${audit.id}`}>Hallazgos y notas de la auditoría</label>
        <textarea id={`audit-notes-${audit.id}`} name="notes" value={notes} onChange={e => { setDraft(e.target.value); setFeedback(''); }} maxLength={10000} readOnly={readOnly} disabled={busy} placeholder="Ej. Revisar productos sin etiqueta en bodega. Confirmar las diferencias con el encargado…" />
        <div className="audit-notes-footer">
          <span>{readOnly ? <><LockKeyhole size={13} aria-hidden="true" /> Solo lectura</> : dirty ? 'Cambios sin guardar' : 'Observaciones de esta auditoría'}<small>{notes.length.toLocaleString('es-MX')} / 10,000</small></span>
          <div><button type="button" className="notes-cancel" disabled={busy} onClick={() => { setDraft(null); setFeedback(''); closeEditor(); }}>{dirty ? 'Descartar' : 'Cerrar'}</button>
          {!readOnly && <button type="submit" className="primary notes-save" disabled={busy || !dirty}><Save size={15} aria-hidden="true" />{busy ? 'Guardando…' : 'Guardar notas'}</button>}</div>
        </div>
      </form>
    </>
    {feedback && <p role="status" className="audit-notes-feedback">{feedback}</p>}
  </section>;
}
