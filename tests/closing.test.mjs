import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allDevicesConfirmed } from '../src/services/cloud/closing.ts';
test('cierre exige solicitud vigente y todos los dispositivos, nunca equivale desconocido a confirmado',()=>{
  assert.equal(allDevicesConfirmed({}),false);
  assert.equal(allDevicesConfirmed({closingToken:'a',deviceOwners:{}}),false);
  assert.equal(allDevicesConfirmed({closingToken:'a',deviceOwners:{d1:'a',d2:'b'},deviceConfirmations:{d1:true}}),false);
  assert.equal(allDevicesConfirmed({closingToken:'a',deviceOwners:{d1:'a',d2:'b'},deviceConfirmations:{d1:true,d2:true}}),true);
  assert.equal(allDevicesConfirmed({closingToken:null,deviceOwners:{d1:'a'},deviceConfirmations:{d1:true}}),false);
});
