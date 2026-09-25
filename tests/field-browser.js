const results = [];
let frame;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const doc = () => frame.contentDocument, win = () => frame.contentWindow;
async function wait(predicate, message = 'Tiempo excedido') { const end = Date.now() + 10000; while (Date.now() < end) { const result = await predicate(); if (result) return result; await sleep(40); } throw new Error(message); }
const assert = (value, message) => { if (!value) throw new Error(message); };
const buttons = () => [...doc().querySelectorAll('button')];
const button = text => buttons().find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text);
async function click(text) { const b = await wait(() => button(text), 'No existe: ' + text); assert(!b.disabled, 'Deshabilitado: ' + text); b.click(); await sleep(90); }
function fill(el, text) { const proto = el.tagName === 'TEXTAREA' ? win().HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? win().HTMLSelectElement.prototype : win().HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text); el.dispatchEvent(new (win().Event)(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }
async function submit(form) { form.requestSubmit(); await sleep(150); }
async function read() { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('AuditorEleventaDB'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); return new Promise((resolve, reject) => { const tx = db.transaction(['audits','app_settings']); const audits = tx.objectStore('audits').getAll(), settings = tx.objectStore('app_settings').get('workspace'); tx.oncomplete = () => { db.close(); resolve({ audits:audits.result, settings:settings.result }); }; tx.onabort = () => { db.close(); reject(tx.error); }; }); }
async function stock(code) { return (await read()).audits[0]?.products.find(p => p.code === code)?.physicalStock; }
async function scan(code) { const input = await wait(()=>doc().querySelector('[name=barcode]')); fill(input, code); await submit(input.form); }
async function check(name, action) { try { await action(); results.push({ name, pass:true }); } catch (e) { results.push({ name, pass:false, error:e.message }); throw e; } finally { const li=document.createElement('li'), r=results.at(-1); li.className=r.pass?'ok':'fail'; li.textContent=(r.pass?'✓ ':'✕ ')+name+(r.error?' · '+r.error:''); document.querySelector('#results').append(li); } }
async function unlock(pin='1234') { await click('Auditor · Acceso admin'); fill(await wait(()=>doc().querySelector('dialog[open] input')),pin); await submit(doc().querySelector('dialog[open] form')); }
const seed = [{ code:'FIELD001',description:'Leche de prueba de campo',department:'Lácteos',cost:10,price:15,theoreticalStock:10,physicalStock:0,counted:false },{code:'FIELD002',description:'Arroz de prueba',department:'Abarrotes',cost:0,price:20,theoreticalStock:8,physicalStock:0,counted:false}];
document.querySelector('#run').onclick = async () => {
  document.querySelector('#run').disabled = true;
  document.querySelector('#status').textContent='En ejecución…';
  try {
    frame?.remove();
    await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('AuditorEleventaDB'); r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Cierra otras pestañas de pruebas en 5191'));});
    localStorage.setItem('auditor_eleventa_products_v1',JSON.stringify(seed));
    frame=document.createElement('iframe'); frame.width=1440;frame.height=950;frame.title='Aplicación aislada';frame.src='/';document.querySelector('#stage').append(frame);
    await wait(()=>doc()?.querySelector('.company-manager'));win().confirm=()=>true;
    await check('Inicio en Auditor con operaciones administrativas bloqueadas',async()=>{
      assert(button('Auditor · Acceso admin'),'Rol inseguro');assert(!button('eleventa'),'Importación visible');assert(!button('Reiniciar conteo físico'),'Reset visible');assert(button('Agregar empresa').disabled,'Creación habilitada');
      assert([...doc().querySelectorAll('.identity-form input')].every(e=>e.matches(':disabled')),'Membrete editable');
    });
    await check('Guardas internas rechazan llamadas administrativas desde Auditor',async()=>{
      const node=doc().querySelector('.company-manager'), key=Object.keys(node).find(k=>k.startsWith('__reactFiber$'));
      let fiber=node[key]; while(fiber && !fiber.memoizedProps?.store) fiber=fiber.return;
      assert(fiber,'No se encontró el store del componente'); const store=fiber.memoizedProps.store;
      const before=JSON.stringify(await read());
      assert(await store.saveCompany({id:'injected',name:'No permitido',createdAt:new Date().toISOString()})===false,'Guardia empresa ausente');
      assert(await store.commit([],true)===false,'Guardia importación ausente');
      assert(await store.updateProduct('FIELD001',{cost:999})===false,'Guardia costo ausente');
      assert(JSON.stringify(await read())===before,'Se modificó IndexedDB');
    });
    await check('Unidad guarda en IndexedDB; voz apagada por defecto',async()=>{ await click('Contar'); await wait(()=>doc().querySelector('[name=barcode]')); assert(button('Voz').getAttribute('aria-pressed')==='false','Voz activa'); await scan('FIELD001'); await wait(async()=>await stock('FIELD001')===1); });
    await check('Mismo código no se cuenta durante 1.8 segundos',async()=>{await scan('FIELD001');assert(await stock('FIELD001')===1,'Doble conteo');await sleep(1850);await scan('FIELD001');await wait(async()=>await stock('FIELD001')===2);await sleep(700);});
    await check('Modo caja y deshacer restauran el conteo anterior',async()=>{await click('Modo Caja (+N)');await click('+12');await sleep(1850);await scan('FIELD001');await wait(async()=>await stock('FIELD001')===14);await sleep(700);await click('Deshacer último conteo');await wait(async()=>await stock('FIELD001')===2);});
    await check('Preguntar cantidad permite cancelar sin contar',async()=>{await click('Preguntar cantidad');await scan('FIELD002');await wait(()=>doc().querySelector('.quantity-dialog[open]'));await click('Cancelar cantidad');assert(await stock('FIELD002')===0,'Cancelación contó');await sleep(1850);});
    await check('Teclado suma empaques y confirma con Enter/formulario',async()=>{await scan('FIELD002');await click('+12');await click('+6');assert(doc().querySelector('[aria-label="Cantidad encontrada"]').value==='18','Atajos incorrectos');await submit(doc().querySelector('.quantity-dialog form'));await wait(async()=>await stock('FIELD002')===18);await wait(()=>!doc().querySelector('.quantity-dialog'));});
    await check('Corrección inmediata fija cero como conteo real',async()=>{await click('Corregir cantidad del último producto');fill(doc().querySelector('[aria-label="Cantidad encontrada"]'),'0');await click('Guardar conteo');await wait(async()=>await stock('FIELD002')===0);const record=(await read()).audits[0].products.find(p=>p.code==='FIELD002');assert(record.counted,'Cero pendiente');});
    await check('Corrección suma fracciones sin borrar el total',async()=>{await click('Corregir cantidad del último producto');await click('Sumar al conteo');fill(doc().querySelector('[aria-label="Cantidad encontrada"]'),'2.5');await click('Guardar conteo');await wait(async()=>await stock('FIELD002')===2.5);});
    await check('Alta visibilidad utiliza título 28px, código 18px y cifra 56px',async()=>{await click('Letra grande');await wait(()=>doc().querySelector('.scanner-large'));assert(win().getComputedStyle(doc().querySelector('.last-scan-card h3')).fontSize==='28px','Título pequeño');assert(win().getComputedStyle(doc().querySelector('.last-scan-card code')).fontSize==='18px','Código pequeño');await wait(()=>win().getComputedStyle(doc().querySelector('.last-scan-number')).fontSize==='56px','Cifra pequeña');});
    await check('Zona activa avisa de otra categoría y clasifica códigos nuevos',async()=>{fill(doc().querySelector('.scanner-tools select'),'Lácteos');await sleep(1850);await scan('FIELD002');await wait(()=>doc().querySelector('.quantity-dialog'));assert(doc().body.textContent.includes('pertenece a Abarrotes'),'Sin aviso de zona');await click('Cancelar cantidad');await scan('NEW001');fill(doc().querySelector('[aria-label="Cantidad encontrada"]'),'3');await click('Guardar conteo');await wait(async()=>await stock('NEW001')===3);assert((await read()).audits[0].products.find(p=>p.code==='NEW001').department==='Lácteos','Zona desconocida incorrecta');});
    await check('Auditor edita departamento pero no ve campos de precios',async()=>{await click('Auditoría');await click('Cambiar departamento');await wait(()=>doc().querySelector('#product-editor-title'));assert(!doc().querySelector('input[name=cost]'),'Costo editable');fill(doc().querySelector('input[name=department]'),'Bodega');await click('Guardar producto');await wait(()=>!doc().querySelector('#product-editor-title'));assert((await read()).audits[0].products.find(p=>p.code==='NEW001').department==='Bodega','Departamento no guardado');});
    await check('Notas de campo se guardan con rol Auditor',async()=>{await click('Notas');fill(doc().querySelector('textarea[name=notes]'),'Hallazgo sintético de prueba');await click('Guardar notas');await wait(async()=>(await read()).audits[0].notes==='Hallazgo sintético de prueba');});
    await check('PIN incorrecto no concede acceso',async()=>{await unlock('9999');assert(doc().querySelector('dialog[open]'),'Se cerró con PIN erróneo');assert(doc().body.textContent.includes('PIN incorrecto'),'Sin error de PIN');await click('Cerrar acceso');});
    await check('PIN inicial desbloquea Administrador y edición de precios',async()=>{await unlock();await wait(()=>button('Administrador · Bloquear'));assert(button('eleventa'),'Falta importación');assert(button('Reiniciar conteo físico'),'Falta reset');await click('Editar producto');fill(doc().querySelector('input[name=cost]'),'12.5');fill(doc().querySelector('input[name=price]'),'19');await click('Guardar producto');await wait(()=>!doc().querySelector('#product-editor-title'));assert((await read()).audits[0].products.find(p=>p.code==='NEW001').cost===12.5,'Costo no guardado');});
    await check('Resumen por departamento conserva pendientes y desconocidos',async()=>{await click('Balance');await wait(()=>doc().querySelector('.department-grid'));assert(doc().querySelectorAll('.department-grid article').length===3,'Categorías incorrectas');});
    await check('Modo Auditor vuelve al recargar y mantiene los conteos',async()=>{frame.contentWindow.location.reload();await wait(()=>button('Auditor · Acceso admin'));assert(!button('eleventa'),'Privilegio persistió');assert(await stock('FIELD001')===2,'Conteo perdido');});
    await check('Voz usa el texto del resultado confirmado y se cancela al apagar',async()=>{await click('Contar');await wait(()=>button('Voz'));const said=[];Object.defineProperty(win(),'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){said.push(u.text);}}});await click('Voz');await scan('FIELD001');await wait(()=>doc().querySelector('.quantity-dialog'));fill(doc().querySelector('[aria-label="Cantidad encontrada"]'),'15');await click('Guardar conteo');await wait(()=>said.length===1);assert(said[0].includes('15 piezas contadas'),'Voz no coincide con conteo');await click('Voz');});
    for(const width of [320,390,768,1024,1440]) await check('Sin desbordamiento horizontal en escáner y teclado a '+width+'px',async()=>{
      frame.width=width;await sleep(120);await click('Corregir cantidad del último producto');await wait(()=>doc().querySelector('.quantity-dialog[open]'));
      assert(doc().documentElement.scrollWidth<=width+1,'Desborde del documento');const modal=doc().querySelector('.quantity-dialog');assert(modal.scrollWidth<=modal.clientWidth+1,'Desborde del teclado');await click('Cancelar cantidad');
    });
    await check('Accesibilidad: escáner y diálogo sin errores críticos/serios',async()=>{
      const script=doc().createElement('script');script.src='/__axe.js';doc().head.append(script);await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;});
      const scan=await win().axe.run(doc().querySelector('.scanner-shell'));const failures=scan.violations.filter(v=>['critical','serious'].includes(v.impact));assert(!failures.length,JSON.stringify(failures.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
      await click('Corregir cantidad del último producto');const dialog=await win().axe.run(doc().querySelector('.quantity-dialog'));const problems=dialog.violations.filter(v=>['critical','serious'].includes(v.impact));assert(!problems.length,JSON.stringify(problems.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));await click('Cancelar cantidad');
    });
  } catch (e) { console.error(e); if (!results.length || results.at(-1).pass) results.push({name:'Preparación del entorno',pass:false,error:e.message}); }
  const failures=results.filter(r=>!r.pass).length;
  document.querySelector('#status').textContent=failures ? `${failures} fallo(s). Revisa los resultados.` : `${results.length} verificaciones correctas.`;
  await fetch('/__results',{method:'POST',body:JSON.stringify({status:failures?'failed':'passed',results})});
};
