import * as XLSX from 'xlsx';
import type { Product } from '../types';

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function sanitizeBarcode(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    return val.toLocaleString('fullwide', { useGrouping: false });
  }
  const str = String(val).trim();
  return str.replace(/\.0+$/, '');
}

export function parseEleventaExcel(fileBuffer: ArrayBuffer): { products: Product[]; errors: string[] } {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  if (!rawData || rawData.length < 2) {
    return { products: [], errors: ['El archivo de Excel parece estar vacío o no contiene filas de datos.'] };
  }

  let headerRowIndex = 0;
  let codeColIdx = -1;
  let descColIdx = -1;
  let stockColIdx = -1;
  let costColIdx = -1;
  let priceColIdx = -1;
  let deptColIdx = -1;

  for (let r = 0; r < Math.min(5, rawData.length); r++) {
    const row = rawData[r];
    if (!Array.isArray(row)) continue;

    const normalizedRow = row.map(cell => normalizeHeader(String(cell || '')));

    const foundCode = normalizedRow.findIndex(h => 
      h.includes('codigo') || h === 'code' || h === 'barcode' || h === 'clave'
    );
    const foundDesc = normalizedRow.findIndex(h => 
      h.includes('descrip') || h.includes('nombre') || h.includes('articulo') || h.includes('producto')
    );

    if (foundCode !== -1 && foundDesc !== -1) {
      headerRowIndex = r;
      codeColIdx = foundCode;
      descColIdx = foundDesc;
      stockColIdx = normalizedRow.findIndex(h => 
        h.includes('existencia') || h.includes('stock') || h.includes('cantidad') || h === 'hay'
      );
      costColIdx = normalizedRow.findIndex(h => 
        h.includes('costo') || h.includes('compra')
      );
      priceColIdx = normalizedRow.findIndex(h => 
        h.includes('precio') || h.includes('venta')
      );
      deptColIdx = normalizedRow.findIndex(h => 
        h.includes('departamento') || h.includes('categoria') || h.includes('familia')
      );
      break;
    }
  }

  if (codeColIdx === -1 || descColIdx === -1) {
    return {
      products: [],
      errors: [
        'No se encontraron las columnas requeridas ("Código" y "Descripción"). Asegúrate de exportar desde F3 Productos o F4 Inventario en eleventa.'
      ]
    };
  }

  const products: Product[] = [];
  const errors: string[] = [];

  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawCode = row[codeColIdx];
    const code = sanitizeBarcode(rawCode);
    const description = String(row[descColIdx] || '').trim();

    if (!code && !description) continue;

    const rawStock = stockColIdx !== -1 ? row[stockColIdx] : 0;
    const theoreticalStock = Number(rawStock) || 0;

    const rawCost = costColIdx !== -1 ? row[costColIdx] : 0;
    const cost = Number(rawCost) || 0;

    const rawPrice = priceColIdx !== -1 ? row[priceColIdx] : 0;
    const price = Number(rawPrice) || 0;

    const department = deptColIdx !== -1 ? String(row[deptColIdx] || 'General').trim() : 'General';

    products.push({
      code: code || `SINC-${r}`,
      description: description || 'Sin Descripción',
      cost,
      price,
      department: department || 'General',
      theoreticalStock,
      physicalStock: 0,
      unitType: 'unidad',
    });
  }

  return { products, errors };
}

export function getDemoEleventaProducts(): Product[] {
  return [
    {
      code: '7501055365449',
      description: 'Coca Cola Original 600 ml',
      cost: 14.50,
      price: 19.00,
      department: 'Bebidas',
      theoreticalStock: 24,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501000111459',
      description: 'Papas Sabritas Sal 45g',
      cost: 15.20,
      price: 21.00,
      department: 'Botanas',
      theoreticalStock: 18,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501008041239',
      description: 'Galletas Emperador Chocolate 101g',
      cost: 16.00,
      price: 22.50,
      department: 'Galletas',
      theoreticalStock: 15,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501020515152',
      description: 'Leche Lala Entera 1 Litro',
      cost: 23.00,
      price: 29.50,
      department: 'Lácteos',
      theoreticalStock: 30,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501001400279',
      description: 'Aceite Nutrioli Puro de Soya 850ml',
      cost: 38.00,
      price: 49.00,
      department: 'Abarrotes',
      theoreticalStock: 12,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501030467558',
      description: 'Atún Dolores en Agua 140g',
      cost: 19.50,
      price: 25.00,
      department: 'Enlatados',
      theoreticalStock: 20,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501055304745',
      description: 'Agua Ciel Purificada 1 Litro',
      cost: 9.00,
      price: 13.00,
      department: 'Bebidas',
      theoreticalStock: 16,
      physicalStock: 0,
      unitType: 'unidad',
    },
    {
      code: '7501030491027',
      description: 'Mayonesa McCormick con Limón 390g',
      cost: 32.00,
      price: 42.00,
      department: 'Abarrotes',
      theoreticalStock: 8,
      physicalStock: 0,
      unitType: 'unidad',
    },
  ];
}
