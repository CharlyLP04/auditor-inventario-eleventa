import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { calculateStats, catalogVerification } from '../src/services/auditState.ts';
import { parseEleventaExcel } from '../src/services/eleventaParser.ts';
import { createAuditWorkbook, createEleventaAdjustmentWorkbook } from '../src/services/eleventaExporter.ts';
import { parseMasterBackup } from '../src/services/storageIndexedDB.ts';
import { departmentStats } from '../src/services/scannerState.ts';
import { assembleProducts } from '../src/services/cloud/model.ts';
const product = (override = {}) => ({ code: '001', description: 'Café', cost: 10, price: 15, department: 'General', theoreticalStock: 5, physicalStock: 0, counted: false, ...override });
test('unregistered scans never increase catalog totals or progress', () => {
  const products = Array.from({ length: 100 }, (_, i) => product({ code: String(i) })).concat(Array.from({ length: 5 }, (_, i) => product({ code: `X${i}`, isUnregistered: true, physicalStock: 1, counted: true })));
  const stats = calculateStats(products), verification = catalogVerification(products);
  assert.equal(stats.totalCatalog, 100); assert.equal(stats.auditedCount, 0); assert.equal(stats.unregisteredCount, 5);
  assert.equal(stats.totalCatalog, verification.expected); assert.equal(stats.auditedCount, verification.found); assert.equal(verification.progress, 0);
});
test('quoted tabs and escaped quotes do not change a CSV delimiter', () => {
  const result = parseEleventaExcel(new TextEncoder().encode('Codigo,Descripcion,Inventario\n001,"Café\tmolido ""especial""",5\n').buffer);
  assert.deepEqual(result.errors, []); assert.equal(result.products[0].description, 'Café\tmolido "especial"'); assert.equal(result.products[0].theoreticalStock, 5);
});
test('semicolon text preserves commas and tabs inside quoted fields', () => {
  const result = parseEleventaExcel(new TextEncoder().encode('Codigo;Descripcion;Inventario\n001;"Café,\tmolido";5\n').buffer);
  assert.deepEqual(result.errors, []); assert.equal(result.products[0].description, 'Café,\tmolido');
});
test('both adjustment exports have identical headers, quantities and text barcode formatting', () => {
  const products = [product({ counted: true, physicalStock: 1.12345678, wholesalePrice: 12, minStock: 2 }), product({ code: '002', counted: true })];
  const individual = createEleventaAdjustmentWorkbook(products).Sheets.Ajuste_Inventario_eleventa;
  const report = createAuditWorkbook(products, calculateStats(products)).Sheets.Ajuste_Inventario_eleventa;
  assert.deepEqual(report, individual); assert.equal(report.A2.t, 's'); assert.equal(report.A2.z, '@');
  const rows = XLSX.utils.sheet_to_json(report, { defval: null });
  assert.equal(rows[0].Inventario, 1.123457); assert.equal(rows[0]['Precio Mayoreo'], 12); assert.equal(rows[1]['Precio Mayoreo'], null); assert.equal(rows[1]['Inv. Minimo'], null);
});
test('excluded and linked rows preserve trace but have no numeric physical total', () => {
  const products = [product({ counted: true }), product({ code: 'X', isUnregistered: true, physicalStock: 6, counted: true, excludedAt: '2026-10-04T00:00:00Z' }), product({ code: 'Y', isUnregistered: true, physicalStock: 3, counted: true, linkedTo: '001' })];
  const sheet = createAuditWorkbook(products, calculateStats(products)).Sheets['Auditoría_Discrepancias'];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  assert.equal(rows[1]['Stock Físico (Contado)'], null); assert.equal(rows[2]['Stock Físico (Contado)'], null); assert.match(rows[2].Estado, /001/);
});
test('master backup keeps PIN leading zeroes', () => {
  const data = { companies: [], audits: [], activeCompanyId: null, activeAuditId: null, profile: { serviceName: '', auditorName: '', letterhead: '' }, security: { adminPin: '0042' } };
  assert.deepEqual(parseMasterBackup(JSON.stringify({ format: 'auditor-eleventa-master', version: 1, data })).security, { adminPin: '0042' });
});
test('departments containing only linked or excluded entries disappear', () => {
  assert.deepEqual(departmentStats([product({ isUnregistered: true, linkedTo: 'other' }), product({ code: '002', excludedAt: '2026-10-04T00:00:00Z' })]), []);
});
test('legacy negative cloud counters cannot expose negative stock', () => {
  const products = assembleProducts([[product()]], [{ q: { '001': -6, X: -8 }, n: { '001': 1, X: 1 }, u: {} }], []);
  assert.equal(products.find(p => p.code === '001').physicalStock, 0); assert.equal(products.find(p => p.code === 'X').physicalStock, 0);
});
