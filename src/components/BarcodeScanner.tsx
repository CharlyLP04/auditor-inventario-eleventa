import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, Plus, Layers, Zap, AlertCircle, Search } from 'lucide-react';

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

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('trasera') || 
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCamera(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMessage('No se detectaron cámaras en este dispositivo.');
        }
      })
      .catch(err => {
        console.warn('Error al listar cámaras:', err);
        setErrorMessage('Permiso de cámara no concedido o requiere HTTPS.');
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async (cameraId?: string) => {
    const camId = cameraId || selectedCamera;
    if (!camId) return;

    setErrorMessage(null);

    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const html5QrCode = new Html5Qrcode('interactive-scanner-view', {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        camId,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {}
      );

      setIsScanning(true);

      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.error('Error al iniciar escáner:', err);
      setIsScanning(false);
      setErrorMessage('No se pudo iniciar la cámara. Asegúrate de dar permisos de cámara.');
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error al detener escáner:', err);
      }
    }
    setIsScanning(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        // @ts-expect-error torch capability
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Error alternando linterna:', e);
    }
  };

  const handleDetectedCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1200) {
      return;
    }

    lastScannedCodeRef.current = trimmed;
    lastScannedTimeRef.current = now;

    const qty = scanMode === 'batch' ? batchQuantity : 1;
    onScan(trimmed, qty);
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const qty = scanMode === 'batch' ? batchQuantity : 1;
    onScan(manualCode.trim(), qty);
    setManualCode('');
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl min-h-[320px] flex flex-col items-center justify-center">
        <div id="interactive-scanner-view" className="w-full h-full min-h-[300px]" />

        {!isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-4 z-10">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Escáner de Códigos de Barra</h3>
              <p className="text-sm text-slate-400 max-w-xs mt-1">
                Apunta la cámara del celular al código del producto (EAN-13, UPC, Code 128)
              </p>
            </div>
            <button
              onClick={() => startScanning()}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-5 h-5" />
              Activar Cámara
            </button>
          </div>
        )}

        {isScanning && (
          <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  torchOn ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40' : 'bg-slate-900/80 text-slate-300'
                }`}
                title="Linterna / Flash"
              >
                <Flashlight className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={stopScanning}
              className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold rounded-full backdrop-blur-md"
            >
              Detener
            </button>
          </div>
        )}

        {isScanning && cameras.length > 1 && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center">
            <select
              value={selectedCamera}
              onChange={(e) => {
                setSelectedCamera(e.target.value);
                startScanning(e.target.value);
              }}
              className="bg-slate-950/80 backdrop-blur-md text-xs text-slate-200 py-1.5 px-3 rounded-lg border border-slate-700 outline-none"
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
        <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setScanMode('single')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            scanMode === 'single'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-4 h-4" />
          Modo Unidad (+1)
        </button>
        <button
          onClick={() => setScanMode('batch')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            scanMode === 'batch'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Modo Caja (+N)
        </button>
      </div>

      {scanMode === 'batch' && (
        <div className="flex items-center justify-between bg-indigo-950/30 border border-indigo-800/40 p-3 rounded-xl">
          <span className="text-sm text-indigo-300 font-medium">Cantidad a sumar por escaneo:</span>
          <div className="flex items-center gap-1.5">
            {[6, 12, 24].map((qty) => (
              <button
                key={qty}
                onClick={() => setBatchQuantity(qty)}
                className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
                  batchQuantity === qty
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                +{qty}
              </button>
            ))}
            <input
              type="number"
              min="1"
              value={batchQuantity}
              onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 text-center bg-slate-900 border border-indigo-500/50 rounded-md py-1 text-sm font-bold text-white focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      )}

      {lastScannedInfo && (
        <div className={`p-4 rounded-xl border transition-all ${
          lastScannedInfo.isNew 
            ? 'bg-amber-950/30 border-amber-500/40' 
            : 'bg-emerald-950/30 border-emerald-500/40'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <span className="text-xs font-mono text-slate-400">{lastScannedInfo.code}</span>
              <h4 className="font-semibold text-white text-base leading-tight mt-0.5">
                {lastScannedInfo.description}
              </h4>
              {lastScannedInfo.isNew ? (
                <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚠️ No registrado en eleventa
                </span>
              ) : (
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-300">
                  <span>En eleventa: <strong className="text-slate-100">{lastScannedInfo.theoretical}</strong></span>
                  <span>Físico contado: <strong className="text-emerald-400 text-sm">{lastScannedInfo.quantity}</strong></span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">
                {lastScannedInfo.quantity}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Total Físico</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="relative flex items-center">
        <input
          type="text"
          placeholder="Digitar código o usar pistola USB / Bluetooth..."
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 text-slate-100 placeholder-slate-500 text-sm rounded-xl py-3 pl-4 pr-24 outline-none transition-colors"
        />
        <button
          type="submit"
          className="absolute right-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Ingresar
        </button>
      </form>
    </div>
  );
};
