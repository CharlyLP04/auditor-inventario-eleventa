import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { soundService, speakCount, stopSpeech } from '../services/audioService';
import { CameraIcon, TorchIcon } from './CustomIcons';
import { AlertCircle, Search, Layers, Plus, Eye, Volume2, Undo2, Star, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

import type { Product, CountMode, ScannerPreferences } from '../types';
import { ScanCooldown, DEFAULT_SCANNER } from '../services/scannerState';
import { roundQuantity, isCounted, validQuantity } from '../services/auditState';
import { resolveScannedCode, searchProducts } from '../services/productSearch';
import type { UnregisteredInput } from '../services/unregisteredProducts';
import { QuantityKeypadModal } from './QuantityKeypadModal';

export type ScanTone = 'found' | 'notfound' | 'warning';
export interface ScanFeedback { tone: ScanTone; title: string; detail?: string; code: string; }
const toneIcon = { found: CheckCircle2, notfound: XCircle, warning: AlertTriangle };
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

interface BarcodeScannerProps {
  onScan: (barcode: string, quantityToAdd?: number, mode?: CountMode) => void | Promise<Product | null | void>;
  onRegisterUnregistered?: (input: UnregisteredInput) => Promise<Product | null>;
  onRestoreUnregistered?: (code: string) => Promise<boolean>;
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

export const BarcodeScanner = ({ onScan, onRegisterUnregistered, onRestoreUnregistered, lastScannedInfo, products = [], preferences = DEFAULT_SCANNER, onPreferencesChange, onUndo, canUndo = false, saving = false }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const scanMode = preferences.scanMode, batchQuantity = preferences.batchQuantity;
  const setScanMode = (value: ScannerPreferences['scanMode']) => { void onPreferencesChange?.({ ...preferences, scanMode: value }); };
  // El campo puede quedar vacío mientras se escribe; cada valor válido se guarda en orden, sin perder teclas.
  const [batchDraft, setBatchDraft] = useState<string | null>(null);
  const batchSaves = useRef<{ running: boolean; next: number | null }>({ running: false, next: null });
  const setBatchQuantity = async (value: number) => {
    const queue = batchSaves.current;
    queue.next = value;
    if (queue.running) return;
    queue.running = true;
    try {
      while (queue.next !== null) {
        const next = queue.next; queue.next = null;
        await onPreferencesChange?.({ ...currentScan.current.preferences, batchQuantity: next });
      }
    } finally { queue.running = false; }
  };
  const editBatchQuantity = (raw: string) => {
    setBatchDraft(raw);
    const value = Number(raw);
    if (raw.trim() && Number.isInteger(value) && value >= 1 && value <= 999999) void setBatchQuantity(value);
  };
  const [query, setQuery] = useState<string>('');
  const [searchNotice, setSearchNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [notFound, setNotFound] = useState<{ code: string; suggestions: Product[] } | null>(null);
  const [excludedScan, setExcludedScan] = useState<Product | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cooldown = useRef(new ScanCooldown());
  const inFlight = useRef(false);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(false);
  const [quantityRequest, setQuantityRequest] = useState<{ code: string; correction: boolean; warnings: string[] } | null>(null);

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
  const scheduleResume = () => { if (mounted.current) freezeTimer.current = setTimeout(resumeCamera, 650); };
  const signal = (tone: ScanTone) => {
    setFlash(value => value + 1);
    if (tone === 'found') soundService.playScanBeep(); else soundService.playWarningBeep();
    try { navigator.vibrate?.(tone === 'found' ? [100, 50, 80] : [220, 80, 220]); } catch { /* La vibración es opcional. */ }
  };
  const finishFeedback = (product: Product | void, warnings: string[]) => {
    if (!mounted.current) return;
    const tone: ScanTone = product?.isUnregistered ? 'notfound' : warnings.length ? 'warning' : 'found';
    if (product) setFeedback({
      tone, code: product.code,
      title: product.isUnregistered ? `No encontrado · ${product.description}` : `En la auditoría · ${product.description}`,
      detail: [...warnings, `Contado: ${product.physicalStock}${product.isUnregistered ? '' : ` de ${product.theoreticalStock} en eleventa`}`].join(' · '),
    });
    signal(tone);
    try {
      if (product && currentScan.current.preferences.speechEnabled) speakCount(product.description, product.physicalStock, product.isUnregistered);
    } catch { setErrorMessage('Conteo guardado. Este navegador no pudo emitir la confirmación de voz.'); }
  };
  const persistCount = async (code: string, quantity: number, mode: CountMode, warnings: string[] = []) => {
    try {
      const result = await currentScan.current.onScan(code, quantity, mode);
      if (result === null) { if (mounted.current) setErrorMessage('No se guardó el conteo. Revisa el aviso y vuelve a intentarlo.'); return false; }
      finishFeedback(result, warnings); return true;
    } catch (error) {
      if (mounted.current) setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el conteo.');
      return false;
    }
  };
  const quantityForMode = () => currentScan.current.preferences.scanMode === 'batch' ? currentScan.current.preferences.batchQuantity : 1;
  const handleDetectedCode = async (rawCode: string, correction = false) => {
    const scanned = rawCode.trim();
    if (!scanned || inFlight.current || currentScan.current.saving) return;
    if (!correction && !cooldown.current.accept(scanned)) { setErrorMessage('Lectura repetida: espera 1.8 segundos antes de contar el mismo código.'); return; }
    inFlight.current = true; setErrorMessage(null); setNotFound(null); setExcludedScan(null); pauseCamera();
    const current = currentScan.current;
    const resolution = resolveScannedCode(current.products, scanned);
    const product = resolution.product;
    if (!product) {
      // Nunca se cuenta un código desconocido sin confirmación: se ofrece registrarlo como no encontrado.
      setNotFound({ code: scanned, suggestions: resolution.suggestions });
      setFeedback({ tone: 'notfound', code: scanned, title: 'No está en la auditoría', detail: `Código ${scanned}. Agrégalo como no encontrado o busca el producto por su descripción.` });
      signal('notfound');
      cooldown.current.release(scanned);
      return;
    }
    if (product.excludedAt) {
      setExcludedScan(product);
      setFeedback({ tone: 'warning', code: product.code, title: `Excluido del conteo · ${product.description}`, detail: product.excludedReason ? `Motivo: ${product.excludedReason}` : undefined });
      signal('warning');
      cooldown.current.release(scanned);
      return;
    }
    const warnings: string[] = [];
    if (resolution.match === 'leading_zeros') warnings.push(`Se leyó ${scanned} y coincidió con ${product.code}`);
    const zone = current.preferences.activeZoneDepartment;
    if (zone && product.department !== zone && !product.isUnregistered) warnings.push(`Pertenece a ${product.department}; estás contando ${zone}`);
    if (current.preferences.scanMode === 'ask_quantity' || correction) {
      // La advertencia se muestra antes de capturar la cantidad para decidir si conviene contarlo.
      if (warnings.length) setFeedback({ tone: 'warning', code: product.code, title: `Revisa antes de guardar · ${product.description}`, detail: warnings.join(' · ') });
      setQuantityRequest({ code: product.code, correction, warnings }); return;
    }
    const success = await persistCount(product.code, quantityForMode(), 'add', warnings);
    if (!success) cooldown.current.release(scanned);
    scheduleResume();
  };
  const closeNotFound = () => { setNotFound(null); resumeCamera(); };
  const registerNotFound = async (input: UnregisteredInput) => {
    if (!onRegisterUnregistered) return false;
    try {
      const product = await onRegisterUnregistered(input);
      if (!product) { setErrorMessage('No se guardó el producto no encontrado. Revisa el aviso y vuelve a intentarlo.'); return false; }
      setNotFound(null);
      cooldown.current.accept(product.code);
      finishFeedback(product, []);
      scheduleResume();
      return true;
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); return false; }
  };
  const restoreExcluded = async () => {
    if (!excludedScan || !onRestoreUnregistered) return;
    if (await onRestoreUnregistered(excludedScan.code)) {
      setFeedback({ tone: 'notfound', code: excludedScan.code, title: `Reincorporado · ${excludedScan.description}`, detail: 'Vuelve a escanearlo para sumar piezas.' });
      setExcludedScan(null); resumeCamera();
    } else setErrorMessage('No se pudo reincorporar el producto.');
  };
  const results = useMemo(() => query.trim().length >= 2 ? searchProducts(products, query, { limit: 8 }) : [], [products, query]);
  // Buscar mientras un panel espera respuesta equivale a descartar esa lectura y elegir otra.
  const releasePanels = () => { if (notFound || excludedScan) { setNotFound(null); setExcludedScan(null); inFlight.current = false; } };
  const chooseResult = (product: Product) => { releasePanels(); soundService.unlock(); setQuery(''); setSearchNotice(''); void handleDetectedCode(product.code); };
  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    releasePanels();
    if (!text) return;
    soundService.unlock();
    // Un lector USB/Bluetooth escribe el código y Enter: se cuenta si existe. Una descripción nunca crea productos.
    const looksLikeCode = !/\s/.test(text) && /\d/.test(text);
    const counts = Boolean(resolveScannedCode(products, text).product) || looksLikeCode || results.length === 1;
    if (counts && (inFlight.current || saving)) { setSearchNotice('Espera un instante: se está guardando la lectura anterior.'); return; }
    if (resolveScannedCode(products, text).product || looksLikeCode) { setQuery(''); setSearchNotice(''); void handleDetectedCode(text); return; }
    if (results.length === 1) { chooseResult(results[0].product); return; }
    setSearchNotice(results.length ? 'Elige el producto en la lista para contarlo.' : `Sin resultados para “${text}”. Prueba con otra palabra o con el código.`);
  };
  const changeLastQuantity = async (quantity: number) => {
    if (!lastScannedInfo || inFlight.current || saving) return;
    inFlight.current = true; pauseCamera();
    await persistCount(lastScannedInfo.code, quantity, 'set');
    scheduleResume();
  };
  const departments = [...new Set(products.filter(p => !p.excludedAt).map(p => p.department))].sort();
  const lastProduct = products.find(p => p.code === lastScannedInfo?.code);
  const lastQuantity = lastProduct?.physicalStock ?? lastScannedInfo?.quantity ?? 0;
  const difference = roundQuantity(lastQuantity - (lastProduct?.theoreticalStock ?? lastScannedInfo?.theoretical ?? 0));
  const FeedbackIcon = feedback ? toneIcon[feedback.tone] : null;

  return (
    <div className={`scanner-shell flex flex-col gap-4 w-full max-w-xl mx-auto ${preferences.highVisibility ? 'scanner-large' : ''}`}>
      <div className="scanner-tools">
        <div className="scanner-toggles" role="group" aria-label="Preferencias de captura">
        <button className="secondary" disabled={saving} aria-pressed={preferences.speechEnabled} onClick={() => {
          if (!('speechSynthesis' in window)) { setErrorMessage('Este navegador no admite voz sintetizada.'); return; }
          void onPreferencesChange?.({ ...preferences, speechEnabled: !preferences.speechEnabled });
        }}><Volume2 size={18} aria-hidden="true" /> Voz</button>
        <button className="secondary" disabled={saving} aria-pressed={preferences.highVisibility} onClick={() => { void onPreferencesChange?.({ ...preferences, highVisibility: !preferences.highVisibility }); }}><Eye size={18} aria-hidden="true" /> Letra grande</button>
        </div>
        <label>Zona activa<select disabled={saving} value={preferences.activeZoneDepartment ?? ''} onChange={e => { void onPreferencesChange?.({ ...preferences, activeZoneDepartment: e.target.value || undefined }); }}><option value="">Todos</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>
      {quantityRequest && <QuantityKeypadModal code={quantityRequest.code} product={products.find(p => p.code === quantityRequest.code)} initialMode={quantityRequest.correction ? 'set' : 'add'} initialValue={quantityRequest.correction ? String(lastQuantity) : ''} onClose={() => { setQuantityRequest(null); resumeCamera(); }} onSave={async (quantity, mode) => { const saved = await persistCount(quantityRequest.code, quantity, mode, quantityRequest.warnings); if (saved) { cooldown.current.release(quantityRequest.code); cooldown.current.accept(quantityRequest.code); } return saved; }} />}
      {/* Buscador: código de barras, clave interna o descripción. Un lector USB/Bluetooth también escribe aquí. */}
      <section className="scanner-search" aria-label="Buscar producto">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="search"
            disabled={saving} aria-label="Buscar producto por código o descripción"
            autoComplete="off"
            name="barcode"
            spellCheck={false}
            maxLength={128}
            placeholder="Código, clave o descripción…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchNotice(''); }}
            className="w-full bg-[var(--app-surface)] border border-white/10 focus:border-[var(--app-accent)] text-[var(--app-pearl)] placeholder-[#9a9a9a] text-sm rounded-full py-3.5 pl-5 pr-28 outline-none transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-bg)] text-xs font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
          >
            <Search className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
            Buscar
          </button>
        </form>
        {searchNotice && <p className="search-notice" role="status">{searchNotice}</p>}
        {results.length > 0 && <ul className="search-results" aria-label="Resultados de búsqueda">
          {results.map(({ product, excluded }) => (
            <li key={product.code}><button type="button" disabled={saving} onClick={() => chooseResult(product)}>
              <span className="search-result-name">{product.description}</span>
              <span className="search-result-meta"><code>{product.code}</code>{product.sku && <> · Clave {product.sku}</>} · {product.department}{!product.isUnregistered && <> · {money.format(product.price)}</>}</span>
              <span className={`search-result-state ${excluded ? 'is-excluded' : product.isUnregistered ? 'is-unregistered' : isCounted(product) ? 'is-counted' : ''}`}>
                {excluded ? 'Excluido' : product.isUnregistered ? 'No encontrado' : isCounted(product) ? `Contado: ${product.physicalStock}` : 'Pendiente'}
              </span>
            </button></li>
          ))}
        </ul>}
      </section>
      {/* Visor de Cámara con Retícula y Láser Dinámico */}
      <div className="relative bg-[var(--app-surface)] rounded-[28px] overflow-hidden border border-white/10 shadow-2xl scanner-camera min-h-[260px] flex flex-col items-center justify-center">
        <span className="scanner-hud-label" aria-hidden="true">{isScanning ? 'LECTOR / ACTIVO' : 'LECTOR / EN ESPERA'}</span>
        {isScanning && <div className="scan-reticle" aria-hidden="true" />}
        {flash > 0 && <div key={flash} className={`scan-flash tone-${feedback?.tone ?? 'found'}`} aria-hidden="true" />}
        <div id="interactive-scanner-view" className="w-full h-full min-h-[240px]" />

        {/* Overlay cuando el escáner no está activo */}
        {!isScanning && (
          <div className="absolute inset-0 bg-[var(--app-bg)]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center gap-5 z-10">
            <div className="scanner-camera-placeholder w-16 h-16 rounded-full bg-[var(--app-muted)]/20 text-[var(--app-muted)] flex items-center justify-center shadow-lg border border-[var(--app-muted)]/30">
              <CameraIcon size={32} solid />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--app-pearl)] tracking-tight">Escanear productos</h3>
              <p className="text-xs text-[#a8a8a8] max-w-xs mt-1.5 font-medium leading-relaxed">
                Apunta al código del producto (EAN-13, UPC, Code 128) para contar piezas automáticamente.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => startScanning()}
              className="primary scanner-start-button"
            >
              <CameraIcon size={20} solid aria-hidden="true" />
              <span>{busy ? 'Abriendo cámara…' : 'Activar Cámara'}</span>
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
                  torchOn ? 'bg-[var(--app-accent)] text-[var(--app-bg)] ring-4 ring-[var(--app-accent)]/40' : 'bg-[var(--app-bg)]/80 text-[var(--app-pearl)] border border-white/20'
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
              className="px-4 py-2 bg-[var(--app-danger-bg)] hover:bg-[#8e0019] text-[var(--app-pearl)] text-xs font-bold rounded-full backdrop-blur-md border border-white/20 shadow-lg cursor-pointer"
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
              className="bg-[var(--app-bg)]/90 backdrop-blur-xl text-xs font-bold text-[var(--app-pearl)] py-2 px-4 rounded-full border border-white/15 outline-none shadow-xl"
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

      {/* Resultado de la última lectura: color, icono y texto (nunca solo color) */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {feedback && FeedbackIcon && (
          <div className={`scan-feedback tone-${feedback.tone}`} data-tone={feedback.tone}>
            <FeedbackIcon size={26} aria-hidden="true" />
            <div><strong>{feedback.title}</strong>{feedback.detail && <span>{feedback.detail}</span>}</div>
          </div>
        )}
      </div>

      {notFound && <NotFoundPanel key={notFound.code} code={notFound.code} suggestions={notFound.suggestions} departments={departments} zone={preferences.activeZoneDepartment}
        defaultQuantity={scanMode === 'batch' ? batchQuantity : 1} saving={saving} canRegister={Boolean(onRegisterUnregistered)}
        onRegister={registerNotFound} onChoose={product => { setNotFound(null); inFlight.current = false; void handleDetectedCode(product.code); }} onClose={closeNotFound} />}

      {excludedScan && <div className="scan-panel tone-warning">
        <p>Este código se excluyó del conteo{excludedScan.excludedAt ? ` el ${new Date(excludedScan.excludedAt).toLocaleString('es-MX')}` : ''}. Sus piezas no suman mientras siga excluido.</p>
        <div className="scan-panel-actions">
          {onRestoreUnregistered && !excludedScan.linkedTo && <button className="primary" disabled={saving} onClick={() => { void restoreExcluded(); }}>Reincorporar al conteo</button>}
          <button className="secondary" onClick={() => { setExcludedScan(null); resumeCamera(); }}>Seguir escaneando</button>
        </div>
      </div>}

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2.5 p-4 bg-[var(--app-danger-bg)]/30 border border-[var(--app-danger-bg)] rounded-2xl text-[var(--app-pearl)] text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-[var(--app-accent)]" />
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
              ? 'bg-[var(--app-muted)] text-[var(--app-bg)] shadow-lg scale-[1.02]'
              : 'text-[#a8a8a8] hover:text-[var(--app-pearl)]'
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
              ? 'bg-[var(--app-accent)] text-[var(--app-bg)] shadow-lg scale-[1.02]'
              : 'text-[#a8a8a8] hover:text-[var(--app-pearl)]'
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
          <span className="text-xs text-[var(--app-muted)] font-bold uppercase tracking-wider">Unidades por caja:</span>
          <div className="flex items-center gap-2">
            {[6, 12, 24].map((qty) => (
              <button
                key={qty}
                disabled={saving}
                onClick={() => { setBatchDraft(null); void setBatchQuantity(qty); }}
                className={`px-3 py-1.5 text-xs rounded-full font-black transition-all cursor-pointer ${
                  batchQuantity === qty
                    ? 'bg-[var(--app-accent)] text-[var(--app-bg)] shadow-md'
                    : 'bg-[var(--app-bg)] text-[#a8a8a8] hover:text-[var(--app-pearl)] border border-white/10'
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
              step="1"
              value={batchDraft ?? batchQuantity}
              onChange={(e) => editBatchQuantity(e.target.value)}
              onBlur={() => setBatchDraft(null)}
              className="w-16 text-center bg-[var(--app-bg)] border border-[var(--app-accent)]/60 rounded-full py-1.5 text-sm font-black text-[var(--app-pearl)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Tarjeta de Último Escaneo estilo Swatch Card */}
      {lastScannedInfo && <section className="last-scan-card" aria-label="Último producto contado">
        <code>{lastScannedInfo.code}</code><h3>{lastProduct?.description ?? lastScannedInfo.description}</h3>
        <p>{lastScannedInfo.isNew ? (lastProduct?.note ? `Nota: ${lastProduct.note}` : 'Producto no encontrado en el catálogo') : `eleventa: ${lastProduct?.theoreticalStock ?? lastScannedInfo.theoretical} · Venta: ${money.format(lastProduct?.price ?? 0)} · ${lastProduct?.department ?? ''}`}</p>
        <div className="last-scan-controls">
          <button disabled={saving || lastQuantity <= 0} className="secondary" aria-label="Restar una pieza al último producto" onClick={() => { void changeLastQuantity(Math.max(0, roundQuantity(lastQuantity - 1))); }}>−</button>
          <button className="last-scan-number" disabled={saving} aria-label="Corregir cantidad del último producto" onClick={() => { void handleDetectedCode(lastScannedInfo.code, true); }}>{lastQuantity}</button>
          <button disabled={saving || lastQuantity >= 1e9} className="primary" aria-label="Sumar una pieza al último producto" onClick={() => { void changeLastQuantity(roundQuantity(lastQuantity + 1)); }}>+</button>
        </div>
        <span className={`last-scan-status ${lastScannedInfo.isNew ? 'unknown' : difference < 0 ? 'missing' : difference > 0 ? 'surplus' : 'match'}`}>
          {lastScannedInfo.isNew ? '✕ NO ENCONTRADO EN EL CATÁLOGO' : difference < 0 ? `↓ FALTAN ${Math.abs(difference)} PIEZAS` : difference > 0 ? `↑ SOBRAN ${difference} PIEZAS` : '✓ CUADRADO EXACTO'}
        </span>
        {onUndo && <button className="secondary scanner-undo" disabled={saving || !canUndo} onClick={async () => {
          if (inFlight.current) return; inFlight.current = true; pauseCamera();
          try { if (await onUndo()) { stopSpeech(); setErrorMessage(null); setFeedback(null); } else setErrorMessage('No se pudo deshacer el último conteo.'); }
          finally { resumeCamera(); }
        }}><Undo2 size={18} aria-hidden="true" /> Deshacer último conteo</button>}
      </section>}


    </div>
  );
};

function NotFoundPanel({ code, suggestions, departments, zone, defaultQuantity, saving, canRegister, onRegister, onChoose, onClose }: {
  code: string; suggestions: Product[]; departments: string[]; zone?: string; defaultQuantity: number; saving: boolean; canRegister: boolean;
  onRegister: (input: UnregisteredInput) => Promise<boolean>; onChoose: (product: Product) => void; onClose: () => void;
}) {
  const [name, setName] = useState(''), [note, setNote] = useState(''), [quantity, setQuantity] = useState(String(defaultQuantity));
  const [department, setDepartment] = useState(zone ?? '');
  const [error, setError] = useState('');
  const value = Number(quantity);
  return <section className="scan-panel tone-notfound" aria-labelledby="not-found-title">
    <div className="scan-panel-heading"><XCircle size={22} aria-hidden="true" /><h3 id="not-found-title" tabIndex={-1}>Código {code} no encontrado</h3>
      <button type="button" className="secondary" aria-label="Descartar lectura" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    {suggestions.length > 0 && <div className="scan-suggestions"><p>¿Es alguno de estos?</p>
      {suggestions.map(p => <button type="button" key={p.code} disabled={saving} onClick={() => onChoose(p)}><strong>{p.description}</strong><code>{p.code}</code></button>)}</div>}
    {canRegister && <form onSubmit={async e => {
      e.preventDefault();
      if (!validQuantity(value) || value <= 0) { setError('Escribe una cantidad mayor que cero.'); return; }
      setError('');
      if (!await onRegister({ code, name, note, quantity: value, department })) setError('No se guardó. Tus datos siguen aquí para volver a intentarlo.');
    }}>
      <fieldset className="workspace-fields not-found-fields" disabled={saving}>
        <label>Nombre o descripción<input name="unregisteredName" maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Galletas de avena sin etiqueta" /></label>
        <label>Cantidad encontrada<input name="unregisteredQuantity" inputMode="decimal" value={quantity} onChange={e => { if (/^\d*(?:[.,]\d{0,6})?$/.test(e.target.value)) setQuantity(e.target.value.replace(',', '.')); }} /></label>
        <label>Departamento<select name="unregisteredDepartment" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Sin clasificar</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>Observación (opcional)<input name="unregisteredNote" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej. Anaquel 4, sin precio" /></label>
        {error && <p role="alert" className="message warning">{error}</p>}
        <button className="primary">Agregar como no encontrado</button>
      </fieldset>
    </form>}
  </section>;
}
