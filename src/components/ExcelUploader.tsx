import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Sparkles, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { parseEleventaExcel, getDemoEleventaProducts } from '../services/eleventaParser';
import type { Product } from '../types';

interface ExcelUploaderProps {
  onProductsLoaded: (products: Product[]) => void;
  currentCount: number;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onProductsLoaded, currentCount }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const { products, errors } = parseEleventaExcel(buffer);

      if (errors.length > 0 && products.length === 0) {
        setErrorMsg(errors.join(' '));
      } else {
        onProductsLoaded(products);
        setSuccessMsg(`¡Se cargaron exitosamente ${products.length} productos desde ${file.name}!`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al leer el archivo. Asegúrate de que sea un archivo válido de Excel (.xlsx, .xls) o CSV.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadDemo = () => {
    setErrorMsg(null);
    const demo = getDemoEleventaProducts();
    onProductsLoaded(demo);
    setSuccessMsg(`Catálogo demo cargado con ${demo.length} productos comunes de prueba.`);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5 max-w-xl mx-auto shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Cargar Inventario de eleventa
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exporta tus productos desde tu punto de venta eleventa y súbelos aquí para iniciar la auditoría.
          </p>
        </div>
        {currentCount > 0 && (
          <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0">
            {currentCount} productos
          </span>
        )}
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-14 h-14 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors mb-3">
          <Upload className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-200">
          {loading ? 'Procesando archivo...' : 'Haz clic para seleccionar el Excel de eleventa'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Archivos compatibles: .xlsx, .xls o .csv
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>¿No tienes el Excel a la mano?</span>
        </div>
        <button
          onClick={loadDemo}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Cargar Catálogo de Prueba (Demo)
        </button>
      </div>

      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
        <strong className="text-slate-300 block font-medium">¿Cómo exportar desde eleventa?</strong>
        <p>1. En tu computadora con eleventa, presiona <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">F3 Productos</code> o <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">F4 Inventario</code>.</p>
        <p>2. Haz clic en el botón inferior <strong className="text-slate-300">"Exportar"</strong>.</p>
        <p>3. Guarda el archivo Excel y cárgalo directamente aquí.</p>
      </div>
    </div>
  );
};
