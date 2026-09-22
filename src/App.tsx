import { useState, useEffect, useMemo } from 'react';
import { Camera, ListFilter, PieChart, FileSpreadsheet, Download, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Product, AuditStats } from './types';
import { BarcodeScanner } from './components/BarcodeScanner';
import { InventoryTable } from './components/InventoryTable';
import { AuditSummary } from './components/AuditSummary';
import { ExcelUploader } from './components/ExcelUploader';
import { ExportModal } from './components/ExportModal';
import { soundService } from './services/audioService';

const STORAGE_KEY = 'auditor_eleventa_products_v1';

export function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'scanner' | 'list' | 'stats' | 'upload'>('scanner');
  const [lastScannedInfo, setLastScannedInfo] = useState<{
    code: string;
    description: string;
    quantity: number;
    theoretical: number;
    isNew: boolean;
  } | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.warn('Error al guardar en almacenamiento local:', e);
    }
  }, [products]);

  useEffect(() => {
    if (products.length === 0) {
      setActiveTab('upload');
    }
  }, []);

  const stats: AuditStats = useMemo(() => {
    let totalPiecesTheoretical = 0;
    let totalPiecesPhysical = 0;
    let auditedCount = 0;
    let matchCount = 0;
    let missingCount = 0;
    let surplusCount = 0;
    let notCountedCount = 0;
    let unregisteredCount = 0;
    let totalMissingPieces = 0;
    let totalSurplusPieces = 0;
    let missingCostValue = 0;
    let surplusCostValue = 0;

    products.forEach((p) => {
      totalPiecesTheoretical += p.theoreticalStock;
      totalPiecesPhysical += p.physicalStock;

      if (p.isUnregistered) {
        unregisteredCount++;
      }

      if (p.physicalStock > 0) {
        auditedCount++;
      } else if (!p.isUnregistered) {
        notCountedCount++;
      }

      const diff = p.physicalStock - p.theoreticalStock;
      if (p.physicalStock > 0) {
        if (diff === 0) {
          matchCount++;
        } else if (diff < 0) {
          missingCount++;
          const missingPieces = Math.abs(diff);
          totalMissingPieces += missingPieces;
          missingCostValue += missingPieces * p.cost;
        } else {
          surplusCount++;
          totalSurplusPieces += diff;
          surplusCostValue += diff * p.cost;
        }
      }
    });

    return {
      totalCatalog: products.length,
      auditedCount,
      totalPiecesTheoretical,
      totalPiecesPhysical,
      totalMissingPieces,
      totalSurplusPieces,
      missingCostValue,
      surplusCostValue,
      matchCount,
      missingCount,
      surplusCount,
      notCountedCount,
      unregisteredCount,
    };
  }, [products]);

  const handleScan = (barcode: string, quantityToAdd = 1) => {
    const cleanCode = barcode.trim();
    if (!cleanCode) return;

    setProducts((prev) => {
      const index = prev.findIndex((p) => p.code === cleanCode);

      if (index !== -1) {
        const existing = prev[index];
        const newQty = existing.physicalStock + quantityToAdd;
        soundService.playScanBeep();

        setLastScannedInfo({
          code: existing.code,
          description: existing.description,
          quantity: newQty,
          theoretical: existing.theoreticalStock,
          isNew: false,
        });

        const updated = [...prev];
        updated[index] = {
          ...existing,
          physicalStock: newQty,
          lastScannedAt: new Date().toISOString(),
        };
        return updated;
      } else {
        soundService.playWarningBeep();

        const newProduct: Product = {
          code: cleanCode,
          description: `Producto no registrado (${cleanCode})`,
          cost: 0,
          price: 0,
          department: 'Sin Clasificar',
          theoreticalStock: 0,
          physicalStock: quantityToAdd,
          isUnregistered: true,
          lastScannedAt: new Date().toISOString(),
        };

        setLastScannedInfo({
          code: cleanCode,
          description: newProduct.description,
          quantity: quantityToAdd,
          theoretical: 0,
          isNew: true,
        });

        return [newProduct, ...prev];
      }
    });
  };

  const handleUpdateQuantity = (code: string, newQuantity: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, physicalStock: newQuantity } : p))
    );
  };

  const handleProductsLoaded = (newProducts: Product[]) => {
    setProducts(newProducts);
    setActiveTab('scanner');
  };

  const handleResetAudit = () => {
    if (window.confirm('¿Seguro que deseas reiniciar los conteos físicos a cero? El catálogo se mantendrá.')) {
      setProducts((prev) => prev.map((p) => ({ ...p, physicalStock: 0 })));
      setLastScannedInfo(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-900/40">
              e
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Auditor de Inventario</h1>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Compatible con eleventa
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {products.length > 0 && (
              <button
                onClick={() => setIsExportOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
            )}

            {products.length > 0 && (
              <button
                onClick={handleResetAudit}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Reiniciar conteo físico"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-xl mx-auto w-full pb-24">
        {activeTab === 'scanner' && (
          <div className="flex flex-col gap-4">
            {products.length === 0 ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
                <h3 className="text-base font-semibold text-white">No hay catálogo cargado</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Carga el archivo Excel de eleventa para iniciar el escaneo de tus productos.
                </p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Ir a Cargar Archivo
                </button>
              </div>
            ) : (
              <BarcodeScanner
                onScan={handleScan}
                lastScannedInfo={lastScannedInfo}
              />
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <InventoryTable
            products={products}
            onUpdateQuantity={handleUpdateQuantity}
          />
        )}

        {activeTab === 'stats' && <AuditSummary stats={stats} />}

        {activeTab === 'upload' && (
          <ExcelUploader
            onProductsLoaded={handleProductsLoaded}
            currentCount={products.length}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2 px-4 shadow-2xl">
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'scanner'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Escáner</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'list'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Lista ({stats.auditedCount}/{stats.totalCatalog})</span>
            {stats.missingCount > 0 && (
              <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Resumen</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">eleventa</span>
          </button>
        </div>
      </nav>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        products={products}
        stats={stats}
      />
    </div>
  );
}

export default App;
