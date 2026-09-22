import { parseEleventaExcel } from './eleventaParser';
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage(parseEleventaExcel(event.data)); }
  catch { self.postMessage({ products: [], errors: ['No se pudo leer el archivo. Revisa que sea un Excel o CSV válido y que no esté protegido.'] }); }
};
