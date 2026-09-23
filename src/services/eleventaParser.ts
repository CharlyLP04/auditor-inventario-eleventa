import * as XLSX from 'xlsx';
import type { Product } from '../types';
import { MAX_QUANTITY } from './auditState';
const normalize = (value: unknown) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function numeric(value: unknown, label: string, negative = false): number {
  if (value === undefined || value === null || value === '') return 0;
  let cleaned = value;
  if (typeof value === 'string') {
    const text = value.trim().replace(/^(?:MXN|\$)\s*/i, '').replace(/\s*MXN$/i, '');
    if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) throw new Error(`${label}: número inválido “${value}”`);
    cleaned = text.replace(/,/g, '');
  }
  if (typeof cleaned !== 'number' && typeof cleaned !== 'string') throw new Error(`${label}: valor inválido`);
  const result = Number(cleaned);
  if (!Number.isFinite(result) || Math.abs(result) > MAX_QUANTITY || (!negative && result < 0)) throw new Error(`${label}: valor fuera de rango`);
  return result;
}
export function parseEleventaExcel(fileBuffer: ArrayBuffer): { products: Product[]; errors: string[] } {
  const bytes = new Uint8Array(fileBuffer);
  const prefix = bytes.subarray(0, 512);
  // Algunos .xls de eleventa son TSV en Windows-1252, no libros binarios.
  // Leer el texto explícitamente conserva acentos y códigos con ceros iniciales.
  const isTabSeparatedText = prefix.includes(9) && !prefix.includes(0)
    && !(prefix[0] === 0x50 && prefix[1] === 0x4b)
    && !(prefix[0] === 0xd0 && prefix[1] === 0xcf);
  let workbook: XLSX.WorkBook;
  if (isTabSeparatedText) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('windows-1252').decode(bytes); }
    workbook = XLSX.read(text, { type: 'string', FS: '\t', raw: true, cellText: true, sheetRows: 20022 });
  } else {
    workbook = XLSX.read(fileBuffer, { type: 'array', raw: true, cellText: true, sheetRows: 20022 });
  }
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return { products: [], errors: ['El archivo no contiene hojas.'] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  const aliases = {
    code: ['codigo', 'codigodebarras', 'codigobarras', 'code', 'barcode', 'clave'],
    description: ['descripcion', 'nombre', 'articulo', 'producto', 'nombredelproducto'],
    stock: ['existencia', 'existencias', 'stock', 'cantidad', 'hay', 'stockteoricoeleventa', 'inventario'],
    cost: ['costo', 'costounitario', 'preciocosto', 'preciodecompra', 'compra'],
    price: ['precio', 'precioventa', 'preciodeventa', 'venta'],
    wholesale: ['preciomayor', 'pmayoreo', 'preciomayorista', 'preciomayoreo', 'preciodemayoreo', 'mayoreo'],
    minimum: ['invmin', 'minimo', 'invminimo', 'inventariominimo', 'existenciaminima', 'stockminimo'],
    department: ['departamento', 'categoria', 'familia'],
    unit: ['tipo', 'tipodeventa', 'unidad'],
  };
  let header = -1;
  let columns: Record<keyof typeof aliases, number> = { code: -1, description: -1, stock: -1, cost: -1, price: -1, wholesale: -1, minimum: -1, department: -1, unit: -1 };
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const normalized = rows[index].map(normalize);
    const found = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, normalized.findIndex(h => names.includes(h))])) as typeof columns;
    if (found.code !== -1 && found.description !== -1) { header = index; columns = found; break; }
  }
  if (header < 0 || columns.stock < 0) return { products: [], errors: ['Se requieren columnas Código, Descripción y Existencia. Revisa el archivo exportado desde eleventa.'] };
  if (rows.length - header - 1 > 20000) return { products: [], errors: ['El catálogo supera el límite de 20,000 filas. Divide el archivo.'] };
  const products: Product[] = [], errors: string[] = [];
  const seen = new Set<string>();
  for (let index = header + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every(value => value === '' || value == null)) continue;
    try {
      const rawCode = row[columns.code];
      if (typeof rawCode === 'number' && (!Number.isSafeInteger(rawCode) || rawCode < 0)) throw new Error('el código numérico perdió precisión; guárdalo como texto');
      const cell = worksheet[XLSX.utils.encode_cell({ r: index, c: columns.code })];
      const code = typeof rawCode === 'number' && cell?.w && /^0+\d+$/.test(cell.w) ? cell.w : String(rawCode ?? '').trim();
      if (!code || code.length > 128) throw new Error('falta un código válido (máximo 128 caracteres)');
      if (seen.has(code)) throw new Error(`código duplicado: ${code}`);
      seen.add(code);
      const description = String(row[columns.description] ?? '').trim();
      // eleventa puede exportar productos cuyo nombre está en Código y la descripción vacía.
      // Se usa el código para mostrarlos y se conserva el campo original para exportar.
      products.push({ code, description: description || code, sourceDescription: description,
        theoreticalStock: numeric(row[columns.stock], 'Existencia', true), physicalStock: 0,
        cost: numeric(row[columns.cost], 'Costo'), price: numeric(row[columns.price], 'Precio de venta'),
        wholesalePrice: columns.wholesale >= 0 ? numeric(row[columns.wholesale], 'Precio Mayoreo') : undefined,
        minStock: columns.minimum >= 0 ? numeric(row[columns.minimum], 'Inv. Minimo') : undefined,
        department: String(row[columns.department] ?? '').trim() || 'General',
        unitType: normalize(row[columns.unit]) === 'granel' ? 'granel' : 'unidad', counted: false });
    } catch (error) { errors.push(`Fila ${index + 1}: ${error instanceof Error ? error.message : 'datos inválidos'}.`); }
    if (errors.length >= 20) { errors.push('Corrige estas filas y vuelve a importar para revisar el resto.'); break; }
  }
  if (!products.length && !errors.length) errors.push('El archivo no contiene productos.');
  // Reject the whole import to avoid replacing a catalog with a silently incomplete subset.
  return { products: errors.length ? [] : products, errors };
}
