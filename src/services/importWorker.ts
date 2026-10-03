import { parseEleventaExcel } from './eleventaParser';
import type { ColumnMapping } from '../types';
self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; mapping?: Partial<ColumnMapping> }>) => {
  try { self.postMessage(parseEleventaExcel(event.data.buffer, { mapping: event.data.mapping })); }
  catch { self.postMessage({ products: [], errors: ['No se pudo leer el archivo. Revisa que sea un Excel o CSV válido y que no esté protegido.'], issues: [], report: null }); }
};
