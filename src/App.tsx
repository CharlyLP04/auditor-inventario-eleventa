import { lazy, Suspense, useMemo, useState } from 'react';
import { Download, RotateCcw, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import type { Product } from './types';
import { InventoryTable } from './components/InventoryTable';
import { AuditSummary } from './components/AuditSummary';
import { CompanyManager } from './components/CompanyManager';
import { MonthlyComparison } from './components/MonthlyComparison';
import { InstallApp } from './components/InstallApp';
import { BrandLogo } from './components/BrandLogo';
import { StoreIcon, TicketIcon, CardStockIcon, GearSettingsIcon } from './components/CustomIcons';
import { soundService } from './services/audioService';
import { calculateStats, roundQuantity, validQuantity } from './services/auditState';
import { useAuditStore } from './hooks/useAuditStore';

const BarcodeScanner = lazy(() => import('./components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const ExcelUploader = lazy(() => import('./components/ExcelUploader').then(m => ({ default: m.ExcelUploader })));
const ExportModal = lazy(() => import('./components/ExportModal').then(m => ({ default: m.ExportModal })));

function ClientsIcon({ size = 22, solid = false }: { size?: number; solid?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={solid ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></svg>;
}
const tabs = [
  { id: 'companies', title: 'Clientes', icon: ClientsIcon },
  { id: 'scanner', title: 'Contar', icon: StoreIcon },
  { id: 'list', title: 'Auditoría', icon: TicketIcon },
  { id: 'stats', title: 'Balance', icon: CardStockIcon },
  { id: 'upload', title: 'eleventa', icon: GearSettingsIcon },
] as const;

type Tab = typeof tabs[number]['id'];

export function App() {
  const store = useAuditStore();
  const { products, productsRef, error, commit, backup, activeAudit, data, busy } = store;
  const company = data?.companies.find(c => c.id === data?.activeCompanyId);
  const readOnly = !activeAudit || activeAudit.status !== 'in_progress';
  const [activeTab, setActiveTab] = useState<Tab>('companies');
  const [lastScannedInfo, setLastScannedInfo] = useState<{ code: string; description: string; quantity: number; theoretical: number; isNew: boolean } | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const stats = useMemo(() => calculateStats(products), [products]);

  const handleScan = async (barcode: string, quantityToAdd = 1) => {
    if (busy || readOnly) { setNotice('Espera a que termine el guardado o abre una auditoría en curso.'); return; }
    const code = barcode.trim();
    if (!code || code.length > 128 || !validQuantity(quantityToAdd) || quantityToAdd === 0) {
      setNotice('Revisa el código y la cantidad.');
      return;
    }
    const previous = productsRef.current.products;
    const existing = previous.find(p => p.code === code);
    const quantity = roundQuantity((existing?.physicalStock ?? 0) + quantityToAdd);
    if (!validQuantity(quantity)) {
      setNotice('La cantidad supera el límite permitido.');
      return;
    }
    const product: Product = existing
      ? { ...existing, physicalStock: quantity, counted: true, lastScannedAt: new Date().toISOString() }
      : { code, description: `Producto no registrado (${code})`, cost: 0, price: 0, department: 'Sin clasificar', theoreticalStock: 0, physicalStock: quantity, isUnregistered: true, counted: true, lastScannedAt: new Date().toISOString() };

    if (!await commit(existing ? previous.map(p => p.code === code ? product : p) : [product, ...previous])) return;
    setLastScannedInfo({ code, description: product.description, quantity, theoretical: product.theoreticalStock, isNew: Boolean(product.isUnregistered) });
    setNotice('');
    if (product.isUnregistered) soundService.playWarningBeep(); else soundService.playScanBeep();
  };

  const handleUpdateQuantity = async (code: string, quantity: number) => {
    if (!validQuantity(quantity)) return;
    await commit(productsRef.current.products.map(p => p.code === code ? { ...p, physicalStock: roundQuantity(quantity), counted: true } : p));
  };

  const handleProductsLoaded = async (next: Product[]) => {
    if (error && !window.confirm('Hay un problema con el guardado actual. ¿Reemplazar el catálogo después de descargar tu respaldo?')) return;
    if (await commit(next, true)) {
      setLastScannedInfo(null);
      setNotice('');
      setActiveTab('list');
    }
  };

  const reset = async () => {
    if (window.confirm('¿Reiniciar todos los conteos? El catálogo se conserva. Exporta antes si necesitas los resultados.')) {
      if (await commit(productsRef.current.products.map(p => ({ ...p, physicalStock: 0, counted: false, lastScannedAt: undefined })))) {
        setLastScannedInfo(null);
        setNotice('Conteos reiniciados.');
      }
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      
      {/* Header con el nuevo BrandLogo vectorial y estética Obsidian */}
      <header className="app-header">
        <div className="brand">
          <BrandLogo size={44} />
          <div>
            <h1>Auditor eleventa</h1>
            <p><ShieldCheck size={13} aria-hidden="true" /> Inventario Físico · Alta Precisión</p>
          </div>
        </div>

        <label className="company-selector">Empresa activa
          <select disabled={busy || !data} value={company?.id ?? ''} onChange={async e => {
            const companyId = e.target.value;
            const latest = data?.audits.filter(a => a.companyId === companyId).sort((a, b) => b.period.localeCompare(a.period))[0];
            if (await store.selectCompany(companyId)) { setLastScannedInfo(null); setNotice(''); setActiveTab(latest ? 'list' : 'companies'); }
          }}><option value="" disabled>Selecciona empresa</option>{data?.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        </label>
        <div className="header-actions">
          <button className="secondary" onClick={backup} title="Descargar respaldo JSON">
            Respaldo
          </button>
          {store.backupDownload && <a className="secondary download-fallback" href={store.backupDownload.url} download={store.backupDownload.fileName}>Guardar respaldo</a>}
          {products.length > 0 && (
            <>
              <button className="primary" onClick={() => setIsExportOpen(true)}>
                <Download size={16} aria-hidden="true" />
                <span>Exportar</span>
              </button>
              <button
                className="secondary p-2.5 rounded-full"
                disabled={busy || readOnly}
                onClick={reset}
                aria-label="Reiniciar conteo físico"
                title="Reiniciar conteos"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Floating Pill Dock inferior con íconos personalizados de doble estado */}
      <nav className="app-nav" aria-label="Navegación principal">
        {tabs.map(({ id, title, icon: IconComponent }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative group cursor-pointer"
            >
              <IconComponent size={22} solid={isActive} aria-hidden="true" />
              <span>{title}</span>
            </button>
          );
        })}
        <p className="desktop-only nav-note">
          Conteo actual:<br />
          <strong>{stats.auditedCount} de {stats.totalCatalog}</strong> productos
        </p>
      </nav>

      {/* Área principal */}
      <main key={activeAudit?.id ?? "no-audit"} id="contenido" className="app-main animate-card-pop" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{activeTab === 'companies' ? 'RELACIONES QUE CRECEN' : 'AUDITORÍA ACTIVA'}</p>
            <h2>{tabs.find(t => t.id === activeTab)?.title}</h2>
          </div>
          {activeTab !== 'companies' && <span className="count-badge">
            {stats.auditedCount} / {stats.totalCatalog} contados
          </span>}
        </div>

        {error && (
          <div role="alert" className="message warning">
            {error} <button onClick={backup} className="secondary ml-2">Descargar respaldo</button>
          </div>
        )}
        
        {notice && <p role="status" className="message">{notice}</p>}
        {busy && <p role="status" className="message">Guardando en este dispositivo…</p>}
        {activeAudit && activeTab !== 'companies' && <section className="workspace-card audit-context">
          <h3>{company?.name} · {activeAudit.title}</h3>
          <label>Estado de auditoría<select disabled={busy} value={activeAudit.status} onChange={e => {
            const status = e.target.value as typeof activeAudit.status;
            if (status !== 'in_progress' && !window.confirm(`¿Finalizar esta auditoría? Quedan ${stats.notCountedCount} productos pendientes. El conteo quedará en modo lectura y podrás reabrirlo.`)) return;
            void store.updateAudit(activeAudit.id, { status, notes: activeAudit.notes });
          }}><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="closed">Cerrada</option></select></label>
          <form key={`${activeAudit.id}-${activeAudit.notes ?? ''}`} onSubmit={e => { e.preventDefault(); const fields = new FormData(e.currentTarget); void store.updateAudit(activeAudit.id, { status: activeAudit.status, notes: String(fields.get('notes') ?? '') }); }}>
            <label>Hallazgos / notas<textarea name="notes" defaultValue={activeAudit.notes} maxLength={10000} disabled={busy || readOnly} /></label><button className="secondary" disabled={busy || readOnly}>Guardar notas</button>
          </form>
          {readOnly && <p>Auditoría en modo lectura. Cambia el estado a En curso para editar.</p>}
        </section>}

        <Suspense fallback={<p role="status" className="message">Cargando herramienta…</p>}>
          {activeTab === 'companies' && <CompanyManager key={data?.activeCompanyId} store={store} onOpen={() => { setLastScannedInfo(null); setActiveTab('list'); }} />}
          {activeTab === 'scanner' && (
            products.length && !readOnly ? (
              <div className="count-layout">
                <BarcodeScanner onScan={handleScan} lastScannedInfo={lastScannedInfo} />
                <aside className="desktop-only">
                  <AuditSummary stats={stats} products={products} />
                  <p className="message mt-4">
                    Escanea cada pieza o selecciona la cantidad por caja. En PC también puedes ingresar códigos con un lector USB o Bluetooth.
                  </p>
                </aside>
              </div>
            ) : (
              <div className="empty-state max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-[#B38F6F]/20 text-[#B38F6F] flex items-center justify-center mx-auto mb-4 border border-[#B38F6F]/30">
                  <FileSpreadsheet size={30} />
                </div>
                <h3>{readOnly ? "Abre una auditoría en curso" : "Carga tu catálogo para comenzar"}</h3>
                <p>Importa el archivo Excel de eleventa para iniciar el conteo físico en tienda.</p>
                <button className="primary" onClick={() => setActiveTab(readOnly ? 'companies' : 'upload')}>
                  {readOnly ? "Ir a Clientes" : "Cargar archivo"}
                </button>
              </div>
            )
          )}

          {activeTab === 'list' && (
            <InventoryTable products={products} onUpdateQuantity={handleUpdateQuantity} readOnly={busy || readOnly} />
          )}

          {activeTab === 'stats' && <><AuditSummary stats={stats} products={products} />{activeAudit && data && <MonthlyComparison current={activeAudit} audits={data.audits} />}</>}

          {activeTab === 'upload' && (
            <fieldset className="workspace-fields" disabled={busy || readOnly}>
              {readOnly && <p className="message">Abre una auditoría en curso desde Clientes para importar su catálogo.</p>}
              <ExcelUploader onProductsLoaded={handleProductsLoaded} currentCount={products.length} />
            </fieldset>
          )}

          {isExportOpen && (
            <ExportModal isOpen onClose={() => setIsExportOpen(false)} products={products} stats={stats} company={company} audit={activeAudit} profile={data?.profile} />
          )}
        </Suspense>

        <InstallApp />
      </main>
    </div>
  );
}

export default App;
