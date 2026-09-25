import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCount, revertCount, ScanCooldown, departmentStats, validatePin, requireAdmin } from '../src/services/scannerState.ts';
const p = (extra = {}) => ({ code: '001', description: 'Leche', cost: 10, price: 15, department: 'Lácteos', theoreticalStock: 10, physicalStock: 0, counted: false, ...extra });
test('count adds, replaces and confirms zero without mutating input', () => {
 const original = [p()]; const added = applyCount(original, '001', 6, 'add');
 assert.equal(added.product.physicalStock, 6); assert.equal(original[0].physicalStock, 0);
 assert.equal(applyCount(added.products, '001', 2, 'set').product.physicalStock, 2);
 assert.equal(applyCount(original, '001', 0, 'set').product.counted, true);
});
test('fractional counts retain six decimals', () => assert.equal(applyCount([p({ physicalStock: .1 })], '001', .2, 'add').product.physicalStock, .3));
test('count rejects blank, negative, infinite, oversized and empty additions', () => {
 for (const n of [-1, NaN, Infinity, 1e9+1, 0]) assert.throws(() => applyCount([p()], '001', n, 'add'));
 assert.throws(() => applyCount([p()], '', 1, 'add'));
 assert.throws(() => applyCount([p({physicalStock: 1e9})], '001', 1, 'add'));
});
test('unknown code can be assigned to the active zone and undone entirely', () => {
 const result = applyCount([p()], 'NEW', 12, 'add', 'Bodega');
 assert.equal(result.product.department, 'Bodega'); assert.equal(result.product.isUnregistered, true);
 assert.deepEqual(revertCount(result.products, result.undo), [p()]);
});
test('undo restores uncounted state and rejects intervening changes', () => {
 const original = [p()]; const r = applyCount(original, '001', 4, 'add');
 assert.deepEqual(revertCount(r.products, r.undo), original);
 assert.throws(() => revertCount([{...r.product, physicalStock: 7}], r.undo));
});
test('cooldown covers intervening codes and allows exact 1800ms boundary', () => {
 const gate = new ScanCooldown(); assert.equal(gate.accept('A', 0), true);
 assert.equal(gate.accept('A', 100), false); assert.equal(gate.accept('B', 200), true);
 assert.equal(gate.accept('A', 1799), false); assert.equal(gate.accept('A', 1800), true);
});
test('department summary counts pending, missing, surplus and unknown separately', () => {
 const rows = departmentStats([p(), p({code:'2', counted:true}), p({code:'3', physicalStock:12, counted:true}), p({code:'4', department:'Bodega', isUnregistered:true, counted:true})]);
 const dairy = rows.find(r=>r.department==='Lácteos'); assert.equal(dairy.stats.auditedCount,2); assert.equal(dairy.stats.missingCount,1); assert.equal(dairy.stats.surplusCount,1);
 assert.equal(rows.find(r=>r.department==='Bodega').stats.unregisteredCount,1);
});
test('administrator guard denies auditor and PIN keeps leading zeroes', () => {
 assert.throws(() => requireAdmin('auditor')); assert.doesNotThrow(() => requireAdmin('admin'));
 for (const pin of ['1234','0001']) assert.equal(validatePin(pin),true);
 for (const pin of ['123', '12345','abcd',1234,'12 4']) assert.equal(validatePin(pin),false);
});
