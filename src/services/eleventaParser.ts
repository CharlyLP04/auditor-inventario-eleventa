import * as XLSX from 'xlsx';
import type { Product, ColumnMapping, ImportField, ImportIssue, ImportResult } from '../types';
import { MAX_QUANTITY } from './auditState';
const normalize = (value: unknown) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
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
export const FIELD_LABELS: Record<ImportField, string> = {
  code: 'Código de barras', sku: 'Clave interna', description: 'Descripción', stock: 'Existencia', cost: 'Costo',
  price: 'Precio de venta', wholesale: 'Precio mayoreo', minimum: 'Inventario mínimo', department: 'Departamento', unit: 'Tipo de venta',
};
export const REQUIRED_FIELDS: ImportField[] = ['code', 'description', 'stock'];
// Variantes reales de encabezados (sin acentos, espacios ni signos). El orden de los campos define la prioridad.
const ALIASES: Record<ImportField, string[]> = {
  code: ['codigo', 'codigodebarras', 'codigobarras', 'code', 'barcode', 'upc', 'ean', 'codigoproducto', 'clave'],
  sku: ['sku', 'claveinterna', 'codigointerno', 'claveproducto', 'clavearticulo', 'clave'],
  description: ['descripcion', 'nombre', 'articulo', 'producto', 'nombredelproducto', 'descripciondelproducto', 'descripcionproducto'],
  stock: ['existencia', 'existencias', 'stock', 'cantidad', 'hay', 'stockteoricoeleventa', 'inventario', 'existenciaactual', 'stockactual', 'cantidadactual', 'inventarioactual'],
  cost: ['costo', 'costounitario', 'preciocosto', 'preciodecompra', 'compra', 'costopromedio', 'ultimocosto', 'costoactual', 'pcosto'],
  price: ['precio', 'precioventa', 'preciodeventa', 'venta', 'preciopublico', 'pventa', 'pvp', 'preciounitario', 'preciodeventaalpublico', 'precio1'],
  wholesale: ['preciomayor', 'pmayoreo', 'preciomayorista', 'preciomayoreo', 'preciodemayoreo', 'mayoreo'],
  minimum: ['invmin', 'minimo', 'invminimo', 'inventariominimo', 'existenciaminima', 'stockminimo'],
  department: ['departamento', 'categoria', 'familia', 'depto', 'linea'],
  unit: ['tipo', 'tipodeventa', 'unidad'],
};
const FIELDS = Object.keys(ALIASES) as ImportField[];
const emptyMapping = (): ColumnMapping => Object.fromEntries(FIELDS.map(f => [f, -1])) as ColumnMapping;
function detect(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalize);
  const mapping = emptyMapping(), used = new Set<number>();
  for (const field of FIELDS) {
    // Se respeta el orden de los sinónimos: "Código" gana a "Clave" como código de barras.
    for (const alias of ALIASES[field]) {
      const column = normalized.findIndex((h, i) => h === alias && !used.has(i));
      if (column >= 0) { mapping[field] = column; used.add(column); break; }
    }
  }
  return mapping;
}
export interface ParseOptions { mapping?: Partial<ColumnMapping>; }
function readWorkbook(fileBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(fileBuffer);
  const prefix = bytes.subarray(0, 512);
  // Algunos .xls de eleventa son TSV en Windows-1252 y muchos CSV son UTF-8 sin BOM, no libros binarios.
  // Decodificar el texto explícitamente conserva acentos y códigos con ceros iniciales.
  const isText = !prefix.includes(0)
    && !(prefix[0] === 0x50 && prefix[1] === 0x4b)
    && !(prefix[0] === 0xd0 && prefix[1] === 0xcf);
  if (!isText) return XLSX.read(fileBuffer, { type: 'array', raw: true, cellText: true, sheetRows: 20022 });
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('windows-1252').decode(bytes); }
  return XLSX.read(text, { type: 'string', ...(prefix.includes(9) ? { FS: '\t' } : {}), raw: true, cellText: true, sheetRows: 20022 });
}
export function parseEleventaExcel(fileBuffer: ArrayBuffer, options: ParseOptions = {}): ImportResult {
  const workbook = readWorkbook(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const report = { headerRow: -1, headers: [] as string[], mapping: emptyMapping(), fileRows: 0, imported: 0, issues: [] as ImportIssue[], unusedColumns: [] as string[], warnings: [] as string[] };
  const fail = (message: string): ImportResult => ({ products: [], errors: [message], issues: [], report });
  if (!worksheet) return fail('El archivo no contiene hojas.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  const blank = (row: unknown[] | undefined) => !row || row.every(value => value === '' || value == null);
  // Encabezado: la primera de las 20 primeras filas con código y descripción reconocibles.
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const found = detect(rows[index].map(v => String(v ?? '').trim()));
    if (found.code !== -1 && found.description !== -1) { report.headerRow = index; report.mapping = found; break; }
  }
  if (report.headerRow < 0) {
    // Sin encabezado reconocible se ofrece la primera fila con datos para que el usuario indique las columnas.
    report.headerRow = rows.findIndex((row, i) => i < 20 && !blank(row));
    if (report.headerRow < 0) return fail('El archivo no contiene productos.');
  }
  report.headers = rows[report.headerRow].map(v => String(v ?? '').trim());
  if (options.mapping) {
    const manual = Object.entries(options.mapping).filter(([, column]) => typeof column === 'number' && column >= 0) as [ImportField, number][];
    const columns = manual.map(([, column]) => column);
    if (new Set(columns).size !== columns.length) return fail('Asignaste la misma columna a dos campos. Cada columna corresponde a un solo dato.');
    if (columns.some(c => !Number.isInteger(c) || c >= report.headers.length)) return fail('Una columna asignada no existe en el archivo.');
    const automatic = report.mapping;
    report.mapping = emptyMapping();
    for (const field of FIELDS) {
      const chosen = options.mapping[field];
      if (chosen !== undefined) report.mapping[field] = chosen >= 0 ? chosen : -1;
      else if (automatic[field] >= 0 && !columns.includes(automatic[field])) report.mapping[field] = automatic[field];
    }
  }
  const columns = report.mapping;
  const missing = REQUIRED_FIELDS.filter(field => columns[field] < 0);
  if (missing.length) return fail(`Faltan columnas obligatorias: ${missing.map(f => FIELD_LABELS[f]).join(', ')}. Indica qué columna corresponde a cada campo.`);
  if (columns.price < 0) report.warnings.push('No se encontró la columna de precio de venta: los productos quedarán sin precio y el balance a venta será $0. Asígnala si el archivo la tiene.');
  if (columns.cost < 0) report.warnings.push('No se encontró la columna de costo: el costo quedará en $0 (el balance se calcula a precio de venta).');
  const usedColumns = new Set(Object.values(columns).filter(c => c >= 0));
  report.unusedColumns = report.headers.filter((name, i) => name && !usedColumns.has(i));
  const dataRows = rows.length - report.headerRow - 1;
  if (dataRows > 20000) return fail('El catálogo supera el límite de 20,000 filas. Divide el archivo.');
  const products: Product[] = [];
  const seen = new Map<string, number>();
  const cellValue = (row: unknown[], column: number) => column >= 0 ? row[column] : undefined;
  for (let index = report.headerRow + 1; index < rows.length; index++) {
    const row = rows[index];
    if (blank(row)) continue;
    report.fileRows++;
    const sheetRow = index + 1;
    let code: string | undefined;
    try {
      const rawCode = row[columns.code];
      if (typeof rawCode === 'number' && (!Number.isSafeInteger(rawCode) || rawCode < 0)) throw new Error('el código numérico perdió precisión; guárdalo como texto');
      const cell = worksheet[XLSX.utils.encode_cell({ r: index, c: columns.code })];
      code = typeof rawCode === 'number' && cell?.w && /^0+\d+$/.test(cell.w) ? cell.w : String(rawCode ?? '').trim();
      if (!code || code.length > 128) throw new Error('falta un código válido (máximo 128 caracteres)');
      const firstRow = seen.get(code);
      if (firstRow !== undefined) throw new Error(`código duplicado: igual que la fila ${firstRow}; se conservó la primera`);
      const description = String(row[columns.description] ?? '').trim();
      const sku = String(cellValue(row, columns.sku) ?? '').trim().slice(0, 128);
      // eleventa puede exportar productos cuyo nombre está en Código y la descripción vacía.
      // Se usa el código para mostrarlos y se conserva el campo original para exportar.
      products.push({ code, description: description || code, sourceDescription: description,
        theoreticalStock: numeric(row[columns.stock], 'Existencia', true), physicalStock: 0,
        cost: numeric(cellValue(row, columns.cost), 'Costo'), price: numeric(cellValue(row, columns.price), 'Precio de venta'),
        wholesalePrice: columns.wholesale >= 0 ? numeric(row[columns.wholesale], 'Precio Mayoreo') : undefined,
        minStock: columns.minimum >= 0 ? numeric(row[columns.minimum], 'Inv. Minimo') : undefined,
        department: String(cellValue(row, columns.department) ?? '').trim() || 'General',
        unitType: normalize(cellValue(row, columns.unit)) === 'granel' ? 'granel' : 'unidad', counted: false,
        ...(sku ? { sku } : {}) });
      seen.set(code, sheetRow);
    } catch (error) {
      report.issues.push({ row: sheetRow, ...(code ? { code } : {}), reason: error instanceof Error ? error.message : 'datos inválidos' });
    }
  }
  report.imported = products.length;
  if (!products.length) return { products, errors: [report.issues.length ? 'Ninguna fila es válida. Revisa las filas señaladas.' : 'El archivo no contiene productos.'], issues: report.issues, report };
  return { products, errors: [], issues: report.issues, report };
}
