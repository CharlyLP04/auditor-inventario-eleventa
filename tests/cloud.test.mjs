import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketOf, codeKey, keyCode, departmentKey, BUCKETS, splitCatalog, planCapture, assembleProducts, verifyIntegrity, contributorsOf } from '../src/services/cloud/model.ts';
const product = overrides => ({ code: '001', description: 'Producto', cost: 10, price: 15, department: 'General', theoreticalStock: 5, physicalStock: 0, counted: false, ...overrides });

test('bucket assignment is deterministic and within range', () => {
  for (const code of ['001', '7501055300075', 'A/B', 'ñandú', '']) { const b = bucketOf(code); assert.ok(Number.isInteger(b) && b >= 0 && b < BUCKETS); assert.equal(bucketOf(code), b); }
});
test('buckets spread a catalog evenly enough', () => {
  const counts = Array(BUCKETS).fill(0);
  for (let i = 0; i < 16000; i++) counts[bucketOf(String(7500000000000 + i))]++;
  assert.ok(Math.max(...counts) < 1.3 * 1000 && Math.min(...counts) > 0.7 * 1000, counts.join(','));
});
test('document keys are valid Firestore ids, unique and reversible', () => {
  const codes = ['001', 'A/B', '.', '..', '__x__', 'a b', 'A%2FB', 'ñ'];
  const keys = codes.map(codeKey);
  assert.equal(new Set(keys).size, codes.length);
  for (const [i, key] of keys.entries()) {
    assert.ok(!key.includes('/') && key !== '.' && key !== '..' && !/^__.*__$/.test(key) && new TextEncoder().encode(key).length <= 1500, key);
    assert.equal(keyCode(key), codes[i]);
  }
  assert.notEqual(departmentKey('Lácteos'), departmentKey('Lacteos'));
});
test('catalog is split into chunks that fit a Firestore document', () => {
  const products = Array.from({ length: 1201 }, (_, i) => product({ code: String(i) }));
  const chunks = splitCatalog(products, 500);
  assert.deepEqual(chunks.map(c => c.length), [500, 500, 201]);
  assert.ok(chunks.every(c => c.every(p => p.physicalStock === 0 && p.counted === false)), 'el catálogo no debe llevar conteos');
});
test('adding pieces is a positive delta; fixing a total is a delta from what the device saw', () => {
  assert.deepEqual(planCapture(product({ physicalStock: 4, counted: true }), 3, 'add'), { delta: 3, observed: 4, total: 7 });
  assert.deepEqual(planCapture(product({ physicalStock: 4, counted: true }), 1, 'set'), { delta: -3, observed: 4, total: 1 });
  assert.deepEqual(planCapture(product(), 0, 'set'), { delta: 0, observed: 0, total: 0 });
  assert.throws(() => planCapture(product(), 0, 'add'));
  assert.throws(() => planCapture(product(), -1, 'set'));
  assert.throws(() => planCapture(product({ physicalStock: 1e9 }), 1, 'add'));
});
test('products combine the catalog with the shared counters', () => {
  const buckets = [{ q: { '001': 7, '002': 0 }, n: { '001': 2, '002': 1 }, u: { '001': { ana: 1, beto: 1 } } }];
  const products = assembleProducts([[product(), product({ code: '002' }), product({ code: '003' })]], buckets, []);
  const byCode = Object.fromEntries(products.map(p => [p.code, p]));
  assert.equal(byCode['001'].physicalStock, 7); assert.equal(byCode['001'].counted, true);
  assert.equal(byCode['002'].physicalStock, 0); assert.equal(byCode['002'].counted, true, 'un cero confirmado es un conteo');
  assert.equal(byCode['003'].counted, false);
  assert.deepEqual(contributorsOf(buckets, '001').sort(), ['ana', 'beto']);
});
test('not-found products keep one record per code with every person\'s label and their exclusion', () => {
  const buckets = [{ q: { X1: 5, X2: 1 }, n: { X1: 2, X2: 1 }, u: {} }];
  const unregistered = [
    { code: 'X1', department: 'Abarrotes', labels: { ana: { name: 'Galletas', note: 'Anaquel 4' }, beto: { name: 'Galletas avena' } } },
    { code: 'X2', name: 'Caja rota', excluded: true, excludedAt: '2026-10-03T10:00:00.000Z', reason: 'Otra tienda' },
  ];
  const products = assembleProducts([[product()]], buckets, unregistered);
  const x1 = products.find(p => p.code === 'X1');
  assert.equal(x1.isUnregistered, true); assert.equal(x1.physicalStock, 5); assert.equal(x1.department, 'Abarrotes');
  assert.equal(x1.description, 'Galletas'); assert.match(x1.note, /Anaquel 4/);
  const x2 = products.find(p => p.code === 'X2');
  assert.equal(x2.excludedAt, '2026-10-03T10:00:00.000Z'); assert.equal(x2.excludedReason, 'Otra tienda');
});
test('counts for a code missing from the catalog and the not-found list are still shown', () => {
  const products = assembleProducts([[product()]], [{ q: { ZZ: 2 }, n: { ZZ: 1 }, u: {} }], []);
  const orphan = products.find(p => p.code === 'ZZ');
  assert.ok(orphan?.isUnregistered); assert.equal(orphan.physicalStock, 2);
});
test('integrity check recomputes totals from captures and reports differences', () => {
  const captures = [{ code: '001', delta: 3 }, { code: '001', delta: -1 }, { code: '002', delta: 4 }];
  assert.deepEqual(verifyIntegrity(captures, [{ q: { '001': 2, '002': 4 }, n: {}, u: {} }]), []);
  assert.deepEqual(verifyIntegrity(captures, [{ q: { '001': 5, '002': 4, '003': 1 }, n: {}, u: {} }]), [
    { code: '001', captures: 2, counters: 5 }, { code: '003', captures: 0, counters: 1 },
  ]);
});
