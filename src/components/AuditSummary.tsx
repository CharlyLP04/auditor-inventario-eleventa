import React from 'react';
import { TrendingDown, TrendingUp, CheckCircle, Package, AlertTriangle, PieChart } from 'lucide-react';
import type { AuditStats } from '../types';

interface AuditSummaryProps {
  stats: AuditStats;
}

export const AuditSummary: React.FC<AuditSummaryProps> = ({ stats }) => {
  const percentage = stats.totalCatalog > 0 
    ? Math.min(100, Math.round((stats.auditedCount / stats.totalCatalog) * 100))
    : 0;

  return (
    <div className="summary-panel flex flex-col gap-4 w-full max-w-xl mx-auto animate-card-pop">
      {/* Barra de Progreso Editorial */}
      <div className="bg-[#202020] border border-white/10 rounded-[26px] p-5 shadow-xl">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-extrabold text-[#B38F6F] flex items-center gap-2 uppercase tracking-wider">
            <PieChart className="w-4 h-4 text-[#FF6E42]" />
            Avance Global de Conteo
          </span>
          <span className="font-mono font-black text-[#F2F1ED] text-base">{percentage}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Avance de auditoría"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="w-full h-3.5 bg-[#161616] rounded-full overflow-hidden p-0.5 border border-white/5"
        >
          <div
            className="h-full bg-gradient-to-r from-[#B38F6F] to-[#FF6E42] rounded-full transition-all duration-700 ease-out shadow-lg"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#888888] mt-3 font-semibold">
          <span>{stats.auditedCount} contados</span>
          <span>{stats.totalCatalog} productos en eleventa</span>
        </div>
      </div>

      {/* Tarjetas Swatch de Impacto Financiero */}
      <div className="summary-kpis grid grid-cols-1 min-[400px]:grid-cols-2 gap-3.5">
        {/* Tarjeta Merma en Crimson Depth (#710014) */}
        <div className="bg-[#710014] rounded-[26px] p-5 flex flex-col justify-between shadow-2xl border border-white/10">
          <div className="flex items-center justify-between text-[#F2F1ED]/80">
            <span className="text-xs font-black uppercase tracking-widest">Faltantes (Merma)</span>
            <TrendingDown className="w-5 h-5 text-[#F2F1ED]" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-[#F2F1ED] tracking-tight">
              -${stats.missingCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#F2F1ED]/90 font-bold block mt-1">
              {stats.totalMissingPieces} piezas ({stats.missingCount} productos)
            </span>
          </div>
        </div>

        {/* Tarjeta Sobrantes en Petrol Blue (#004E72) */}
        <div className="bg-[#004E72] rounded-[26px] p-5 flex flex-col justify-between shadow-2xl border border-white/10">
          <div className="flex items-center justify-between text-[#F2F1ED]/80">
            <span className="text-xs font-black uppercase tracking-widest">Sobrantes</span>
            <TrendingUp className="w-5 h-5 text-[#F2F1ED]" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-[#F2F1ED] tracking-tight">
              +${stats.surplusCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#F2F1ED]/90 font-bold block mt-1">
              {stats.totalSurplusPieces} piezas ({stats.surplusCount} productos)
            </span>
          </div>
        </div>
      </div>

      {/* Desglose de Unidades y Estado en Obsidian Surface */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#202020] border border-white/10 p-3.5 rounded-2xl text-center shadow-md">
          <div className="text-[#888888] text-[11px] font-bold flex items-center justify-center gap-1.5 uppercase">
            <CheckCircle className="w-3.5 h-3.5 text-[#B38F6F]" />
            Cuadrados
          </div>
          <div className="text-xl font-black text-[#F2F1ED] mt-1">{stats.matchCount}</div>
          <span className="text-[10px] text-[#888888] font-bold">100% exactos</span>
        </div>

        <div className="bg-[#202020] border border-white/10 p-3.5 rounded-2xl text-center shadow-md">
          <div className="text-[#888888] text-[11px] font-bold flex items-center justify-center gap-1.5 uppercase">
            <Package className="w-3.5 h-3.5 text-[#FF6E42]" />
            Físico
          </div>
          <div className="text-xl font-black text-[#FF6E42] mt-1">{stats.totalPiecesPhysical}</div>
          <span className="text-[10px] text-[#888888] font-bold">de {stats.totalPiecesTheoretical} pzas</span>
        </div>

        <div className="bg-[#202020] border border-white/10 p-3.5 rounded-2xl text-center shadow-md">
          <div className="text-[#888888] text-[11px] font-bold flex items-center justify-center gap-1.5 uppercase">
            <AlertTriangle className="w-3.5 h-3.5 text-[#B38F6F]" />
            Nuevos
          </div>
          <div className="text-xl font-black text-[#F2F1ED] mt-1">{stats.unregisteredCount}</div>
          <span className="text-[10px] text-[#888888] font-bold">en tienda</span>
        </div>
      </div>
    </div>
  );
};
