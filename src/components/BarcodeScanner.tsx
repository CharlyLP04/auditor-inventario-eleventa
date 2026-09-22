import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { soundService } from '../services/audioService';
import { CameraIcon, TorchIcon } from './CustomIcons';
import { AlertCircle, Search, Layers, Plus } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string, quantityToAdd?: number) => void;
  lastScannedInfo: {
    code: string;
    description: string;
    quantity: number;
    theoretical: number;
    isNew: boolean;
  } | null;
}

export const BarcodeScanner = ({ onScan, lastScannedInfo }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'single' | 'batch'>('single');
  const [batchQuantity, setBatchQuantity] = useState<number>(6);
  const [manualCode, setManualCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const mounted = useRef(false);
  const starting = useRef(false);
  const currentScan = useRef({ onScan, scanMode, batchQuantity });
  useEffect(() => { currentScan.current = { onScan, scanMode, batchQuantity }; }, [onScan, scanMode, batchQuantity]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const scanner = html5QrCodeRef.current;
      if (scanner?.isScanning) void scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, []);

  const startScanning = async (cameraId?: string) => {
    if (starting.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('La cámara requiere conexión HTTPS o localhost. Puedes usar un lector de código de barras físico USB/Bluetooth o ingresar los códigos manualmente abajo.');
      return;
    }
    starting.current = true;
    setBusy(true);
    setErrorMessage(null);
    soundService.unlock();
    try {
      const previous = html5QrCodeRef.current;
      if (previous?.isScanning) await previous.stop();
      previous?.clear();
      if (!mounted.current) return;
      setIsScanning(false);
      setHasTorch(false);
      setTorchOn(false);
      const devices = await Html5Qrcode.getCameras();
      if (!mounted.current) return;
      setCameras(devices);
      const preferred = devices.find(d => /back|trasera|environment/i.test(d.label));
      const id = cameraId || selectedCamera || preferred?.id || devices[0]?.id;
      if (!id) throw new Error('No hay cámaras disponibles.');
      setSelectedCamera(id);
      const scanner = new Html5Qrcode('interactive-scanner-view', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39
        ],
        verbose: false,
      });
      html5QrCodeRef.current = scanner;
      await scanner.start(id, {
        fps: 15,
        qrbox: (width, height) => ({
          width: Math.max(1, Math.min(280, Math.floor(width * .8))),
          height: Math.max(1, Math.min(160, Math.floor(height * .6)))
        }),
        aspectRatio: 1,
      }, handleDetectedCode, () => {
        if (Date.now() - lastScannedTimeRef.current > 800) lastScannedCodeRef.current = '';
      });
      if (!mounted.current) {
        await scanner.stop();
        scanner.clear();
        return;
      }
      lastScannedCodeRef.current = '';
      setIsScanning(true);
      try { setHasTorch(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported()); } catch { setHasTorch(false); }
    } catch {
      if (mounted.current) {
        setIsScanning(Boolean(html5QrCodeRef.current?.isScanning));
        setErrorMessage('No se pudo activar la cámara. Revisa los permisos en tu navegador.');
      }
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const stopScanning = async () => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    try {
      const scanner = html5QrCodeRef.current;
      if (scanner?.isScanning) await scanner.stop();
      scanner?.clear();
      if (mounted.current) { setIsScanning(false); setTorchOn(false); setHasTorch(false); }
    } catch {
      if (mounted.current) setErrorMessage('No se pudo detener la cámara. Intenta de nuevo.');
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const toggleTorch = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner?.isScanning) return;
    try {
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      if (mounted.current) setTorchOn(!torchOn);
    } catch {
      if (mounted.current) setErrorMessage('Esta cámara no permite encender la linterna.');
    }
  };

  const handleDetectedCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (trimmed === lastScannedCodeRef.current) {
      lastScannedTimeRef.current = now;
      return;
    }

    lastScannedCodeRef.current = trimmed;
    lastScannedTimeRef.current = now;

    if (!mounted.current) return;
    const current = currentScan.current;
    const qty = current.scanMode === 'batch' ? current.batchQuantity : 1;
    current.onScan(trimmed, qty);
    setFlash(value => value + 1);
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const qty = scanMode === 'batch' ? batchQuantity : 1;
    soundService.unlock();
    onScan(manualCode.trim(), qty);
    setFlash(value => value + 1);
    setManualCode('');
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      {/* Visor de Cámara con Retícula y Láser Dinámico */}
      <div className="relative bg-[#1A1A1A] rounded-[28px] overflow-hidden border border-white/10 shadow-2xl min-h-[320px] flex flex-col items-center justify-center">
        {isScanning && <div className="scan-reticle" aria-hidden="true" />}
        {flash > 0 && <div key={flash} className="scan-flash" aria-hidden="true" />}
        <div id="interactive-scanner-view" className="w-full h-full min-h-[300px]" />

        {/* Overlay cuando el escáner no está activo */}
        {!isScanning && (
          <div className="absolute inset-0 bg-[#161616]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center gap-5 z-10">
            <div className="w-16 h-16 rounded-full bg-[#B38F6F]/20 text-[#B38F6F] flex items-center justify-center shadow-lg border border-[#B38F6F]/30">
              <CameraIcon size={32} solid />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#F2F1ED] tracking-tight">Escáner Óptico de Barras</h3>
              <p className="text-xs text-[#888888] max-w-xs mt-1.5 font-medium leading-relaxed">
                Apunta al código del producto (EAN-13, UPC, Code 128) para contar piezas automáticamente.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => startScanning()}
              className="px-8 py-4 bg-[#FF6E42] hover:bg-[#ff8560] active:scale-95 text-[#161616] font-black rounded-full shadow-xl shadow-[#FF6E42]/25 flex items-center gap-2.5 transition-all cursor-pointer text-sm uppercase tracking-wider"
            >
              <CameraIcon size={20} solid />
              <span>{busy ? 'Iniciando sensor…' : 'Activar Cámara'}</span>
            </button>
          </div>
        )}

        {/* Controles flotantes redondos sobre la cámara */}
        {isScanning && (
          <div className="absolute bottom-4 right-4 flex items-center gap-3 z-20">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                  torchOn ? 'bg-[#FF6E42] text-[#161616] ring-4 ring-[#FF6E42]/40' : 'bg-[#161616]/80 text-[#F2F1ED] border border-white/20'
                }`}
                title="Linterna / Flash"
                aria-label="Linterna"
                aria-pressed={torchOn}
              >
                <TorchIcon size={22} solid={torchOn} />
              </button>
            )}
            <button
              disabled={busy}
              onClick={stopScanning}
              className="px-4 py-2 bg-[#710014] hover:bg-[#8e0019] text-[#F2F1ED] text-xs font-bold rounded-full backdrop-blur-md border border-white/20 shadow-lg cursor-pointer"
            >
              Detener
            </button>
          </div>
        )}

        {/* Selector de cámara redondeado */}
        {isScanning && cameras.length > 1 && (
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-center">
            <select
              aria-label="Seleccionar cámara"
              disabled={busy}
              value={selectedCamera}
              onChange={(e) => {
                setSelectedCamera(e.target.value);
                startScanning(e.target.value);
              }}
              className="bg-[#161616]/90 backdrop-blur-xl text-xs font-bold text-[#F2F1ED] py-2 px-4 rounded-full border border-white/15 outline-none shadow-xl"
            >
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Cámara ${cam.id.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2.5 p-4 bg-[#710014]/30 border border-[#710014] rounded-2xl text-[#F2F1ED] text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#FF6E42]" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selector de Modo: Unidad (+1) vs Caja (+N) con diseño Pill redondo */}
      <div className="grid grid-cols-2 gap-2 bg-[#202020] p-1.5 rounded-full border border-white/10 shadow-inner">
        <button
          aria-pressed={scanMode === 'single'}
          onClick={() => setScanMode('single')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            scanMode === 'single'
              ? 'bg-[#B38F6F] text-[#161616] shadow-lg scale-[1.02]'
              : 'text-[#888888] hover:text-[#F2F1ED]'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Modo Unidad (+1)
        </button>
        <button
          aria-pressed={scanMode === 'batch'}
          onClick={() => setScanMode('batch')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            scanMode === 'batch'
              ? 'bg-[#FF6E42] text-[#161616] shadow-lg scale-[1.02]'
              : 'text-[#888888] hover:text-[#F2F1ED]'
          }`}
        >
          <Layers className="w-4 h-4 stroke-[2.5]" />
          Modo Caja (+N)
        </button>
      </div>

      {/* Configuración de Caja / Paquete si está activo */}
      {scanMode === 'batch' && (
        <div className="flex flex-wrap gap-3 items-center justify-between bg-[#262626] border border-white/10 p-3.5 rounded-2xl animate-card-pop">
          <span className="text-xs text-[#B38F6F] font-bold uppercase tracking-wider">Unidades por caja:</span>
          <div className="flex items-center gap-2">
            {[6, 12, 24].map((qty) => (
              <button
                key={qty}
                onClick={() => setBatchQuantity(qty)}
                className={`px-3 py-1.5 text-xs rounded-full font-black transition-all cursor-pointer ${
                  batchQuantity === qty
                    ? 'bg-[#FF6E42] text-[#161616] shadow-md'
                    : 'bg-[#161616] text-[#888888] hover:text-[#F2F1ED] border border-white/10'
                }`}
              >
                +{qty}
              </button>
            ))}
            <input
              type="number"
              aria-label="Unidades por caja"
              min="1"
              max="999999"
              value={batchQuantity}
              onChange={(e) => setBatchQuantity(Math.min(999999, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 text-center bg-[#161616] border border-[#FF6E42]/60 rounded-full py-1.5 text-sm font-black text-[#F2F1ED] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Tarjeta de Último Escaneo estilo Swatch Card */}
      {lastScannedInfo && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`p-4 rounded-2xl border transition-all animate-card-pop ${
            lastScannedInfo.isNew 
              ? 'bg-[#262626] border-[#FF6E42]/50' 
              : 'bg-[#202020] border-white/15'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono font-bold text-[#B38F6F]">{lastScannedInfo.code}</span>
              <h4 className="font-extrabold text-[#F2F1ED] text-base leading-snug mt-0.5">
                {lastScannedInfo.description}
              </h4>
              {lastScannedInfo.isNew ? (
                <span className="inline-block mt-2 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#FF6E42]/20 text-[#FF6E42] border border-[#FF6E42]/40">
                  ⚠ No registrado en eleventa
                </span>
              ) : (
                <div className="flex items-center gap-3 mt-2 text-xs text-[#888888]">
                  <span>eleventa: <strong className="text-[#F2F1ED]">{lastScannedInfo.theoretical}</strong></span>
                  <span>Físico: <strong className="text-[#B38F6F] text-sm">{lastScannedInfo.quantity}</strong></span>
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-black text-[#F2F1ED] tracking-tight">
                {lastScannedInfo.quantity}
              </div>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#B38F6F]">Físico</span>
            </div>
          </div>
        </div>
      )}

      {/* Entrada manual con buscador redondo */}
      <form onSubmit={handleManualSubmit} className="relative flex items-center">
        <input
          type="text"
          aria-label="Código del producto"
          autoComplete="off"
          name="barcode"
          spellCheck={false}
          maxLength={128}
          placeholder="Digitar código o usar pistola USB / Bluetooth..."
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="w-full bg-[#202020] border border-white/10 focus:border-[#FF6E42] text-[#F2F1ED] placeholder-[#777777] text-sm rounded-full py-3.5 pl-5 pr-28 outline-none transition-colors"
        />
        <button
          type="submit"
          className="absolute right-2 px-4 py-2 bg-[#FF6E42] hover:bg-[#ff8560] text-[#161616] text-xs font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
        >
          <Search className="w-3.5 h-3.5 stroke-[3]" />
          Buscar
        </button>
      </form>
    </div>
  );
};
