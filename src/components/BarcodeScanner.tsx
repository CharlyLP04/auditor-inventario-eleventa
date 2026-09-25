import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { soundService, speakCount, stopSpeech } from '../services/audioService';
import { CameraIcon, TorchIcon } from './CustomIcons';
import { AlertCircle, Search, Layers, Plus, Eye, Volume2, Undo2, Star } from 'lucide-react';

import type { Product, CountMode, ScannerPreferences } from '../types';
import { ScanCooldown, DEFAULT_SCANNER } from '../services/scannerState';
import { roundQuantity } from '../services/auditState';
import { QuantityKeypadModal } from './QuantityKeypadModal';

interface BarcodeScannerProps {
  onScan: (barcode: string, quantityToAdd?: number, mode?: CountMode) => void | Promise<Product | null | void>;
  products?: Product[];
  preferences?: ScannerPreferences;
  onPreferencesChange?: (value: ScannerPreferences) => Promise<boolean>;
  onUndo?: () => Promise<boolean>;
  canUndo?: boolean;
  saving?: boolean;
  lastScannedInfo: {
    code: string;
    description: string;
    quantity: number;
    theoretical: number;
    isNew: boolean;
  } | null;
}

export const BarcodeScanner = ({ onScan, lastScannedInfo, products = [], preferences = DEFAULT_SCANNER, onPreferencesChange, onUndo, canUndo = false, saving = false }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const scanMode = preferences.scanMode, batchQuantity = preferences.batchQuantity;
  const setScanMode = (value: ScannerPreferences['scanMode']) => { void onPreferencesChange?.({ ...preferences, scanMode: value }); };
  const setBatchQuantity = (value: number) => { void onPreferencesChange?.({ ...preferences, batchQuantity: value }); };
  const [manualCode, setManualCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cooldown = useRef(new ScanCooldown());
  const inFlight = useRef(false);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(false);
  const [quantityRequest, setQuantityRequest] = useState<{ code: string; correction: boolean } | null>(null);
  const [zoneNotice, setZoneNotice] = useState('');

  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const mounted = useRef(false);
  const starting = useRef(false);
  const currentScan = useRef({ onScan, preferences, saving, products });
  useEffect(() => { currentScan.current = { onScan, preferences, saving, products }; }, [onScan, preferences, saving, products]);
  useEffect(() => { if (!preferences.speechEnabled) stopSpeech(); }, [preferences.speechEnabled]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (freezeTimer.current) clearTimeout(freezeTimer.current);
      stopSpeech();
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
      }, (code) => { void handleDetectedCode(code); }, () => { /* Frames without a barcode are expected. */ });
      if (!mounted.current) {
        await scanner.stop();
        scanner.clear();
        return;
      }
      paused.current = false;
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
    if (freezeTimer.current) clearTimeout(freezeTimer.current);
    paused.current = false; inFlight.current = false;
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

  const pauseCamera = () => {
    const scanner = html5QrCodeRef.current;
    if (scanner?.isScanning && !paused.current) {
      try { scanner.pause(true); paused.current = true; }
      catch { setErrorMessage('No se pudo congelar la cámara; el bloqueo de lecturas sigue activo.'); }
    }
  };
  const resumeCamera = () => {
    if (!mounted.current) return;
    const scanner = html5QrCodeRef.current;
    if (paused.current && scanner?.isScanning) {
      try { scanner.resume(); }
      catch { setErrorMessage('Pulsa Detener y vuelve a activar la cámara para continuar.'); }
    }
    paused.current = false; inFlight.current = false;
  };
  const finishFeedback = (product: Product | void) => {
    if (!mounted.current) return;
    setFlash(value => value + 1);
    if (product?.isUnregistered) soundService.playWarningBeep(); else soundService.playScanBeep();
    try {
      navigator.vibrate?.([100, 50, 80]);
      if (product && currentScan.current.preferences.speechEnabled) speakCount(product.description, product.physicalStock, product.isUnregistered);
    } catch { setErrorMessage('Conteo guardado. Este navegador no pudo emitir la confirmación de voz o vibración.'); }
  };
  const persistCount = async (code: string, quantity: number, mode: CountMode) => {
    try {
      const result = await currentScan.current.onScan(code, quantity, mode);
      if (result === null) { if (mounted.current) setErrorMessage('No se guardó el conteo. Revisa el aviso y vuelve a intentarlo.'); return false; }
      finishFeedback(result); return true;
    } catch (error) {
      if (mounted.current) setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el conteo.');
      return false;
    }
  };
  const handleDetectedCode = async (rawCode: string, correction = false) => {
    const code = rawCode.trim();
    if (!code || inFlight.current || currentScan.current.saving) return;
    if (!correction && !cooldown.current.accept(code)) { setErrorMessage('Lectura repetida: espera 1.8 segundos antes de contar el mismo código.'); return; }
    inFlight.current = true; setErrorMessage(null); pauseCamera();
    const current = currentScan.current;
    const product = current.products.find(p => p.code === code);
    const zone = current.preferences.activeZoneDepartment;
    setZoneNotice(zone && product && product.department !== zone ? `Este producto pertenece a ${product.department}. Estás trabajando en ${zone}.` : '');
    if (current.preferences.scanMode === 'ask_quantity' || correction) { setQuantityRequest({ code, correction }); return; }
    const success = await persistCount(code, current.preferences.scanMode === 'batch' ? current.preferences.batchQuantity : 1, 'add');
    if (!success) cooldown.current.release(code);
    if (mounted.current) freezeTimer.current = setTimeout(resumeCamera, 650);
  };
  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim() || inFlight.current || saving) return;
    soundService.unlock(); void handleDetectedCode(manualCode); setManualCode('');
  };
  const changeLastQuantity = async (quantity: number) => {
    if (!lastScannedInfo || inFlight.current || saving) return;
    inFlight.current = true; pauseCamera();
    await persistCount(lastScannedInfo.code, quantity, 'set');
    if (mounted.current) freezeTimer.current = setTimeout(resumeCamera, 650);
  };
  const departments = [...new Set(products.map(p => p.department))].sort();
  const lastProduct = products.find(p => p.code === lastScannedInfo?.code);
  const lastQuantity = lastProduct?.physicalStock ?? lastScannedInfo?.quantity ?? 0;
  const difference = roundQuantity(lastQuantity - (lastProduct?.theoreticalStock ?? lastScannedInfo?.theoretical ?? 0));

  return (
    <div className={`scanner-shell flex flex-col gap-4 w-full max-w-xl mx-auto ${preferences.highVisibility ? 'scanner-large' : ''}`}>
      <div className="scanner-tools">
        <button className="secondary" disabled={saving} aria-pressed={preferences.speechEnabled} onClick={() => {
          if (!('speechSynthesis' in window)) { setErrorMessage('Este navegador no admite voz sintetizada.'); return; }
          void onPreferencesChange?.({ ...preferences, speechEnabled: !preferences.speechEnabled });
        }}><Volume2 size={18} aria-hidden="true" /> Voz</button>
        <button className="secondary" disabled={saving} aria-pressed={preferences.highVisibility} onClick={() => { void onPreferencesChange?.({ ...preferences, highVisibility: !preferences.highVisibility }); }}><Eye size={18} aria-hidden="true" /> Letra grande</button>
        <label>Zona activa<select disabled={saving} value={preferences.activeZoneDepartment ?? ''} onChange={e => { void onPreferencesChange?.({ ...preferences, activeZoneDepartment: e.target.value || undefined }); }}><option value="">Todos</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>
      {zoneNotice && <p role="status" className="message">{zoneNotice}</p>}
      {quantityRequest && <QuantityKeypadModal code={quantityRequest.code} product={products.find(p => p.code === quantityRequest.code)} initialValue={quantityRequest.correction ? String(lastQuantity) : ''} onClose={() => { setQuantityRequest(null); resumeCamera(); }} onSave={async (quantity, mode) => { const saved = await persistCount(quantityRequest.code, quantity, mode); if (saved) { cooldown.current.release(quantityRequest.code); cooldown.current.accept(quantityRequest.code); } return saved; }} />}
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
              disabled={busy || saving}
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
              disabled={busy || saving}
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
      <div className="scanner-modes">
        <button
          disabled={saving} aria-pressed={scanMode === 'single'}
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
          disabled={saving} aria-pressed={scanMode === 'batch'}
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
        <button disabled={saving} aria-pressed={scanMode === 'ask_quantity'} onClick={() => setScanMode('ask_quantity')}><Star size={18} aria-hidden="true" /> Preguntar cantidad</button>
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
      {lastScannedInfo && <section className="last-scan-card" aria-label="Último producto contado">
        <code>{lastScannedInfo.code}</code><h3>{lastProduct?.description ?? lastScannedInfo.description}</h3>
        <p>eleventa: {lastProduct?.theoreticalStock ?? lastScannedInfo.theoretical} · Venta: ${(lastProduct?.price ?? 0).toFixed(2)}</p>
        <div className="last-scan-controls">
          <button disabled={saving || lastQuantity <= 0} className="secondary" aria-label="Restar una pieza al último producto" onClick={() => { void changeLastQuantity(Math.max(0, roundQuantity(lastQuantity - 1))); }}>−</button>
          <button className="last-scan-number" disabled={saving} aria-label="Corregir cantidad del último producto" onClick={() => { void handleDetectedCode(lastScannedInfo.code, true); }}>{lastQuantity}</button>
          <button disabled={saving || lastQuantity >= 1e9} className="primary" aria-label="Sumar una pieza al último producto" onClick={() => { void changeLastQuantity(roundQuantity(lastQuantity + 1)); }}>+</button>
        </div>
        <span className={`last-scan-status ${lastScannedInfo.isNew ? 'unknown' : difference < 0 ? 'missing' : difference > 0 ? 'surplus' : 'match'}`}>
          {lastScannedInfo.isNew ? 'NO REGISTRADO EN ELEVENTA' : difference < 0 ? `↓ FALTAN ${Math.abs(difference)} PIEZAS` : difference > 0 ? `↑ SOBRAN ${difference} PIEZAS` : '✓ CUADRADO EXACTO'}
        </span>
        {onUndo && <button className="secondary scanner-undo" disabled={saving || !canUndo} onClick={async () => {
          if (inFlight.current) return; inFlight.current = true; pauseCamera();
          try { if (await onUndo()) { stopSpeech(); setErrorMessage(null); } else setErrorMessage('No se pudo deshacer el último conteo.'); }
          finally { resumeCamera(); }
        }}><Undo2 size={18} aria-hidden="true" /> Deshacer último conteo</button>}
      </section>}

      {/* Entrada manual con buscador redondo */}
      <form onSubmit={handleManualSubmit} className="relative flex items-center">
        <input
          type="text"
          disabled={saving} aria-label="Código del producto"
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
