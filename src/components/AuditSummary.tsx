import React from 'react';
import { TrendingDown, TrendingUp, CheckCircle, Package, DollarSign, PieChart } from 'lucide-react';
import type { AuditStats } from '../types';

interface AuditSummaryProps {
  stats: AuditStats;
}

export const AuditSummary: React.FC<AuditSummaryProps> = ({ stats }) => {
  const percentage = stats.totalCatalog > 0 
    ? Math.min(100, Math.round((stats.auditedCount / stats.totalCatalog) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-emerald-400" />
            Avance de Auditoría
          </span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{percentage}%</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-2">
          <span>{stats.auditedCount} productos contados</span>
          <span>{stats.totalCatalog} productos en eleventa</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-950/25 border border-red-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Faltantes (Merma)</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-red-300">
              -${stats.missingCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-red-400/80 font-medium">
              {stats.totalMissingPieces} piezas faltantes ({stats.missingCount} productos)
            </span>
          </div>
        </div>

        <div className="bg-blue-950/25 border border-blue-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Sobrantes</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-blue-300">
              +${stats.surplusCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-blue-400/80 font-medium">
              {stats.totalSurplusPieces} piezas de más ({stats.surplusCount} productos)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
          <div className="text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Cuadrados
          </div>
          <div className="text-lg font-bold text-white mt-0.5">{stats.matchCount}</div>
          <span className="text-[10px] text-slate-500">100% exactos</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
          <div className="text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1">
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            Físico Contado
          </div>
          <div className="text-lg font-bold text-indigo-300 mt-0.5">{stats.totalPiecesPhysical}</div>
          <span className="text-[10px] text-slate-500">de {stats.totalPiecesTheoretical} piezas</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
          <div className="text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            No Registrados
          </div>
          <div className="text-lg font-bold text-amber-300 mt-0.5">{stats.unregisteredCount}</div>
          <span className="text-[10px] text-slate-500">nuevos en tienda</span>
        </div>
      </div>
    </div>
  );
};
