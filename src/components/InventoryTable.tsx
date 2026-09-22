import React, { useState, useMemo } from 'react';
import { Search, Plus, Minus, CheckCircle, PackageSearch } from 'lucide-react';
import type { Product, ProductFilter } from '../types';

interface InventoryTableProps {
  products: Product[];
  onUpdateQuantity: (code: string, newQuantity: number) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ products, onUpdateQuantity }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState<ProductFilter>('all');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [tempQty, setTempQty] = useState<string>('');

  const departments = useMemo(() => {
    const depts = new Set(products.map(p => p.department).filter(Boolean));
    return ['ALL', ...Array.from(depts)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = selectedDept === 'ALL' || p.department === selectedDept;

      const diff = p.physicalStock - p.theoreticalStock;
      let matchesStatus = true;

      if (activeFilter === 'missing') {
        matchesStatus = diff < 0 && p.physicalStock > 0;
      } else if (activeFilter === 'surplus') {
        matchesStatus = diff > 0;
      } else if (activeFilter === 'match') {
        matchesStatus = diff === 0 && p.physicalStock > 0;
      } else if (activeFilter === 'not_counted') {
        matchesStatus = p.physicalStock === 0 && !p.isUnregistered;
      } else if (activeFilter === 'unregistered') {
        matchesStatus = !!p.isUnregistered;
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [products, searchTerm, selectedDept, activeFilter]);

  const handleStartEdit = (p: Product) => {
    setEditingCode(p.code);
    setTempQty(String(p.physicalStock));
  };

  const handleSaveEdit = (code: string) => {
    const val = parseInt(tempQty, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateQuantity(code, val);
    }
    setEditingCode(null);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-xl mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por producto o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs rounded-xl py-2.5 pl-9 pr-3 outline-none focus:border-emerald-500"
          />
        </div>

        {departments.length > 2 && (
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl py-2.5 px-3 outline-none focus:border-emerald-500"
            >
              {departments.map(d => (
                <option key={d} value={d}>{d === 'ALL' ? 'Todos los Deptos' : d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'missing', label: 'Faltantes' },
          { id: 'surplus', label: 'Sobrantes' },
          { id: 'match', label: 'Cuadrados' },
          { id: 'not_counted', label: 'Sin Contar' },
          { id: 'unregistered', label: 'Nuevos' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as ProductFilter)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filteredProducts.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <PackageSearch className="w-8 h-8 text-slate-500" />
            <p className="text-sm">No se encontraron productos con estos filtros.</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const diff = product.physicalStock - product.theoreticalStock;
            const hasDiscrepancy = product.physicalStock > 0 && diff !== 0;
            const isMatch = product.physicalStock > 0 && diff === 0;
            const isNotCounted = product.physicalStock === 0 && !product.isUnregistered;

            return (
              <div
                key={product.code}
                className={`p-3.5 rounded-xl border transition-all ${
                  diff < 0 && product.physicalStock > 0
                    ? 'bg-red-950/15 border-red-900/40'
                    : diff > 0
                    ? 'bg-blue-950/15 border-blue-900/40'
                    : isMatch
                    ? 'bg-emerald-950/15 border-emerald-900/40'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400">{product.code}</span>
                      {product.department && (
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                          {product.department}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                      {product.description}
                    </h4>

                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="text-slate-400">
                        eleventa: <strong className="text-slate-200">{product.theoreticalStock}</strong>
                      </span>
                      <span className="text-slate-400">
                        Costo: <strong className="text-slate-200">${product.cost.toFixed(2)}</strong>
                      </span>
                      {hasDiscrepancy && (
                        <span className={`font-semibold ${diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {diff < 0 ? `Merma: $${(Math.abs(diff) * product.cost).toFixed(2)}` : `Sobrante: +$${(diff * product.cost).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {diff < 0 && product.physicalStock > 0 && (
                      <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 text-[11px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                        {diff} pzas
                      </span>
                    )}
                    {diff > 0 && (
                      <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded border border-blue-500/30">
                        +{diff} pzas
                      </span>
                    )}
                    {isMatch && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3" /> Exacto
                      </span>
                    )}
                    {isNotCounted && (
                      <span className="bg-slate-800 text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded">
                        Sin contar
                      </span>
                    )}
                    {product.isUnregistered && (
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                        Nuevo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium">Conteo físico:</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(product.code, Math.max(0, product.physicalStock - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    {editingCode === product.code ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(product.code); }} className="flex items-center">
                        <input
                          type="number"
                          autoFocus
                          value={tempQty}
                          onChange={(e) => setTempQty(e.target.value)}
                          onBlur={() => handleSaveEdit(product.code)}
                          className="w-14 text-center bg-slate-950 border border-emerald-500 rounded-lg py-1 text-sm font-bold text-white outline-none"
                        />
                      </form>
                    ) : (
                      <div
                        onClick={() => handleStartEdit(product)}
                        className="w-14 text-center bg-slate-950/80 hover:bg-slate-900 border border-slate-700 rounded-lg py-1 text-base font-bold text-emerald-400 cursor-pointer"
                        title="Toca para editar cantidad directamente"
                      >
                        {product.physicalStock}
                      </div>
                    )}

                    <button
                      onClick={() => onUpdateQuantity(product.code, product.physicalStock + 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
