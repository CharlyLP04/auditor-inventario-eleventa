import React, { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, CheckCircle, Package, AlertTriangle, PieChart, ShieldCheck } from 'lucide-react';
import type { AuditStats, Product } from '../types';
import { isCounted, productStatus, roundQuantity } from '../services/auditState';

interface AuditSummaryProps {
  stats: AuditStats;
  products?: Product[];
}

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export const AuditSummary: React.FC<AuditSummaryProps> = ({ stats, products = [] }) => {
  const [selectedMode, setSelectedMode] = useState<'sale' | 'cost' | null>(null);
  // El precio de venta es la referencia principal; el costo queda disponible como consulta.
  const mode = selectedMode ?? 'sale';
  const missingValue = mode === 'sale' ? stats.missingSaleValue : stats.missingCostValue;
  const surplusValue = mode === 'sale' ? stats.surplusSaleValue : stats.surplusCostValue;
  const percentage = stats.totalCatalog > 0 
    ? Math.min(100, Math.round((stats.auditedCount / stats.totalCatalog) * 100))
    : 0;

  // Cálculo de valor financiero teórico vs físico
  const { theoreticalValue, physicalValue, catalogValue } = useMemo(() => {
    let theo = 0;
    let phys = 0;
    let catalogValue = 0;
    products.forEach(p => {
      if (p.isUnregistered || p.excludedAt || p.linkedTo) return;
      catalogValue += p.theoreticalStock * (mode === 'sale' ? p.price : p.cost);
      if (isCounted(p)) {
        theo += p.theoreticalStock * (mode === 'sale' ? p.price : p.cost);
        phys += p.physicalStock * (mode === 'sale' ? p.price : p.cost);
      }
    });
    return { theoreticalValue: theo, physicalValue: phys, catalogValue };
  }, [products, mode]);

  const netBalance = roundQuantity(surplusValue - missingValue);
  const countedRegistered = stats.matchCount + stats.missingCount + stats.surplusCount;
  const accuracyRate = countedRegistered > 0
    ? Math.round((stats.matchCount / countedRegistered) * 100)
    : null;
  const zeroCostCount = mode === 'cost' ? products.filter(p => !p.isUnregistered && p.cost === 0).length : 0;

  // Top 4 mermas más costosas
  const topLosses = useMemo(() => {
    return products
      .filter(p => isCounted(p) && productStatus(p) === 'missing' && (mode === 'sale' ? p.price : p.cost) > 0)
      .map(p => {
        const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
        const lossAmount = Math.abs(diff) * (mode === 'sale' ? p.price : p.cost);
        return { ...p, diff, lossAmount };
      })
      .sort((a, b) => b.lossAmount - a.lossAmount)
      .slice(0, 4);
  }, [products, mode]);

  return (
    <div className="summary-panel flex flex-col gap-6 w-full max-w-5xl mx-auto animate-card-pop">
      <div className="filter-bar" aria-label="Modo de valoración">
        <button aria-pressed={mode === 'sale'} onClick={() => setSelectedMode('sale')}>Precio de venta</button>
        <button aria-pressed={mode === 'cost'} onClick={() => setSelectedMode('cost')}>Costo (referencia)</button>
      </div>
      {/* 1. Tarjeta Hero: Balance Financiero Ejecutivo */}
      <div className="relative bg-gradient-to-br from-[var(--app-surface)] via-[var(--app-surface)] to-[var(--app-bg)] border border-white/15 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[var(--app-accent)]/10 via-[var(--app-muted)]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-[var(--app-muted)] uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-[var(--app-accent)]" />
              Estado Financiero de Inventario
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-[var(--app-pearl)] tracking-tight mt-1">
              Balance y Valoración
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-[var(--app-bg)] border border-white/10 text-right">
              <span className="text-[0.75rem] text-[var(--app-muted)] uppercase font-bold tracking-wider block">Precisión</span>
              <span className="text-sm font-black text-[var(--app-pearl)]">{accuracyRate === null ? 'Sin conteo' : `${accuracyRate}% coinciden`}</span>
            </div>
          </div>
        </div>

        {/* Cifras de Valoración Teórica vs Física */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
          <div className="bg-[var(--app-bg)]/60 border border-white/5 rounded-2xl p-4">
            <span className="text-xs text-[var(--app-muted)] font-bold uppercase tracking-wider block">Teórico de lo auditado</span>
            <div className="text-xl sm:text-2xl font-black text-[var(--app-pearl)] mt-1">
              {money.format(theoreticalValue)}
            </div>
            <span className="text-[0.75rem] text-[var(--app-muted)] mt-0.5 block">Catálogo completo: {money.format(catalogValue)}</span>
          </div>

          <div className="bg-[var(--app-bg)]/60 border border-white/5 rounded-2xl p-4">
            <span className="text-xs text-[var(--app-muted)] font-bold uppercase tracking-wider block">Valor Físico Contado</span>
            <div className="text-xl sm:text-2xl font-black text-[var(--app-accent)] mt-1">
              {money.format(physicalValue)}
            </div>
            <span className="text-[0.75rem] text-[var(--app-muted)] mt-0.5 block">Solo productos auditados del catálogo</span>
          </div>

          <div className={`rounded-2xl p-4 border ${
            netBalance < 0
              ? 'bg-[var(--app-danger-bg)]/30 border-[var(--app-danger-bg)]'
              : netBalance > 0
              ? 'bg-[var(--app-surplus-bg)]/30 border-[var(--app-surplus-bg)]'
              : 'bg-[var(--app-bg)]/60 border-white/5'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider block text-[var(--app-pearl)]/80">Diferencia neta {mode === 'sale' ? 'a venta' : 'al costo'}</span>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${
              netBalance < 0 ? 'text-[var(--app-danger)]' : netBalance > 0 ? 'text-[var(--app-surplus)]' : 'text-[var(--app-pearl)]'
            }`}>
              {netBalance >= 0 ? '+' : ''}{money.format(netBalance)}
            </div>
            <span className="text-[0.75rem] text-[var(--app-pearl)]/70 mt-0.5 block">
              {netBalance < 0 ? 'Faltante neto valorado' : netBalance > 0 ? 'Sobrante neto valorado' : 'Sin diferencia neta valorada'}
            </span>
          </div>
        </div>
      </div>

      {zeroCostCount > 0 && (
        <p className="message warning" role="status">
          {zeroCostCount} productos del catálogo tienen costo en cero. La vista PVP usa el precio de venta de todos los artículos; la vista al costo deja estos artículos sin valoración. Los importes corresponden a productos contados y no representan movimientos de caja.
        </p>
      )}

      {/* 2. Tarjetas Swatch Principales: Faltantes vs Sobrantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Faltantes / Merma en Crimson Depth */}
        <div className="bg-gradient-to-br from-[var(--app-danger-bg)] to-[var(--app-danger-bg)] border border-white/15 rounded-[28px] p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--app-pearl)]/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-black/25 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-[var(--app-pearl)]" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">Faltantes (Merma)</span>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-black/30 text-[var(--app-pearl)]">
              {stats.missingCount} productos
            </span>
          </div>
          <div className="mt-5">
            <div className="text-3xl sm:text-4xl font-black text-[var(--app-pearl)] tracking-tight">
              -${missingValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-[var(--app-pearl)]/80 font-bold mt-2 leading-relaxed">
              {stats.totalMissingPieces} unidades faltantes respecto a los registros de eleventa.
            </p>
          </div>
        </div>

        {/* Sobrantes en Petrol Blue */}
        <div className="bg-gradient-to-br from-[var(--app-surplus-bg)] to-[#00344d] border border-white/15 rounded-[28px] p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--app-pearl)]/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-black/25 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[var(--app-pearl)]" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">Sobrantes</span>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-black/30 text-[var(--app-pearl)]">
              {stats.surplusCount} productos
            </span>
          </div>
          <div className="mt-5">
            <div className="text-3xl sm:text-4xl font-black text-[var(--app-pearl)] tracking-tight">
              +${surplusValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-[var(--app-pearl)]/80 font-bold mt-2 leading-relaxed">
              {stats.totalSurplusPieces} piezas por encima de la existencia de productos registrados. Los códigos nuevos se muestran por separado.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Barra de Progreso y Métricas de Auditoría */}
      <div className="bg-[var(--app-surface)] border border-white/10 rounded-[28px] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <span className="text-xs font-black text-[var(--app-muted)] uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[var(--app-accent)]" />
              Avance Global del Inventario
            </span>
            <p className="text-xs text-[var(--app-muted)] mt-0.5">Porcentaje de catálogo auditado físicamente en tienda</p>
          </div>
          <div className="text-right">
            <span className="font-mono font-black text-2xl text-[var(--app-pearl)]">{percentage}%</span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Avance de auditoría"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="w-full h-4 bg-[var(--app-bg)] rounded-full overflow-hidden p-0.5 border border-white/5"
        >
          <div
            className="h-full bg-gradient-to-r from-[var(--app-muted)] via-[var(--app-accent)] to-[var(--app-accent-hover)] rounded-full transition-all duration-700 ease-out shadow-lg"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* 4 Indicadores Rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-[var(--app-bg)] p-3.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[0.75rem] font-bold text-[var(--app-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-[var(--app-muted)]" /> Cuadrados
            </span>
            <div className="text-xl font-black text-[var(--app-pearl)] mt-1">{stats.matchCount}</div>
            <span className="text-[0.75rem] text-[var(--app-muted)] font-semibold">100% exactos</span>
          </div>

          <div className="bg-[var(--app-bg)] p-3.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[0.75rem] font-bold text-[var(--app-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
              <Package className="w-3.5 h-3.5 text-[var(--app-accent)]" /> Piezas Contadas
            </span>
            <div className="text-xl font-black text-[var(--app-accent)] mt-1">{stats.totalPiecesPhysical}</div>
            <span className="text-[0.75rem] text-[var(--app-muted)] font-semibold">de {stats.totalPiecesTheoretical} teóricas</span>
          </div>

          <div className="bg-[var(--app-bg)] p-3.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[0.75rem] font-bold text-[var(--app-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--app-muted)]" /> Sin Contar
            </span>
            <div className="text-xl font-black text-[var(--app-pearl)] mt-1">{stats.notCountedCount}</div>
            <span className="text-[0.75rem] text-[var(--app-muted)] font-semibold">artículos pendientes</span>
          </div>

          <div className="bg-[var(--app-bg)] p-3.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[0.75rem] font-bold text-[var(--app-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--app-accent)]" /> Nuevos
            </span>
            <div className="text-xl font-black text-[var(--app-accent)] mt-1">{stats.unregisteredCount}</div>
            <span className="text-[0.75rem] text-[var(--app-muted)] font-semibold">no en catálogo</span>
          </div>
        </div>
      </div>

      {/* 4. Top Mermas Críticas (si existen pérdidas registradas) */}
      {topLosses.length > 0 && (
        <div className="bg-[var(--app-surface)] border border-white/10 rounded-[28px] p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h4 className="text-sm font-black text-[var(--app-pearl)] uppercase tracking-wider flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[var(--app-danger)]" />
                Top Fugas de Dinero (Mermas Principales)
              </h4>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">Productos con mayor impacto económico por pérdida</p>
            </div>
            <span className="text-xs font-black text-[var(--app-danger)]">Prioridad de revisión</span>
          </div>

          <div className="divide-y divide-white/5 mt-2">
            {topLosses.map(item => (
              <div key={item.code} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.75rem] font-mono font-bold text-[var(--app-muted)]">{item.code}</span>
                    <span className="text-[0.75rem] px-2 py-0.5 rounded-full bg-[var(--app-bg)] text-[var(--app-muted)] font-semibold">
                      {item.department}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[var(--app-pearl)] truncate mt-0.5">{item.description}</p>
                  <p className="text-xs text-[var(--app-muted)]">
                    Faltan <strong className="text-[var(--app-danger)]">{Math.abs(item.diff)} pzas</strong> (Teórico: {item.theoreticalStock} · Físico: {item.physicalStock})
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-[var(--app-danger)]">
                    -{money.format(item.lossAmount)}
                  </div>
                  <span className="text-[0.75rem] text-[var(--app-muted)] font-bold">{mode === 'sale' ? 'a precio venta' : 'al costo'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
