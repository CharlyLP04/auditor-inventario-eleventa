import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchProducts, normalizeText, resolveScannedCode } from '../src/services/productSearch.ts';
const product = overrides => ({ code: '001', description: 'Producto', cost: 10, price: 15, department: 'General', theoreticalStock: 5, physicalStock: 0, ...overrides });
const catalog = [
  product({ code: '7501055300075', description: 'Café Molido Clásico 400 g', department: 'Abarrotes' }),
  product({ code: '7501055300082', description: 'Café Molido Descafeinado 400 g', department: 'Abarrotes' }),
  product({ code: '012345678905', description: 'Leche Entera 1 L', department: 'Lácteos' }),
  product({ code: 'A-100', sku: 'INT-77', description: 'Bolsa de hielo', department: 'Congelados' }),
  product({ code: '99', description: 'Chiles serranos', department: 'Frutas y verduras' }),
];
const codes = results => results.map(r => r.product.code);
test('normalizes accents, case and extra spaces', () => assert.equal(normalizeText('  CAFÉ   Molído '), 'cafe molido'));
test('exact barcode is the first result', () => assert.equal(searchProducts(catalog, '7501055300082')[0].product.code, '7501055300082'));
test('exact code ignores surrounding spaces and letter case', () => assert.equal(searchProducts(catalog, '  a-100 ')[0].match, 'code'));
test('internal SKU finds the product', () => { const [first] = searchProducts(catalog, 'int-77'); assert.equal(first.product.code, 'A-100'); assert.equal(first.match, 'sku'); });
test('description words match in any order without accents', () => assert.deepEqual(codes(searchProducts(catalog, 'molido cafe')), ['7501055300075', '7501055300082']));
test('partial words match by prefix', () => assert.deepEqual(codes(searchProducts(catalog, 'desca caf')), ['7501055300082']));
test('plural and singular are treated alike', () => assert.deepEqual(codes(searchProducts(catalog, 'chile serrano')), ['99']));
test('partial barcode finds the product', () => assert.deepEqual(codes(searchProducts(catalog, '5300075')), ['7501055300075']));
test('empty query or no match returns an empty list', () => { assert.deepEqual(searchProducts(catalog, '   '), []); assert.deepEqual(searchProducts(catalog, 'tornillo'), []); });
test('results are limited', () => assert.equal(searchProducts(catalog, 'cafe', { limit: 1 }).length, 1));
test('excluded products are flagged, not hidden', () => {
  const [first] = searchProducts([product({ code: 'X1', description: 'Caja rota', isUnregistered: true, excludedAt: '2026-10-03T00:00:00.000Z' })], 'caja');
  assert.equal(first.product.code, 'X1');
  assert.equal(first.excluded, true);
});
test('scanned EAN-13 with a leading zero resolves to the 12-digit UPC in the catalog', () => {
  const result = resolveScannedCode(catalog, '0012345678905');
  assert.equal(result.product?.code, '012345678905');
  assert.equal(result.match, 'leading_zeros');
});
test('exact scan resolves without a warning', () => assert.equal(resolveScannedCode(catalog, '7501055300075').match, 'exact'));
test('short codes never match by removing zeros', () => assert.equal(resolveScannedCode(catalog, '099').product, undefined));
test('unknown scan offers zero-insensitive and partial suggestions', () => {
  const result = resolveScannedCode(catalog, '750105530007');
  assert.equal(result.product, undefined);
  assert.ok(result.suggestions.some(p => p.code === '7501055300075'));
});
test('search over 20,000 products stays fast', () => {
  const big = Array.from({ length: 20000 }, (_, i) => product({ code: String(7500000000000 + i), description: `Producto genérico número ${i} sabor ${i % 7}` }));
  searchProducts(big, 'warm up');
  const start = performance.now();
  for (let i = 0; i < 20; i++) searchProducts(big, `sabor ${i % 7} numero 1${i}`);
  assert.ok((performance.now() - start) / 20 < 30, 'más de 30 ms por búsqueda');
});
