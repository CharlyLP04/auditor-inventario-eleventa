import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleProducts } from '../src/services/cloud/model.ts';
import { searchProducts } from '../src/services/productSearch.ts';

test('conteos: conserva productos sin cambios y actualiza búsquedas y cantidades', () => {
  const catalog = [[{code:'001',description:'Leche',department:'Lácteos',cost:10,price:20,theoreticalStock:5,physicalStock:0,counted:false},
    {code:'002',description:'Arroz',department:'Abarrotes',cost:5,price:10,theoreticalStock:8,physicalStock:0,counted:false}]];
  const cache = new WeakMap();
  const first = assembleProducts(catalog, [], [], cache);
  assert.equal(searchProducts(first, 'Leche')[0].product.physicalStock, 0);
  const buckets = [{q:{'001':3},n:{'001':1},u:{'001':{a:1}}}];
  const second = assembleProducts(catalog, buckets, [], cache);
  assert.notEqual(second[0], first[0]);
  assert.equal(second[1], first[1]);
  assert.equal(searchProducts(second, 'Leche')[0].product.physicalStock, 3);
  assert.deepEqual(second, assembleProducts(catalog, buckets, []));
  const zero = assembleProducts(catalog, [{q:{'001':0},n:{'001':1},u:{}}], [], cache);
  assert.equal(zero[0].counted, true);
  const reset = assembleProducts(catalog, [], [], cache);
  assert.equal(reset[0].counted, false);
  const renamed = [[{...catalog[0][0],description:'Leche deslactosada'}]];
  assert.equal(assembleProducts(renamed, [], [], cache)[0].description, 'Leche deslactosada');
});
