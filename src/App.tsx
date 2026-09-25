import { lazy, Suspense, useMemo, useState } from 'react';
import { RotateCcw, ShieldCheck, FileSpreadsheet, CheckCircle2, Shield, UserRound, KeyRound } from 'lucide-react';
import type { Product, CountMode } from './types';
import { InventoryTable } from './components/InventoryTable';
import { AuditContext } from './components/AuditContext';
import { AuditSummary } from './components/AuditSummary';
import { CompanyManager } from './components/CompanyManager';
import { MonthlyComparison } from './components/MonthlyComparison';
import { InstallApp } from './components/InstallApp';
import { BrandLogo } from './components/BrandLogo';
import { StoreIcon, TicketIcon, CardStockIcon, GearSettingsIcon } from './components/CustomIcons';
import { calculateStats } from './services/auditState';
import { PinAuthModal } from './components/PinAuthModal';
import { DepartmentSummary } from './components/DepartmentSummary';
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
  const isAdmin = store.role === 'admin';
  const [pinMode, setPinMode] = useState<'unlock' | 'change' | null>(null);
  const [notice, setNotice] = useState('');
  const stats = useMemo(() => calculateStats(products), [products]);

  const handleScan = async (barcode: string, quantity = 1, mode: CountMode = 'add') => {
    if (busy || readOnly) { setNotice('Espera a que termine el guardado o abre una auditoría en curso.'); return null; }
    const product = await store.recordCount(barcode, quantity, mode, store.scannerPreferences.activeZoneDepartment);
    if (!product) return null;
    setLastScannedInfo({ code: product.code, description: product.description, quantity: product.physicalStock, theoretical: product.theoreticalStock, isNew: Boolean(product.isUnregistered) });
    setNotice(''); return product;
  };
  const handleUpdateQuantity = async (code: string, quantity: number) => {
    const product = await store.recordCount(code, quantity, 'set');
    if (product && lastScannedInfo?.code === code) setLastScannedInfo({ code, description: product.description, quantity: product.physicalStock, theoretical: product.theoreticalStock, isNew: Boolean(product.isUnregistered) });
    return Boolean(product);
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
      {pinMode && <PinAuthModal mode={pinMode} onClose={() => setPinMode(null)} unlock={store.unlockAdmin} changePin={store.changePin} />}
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
          <button className="secondary role-toggle" disabled={busy || !data} onClick={() => { if (isAdmin) { store.lockAdmin(); setActiveTab(current => current === 'upload' ? 'list' : current); setIsExportOpen(false); } else setPinMode('unlock'); }}>
            {isAdmin ? <Shield size={17} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />}{isAdmin ? 'Administrador · Bloquear' : 'Auditor · Acceso admin'}
          </button>
          {isAdmin && <button className="secondary" disabled={busy} onClick={() => setPinMode('change')}><KeyRound size={16} aria-hidden="true" /> Cambiar PIN</button>}
          <button className="secondary" onClick={backup} title="Descargar respaldo JSON">
            Respaldo
          </button>
          {isAdmin && products.length > 0 && (
            <>
              <button
                className="primary finish-audit-btn"
                onClick={() => setIsExportOpen(true)}
                title="Terminar auditoría y generar dictamen oficial"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Terminar Auditoría</span>
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
      <nav data-role={store.role} className="app-nav" aria-label="Navegación principal">
        {tabs.filter(t => isAdmin || t.id !== 'upload').map(({ id, title, icon: IconComponent }) => {
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
        {store.backupDownload && (
          <p role="status" className="message">
            Si tu navegador no inició la descarga automática: <a href={store.backupDownload.url} download={store.backupDownload.fileName} className="underline text-[#FF6E42] font-bold">Guardar {store.backupDownload.fileName}</a>
          </p>
        )}
        {busy && <p role="status" className="message">Guardando en este dispositivo…</p>}
        {activeAudit && activeTab !== 'companies' && <AuditContext
          key={activeAudit.id} audit={activeAudit} companyName={company?.name}
          busy={busy} pendingCount={stats.notCountedCount} updateAudit={store.updateAudit}
          canManage={isAdmin} onFinish={isAdmin ? () => setIsExportOpen(true) : undefined}
        />}

        <Suspense fallback={<p role="status" className="message">Cargando herramienta…</p>}>
          {activeTab === 'companies' && <CompanyManager key={data?.activeCompanyId} store={store} onOpen={() => { setLastScannedInfo(null); setActiveTab('list'); }} />}
          {activeTab === 'scanner' && (
            products.length && !readOnly ? (
              <div className="count-layout">
                <BarcodeScanner onScan={handleScan} lastScannedInfo={lastScannedInfo} products={products} preferences={store.scannerPreferences}
                  onPreferencesChange={store.saveScannerPreferences} saving={busy} canUndo={store.canUndo} onUndo={async () => { const saved = await store.undoCount(); if (saved) setLastScannedInfo(null); return saved; }} />
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
            <InventoryTable products={products} onUpdateQuantity={handleUpdateQuantity} readOnly={busy || readOnly} isAdmin={isAdmin} onUpdateProduct={store.updateProduct} />
          )}

          {activeTab === 'stats' && <><DepartmentSummary products={products} /><AuditSummary stats={stats} products={products} />{activeAudit && data && <MonthlyComparison current={activeAudit} audits={data.audits} />}</>}

          {activeTab === 'upload' && isAdmin && (
            <fieldset className="workspace-fields" disabled={busy || readOnly}>
              {readOnly && <p className="message">Abre una auditoría en curso desde Clientes para importar su catálogo.</p>}
              <ExcelUploader onProductsLoaded={handleProductsLoaded} currentCount={products.length} />
            </fieldset>
          )}

          {isExportOpen && isAdmin && (
            <ExportModal isOpen onClose={() => setIsExportOpen(false)} products={products} stats={stats} company={company} audit={activeAudit} profile={data?.profile} />
          )}
        </Suspense>

        <InstallApp />
      </main>
    </div>
  );
}

export default App;
