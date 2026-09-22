import { lazy, Suspense, useMemo, useState } from 'react';
import { Camera, ListFilter, PieChart, FileSpreadsheet, Download, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Product } from './types';
import { InventoryTable } from './components/InventoryTable';
import { AuditSummary } from './components/AuditSummary';
import { InstallApp } from './components/InstallApp';
import { soundService } from './services/audioService';
import { calculateStats, roundQuantity, validQuantity } from './services/auditState';
import { useAuditStore } from './hooks/useAuditStore';
const BarcodeScanner = lazy(() => import('./components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const ExcelUploader = lazy(() => import('./components/ExcelUploader').then(m => ({ default: m.ExcelUploader })));
const ExportModal = lazy(() => import('./components/ExportModal').then(m => ({ default: m.ExportModal })));
const tabs = [{ id: 'scanner', title: 'Contar', icon: Camera }, { id: 'list', title: 'Inventario', icon: ListFilter }, { id: 'stats', title: 'Resumen', icon: PieChart }, { id: 'upload', title: 'Cargar archivo', icon: FileSpreadsheet }] as const;
type Tab = typeof tabs[number]['id'];
export function App() {
  const { products, productsRef, error, commit, backup } = useAuditStore();
  const [activeTab, setActiveTab] = useState<Tab>(() => products.length ? 'list' : 'upload');
  const [lastScannedInfo, setLastScannedInfo] = useState<{ code: string; description: string; quantity: number; theoretical: number; isNew: boolean } | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const stats = useMemo(() => calculateStats(products), [products]);
  const handleScan = (barcode: string, quantityToAdd = 1) => {
    const code = barcode.trim();
    if (!code || code.length > 128 || !validQuantity(quantityToAdd) || quantityToAdd === 0) { setNotice('Revisa el código y la cantidad.'); return; }
    const previous = productsRef.current.products;
    const existing = previous.find(p => p.code === code);
    const quantity = roundQuantity((existing?.physicalStock ?? 0) + quantityToAdd);
    if (!validQuantity(quantity)) { setNotice('La cantidad supera el límite permitido.'); return; }
    const product: Product = existing
      ? { ...existing, physicalStock: quantity, counted: true, lastScannedAt: new Date().toISOString() }
      : { code, description: `Producto no registrado (${code})`, cost: 0, price: 0, department: 'Sin clasificar', theoreticalStock: 0, physicalStock: quantity, isUnregistered: true, counted: true, lastScannedAt: new Date().toISOString() };
    if (!commit(existing ? previous.map(p => p.code === code ? product : p) : [product, ...previous])) return;
    setLastScannedInfo({ code, description: product.description, quantity, theoretical: product.theoreticalStock, isNew: Boolean(product.isUnregistered) });
    setNotice('');
    if (product.isUnregistered) soundService.playWarningBeep(); else soundService.playScanBeep();
  };
  const handleUpdateQuantity = (code: string, quantity: number) => {
    if (!validQuantity(quantity)) return;
    commit(productsRef.current.products.map(p => p.code === code ? { ...p, physicalStock: roundQuantity(quantity), counted: true } : p));
  };
  const handleProductsLoaded = (next: Product[]) => {
    if (error && !window.confirm('Hay un problema con el guardado actual. ¿Reemplazar el catálogo después de descargar tu respaldo?')) return;
    if (commit(next, true)) { setLastScannedInfo(null); setNotice(''); setActiveTab('list'); }
  };
  const reset = () => {
    if (window.confirm('¿Reiniciar todos los conteos? El catálogo se conserva. Exporta antes si necesitas los resultados.')) {
      if (commit(productsRef.current.products.map(p => ({ ...p, physicalStock: 0, counted: false, lastScannedAt: undefined })))) { setLastScannedInfo(null); setNotice('Conteos reiniciados.'); }
    }
  };
  return <div className="app-shell">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="app-header">
      <div className="brand"><span className="brand-icon" aria-hidden="true">e</span><div><h1>Auditor de Inventario</h1><p><ShieldCheck size={14} aria-hidden="true" /> Compatible con eleventa · Local</p></div></div>
      <div className="header-actions">
        <button className="secondary" onClick={backup} title="Descargar respaldo JSON">Respaldo</button>
        {products.length > 0 && <><button className="primary" onClick={() => setIsExportOpen(true)}><Download size={18} aria-hidden="true" /> Exportar</button><button className="secondary" onClick={reset} aria-label="Reiniciar conteo físico"><RotateCcw size={18} aria-hidden="true" /></button></>}
      </div>
    </header>
    <nav className="app-nav" aria-label="Navegación principal">
      {tabs.map(({ id, title, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span>{title}</span></button>)}
      <p className="desktop-only nav-note">En este dispositivo<br /><strong>{stats.auditedCount} de {stats.totalCatalog}</strong> productos contados</p>
    </nav>
    <main id="contenido" className="app-main" tabIndex={-1}>
      <div className="page-heading"><div><p className="eyebrow">AUDITORÍA LOCAL</p><h2>{tabs.find(t => t.id === activeTab)?.title}</h2></div><span className="count-badge">{stats.auditedCount} / {stats.totalCatalog} contados</span></div>
      {error && <div role="alert" className="message warning">{error} <button onClick={backup} className="secondary">Descargar respaldo</button></div>}
      {notice && <p role="status" className="message">{notice}</p>}
      <Suspense fallback={<p role="status" className="message">Cargando herramienta…</p>}>
        {activeTab === 'scanner' && (products.length ? <div className="count-layout"><BarcodeScanner onScan={handleScan} lastScannedInfo={lastScannedInfo} /><aside className="desktop-only"><AuditSummary stats={stats} /><p className="message">Escanea cada pieza o selecciona la cantidad por caja. En PC también puedes ingresar códigos con un lector USB.</p></aside></div> : <div className="empty-state"><h3>Carga tu catálogo para comenzar</h3><p>Importa el Excel de eleventa o un respaldo de esta aplicación.</p><button className="primary" onClick={() => setActiveTab('upload')}>Cargar archivo</button></div>)}
        {activeTab === 'list' && <InventoryTable products={products} onUpdateQuantity={handleUpdateQuantity} />}
        {activeTab === 'stats' && <AuditSummary stats={stats} />}
        {activeTab === 'upload' && <ExcelUploader onProductsLoaded={handleProductsLoaded} currentCount={products.length} />}
        {isExportOpen && <ExportModal isOpen onClose={() => setIsExportOpen(false)} products={products} stats={stats} />}
      </Suspense>
      <InstallApp />
    </main>
  </div>;
}
export default App;
