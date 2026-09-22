const KEY = 'auditor_eleventa_products_v1';
const results = [];
const stage = document.querySelector('#stage');
let frame;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function wait(predicate, message='Tiempo de espera excedido') { const end=Date.now()+15000; while(Date.now()<end) { const value=predicate(); if(value) return value; await sleep(40); } throw new Error(message); }
const doc = () => frame.contentDocument;
const win = () => frame.contentWindow;
const buttons = () => [...doc().querySelectorAll('button')];
async function click(text) { const button = await wait(() => buttons().find(b => b.textContent.trim()===text || b.getAttribute('aria-label')===text), 'No se encontró botón: '+text); button.click(); await sleep(100); }
function value(input, text) { Object.getOwnPropertyDescriptor(win().HTMLInputElement.prototype,'value').set.call(input,text); input.dispatchEvent(new (win().Event)('input',{bubbles:true})); input.dispatchEvent(new (win().Event)('change',{bubbles:true})); }
async function open(width=1440, data=[]) {
  frame?.remove(); localStorage.setItem(KEY, typeof data==='string'?data:JSON.stringify(data));
  frame=document.createElement('iframe'); frame.width=width; frame.height=900; frame.title='Aplicación en prueba'; frame.src='/'; stage.append(frame);
  await wait(()=>doc()?.querySelector('.app-main'),'La aplicación no abrió'); win().confirm=()=>true;
}
const seed = () => Array.from({length:60},(_,i)=>({code:String(i+1).padStart(6,'0'),description:i===0?'Producto de prueba con una descripción larga para revisar ajuste de texto':'Producto '+(i+1),cost:10,price:15,department:i%2?'Bebidas':'Abarrotes',theoreticalStock:5,physicalStock:0}));
async function check(name, action) { try { await action(); results.push({name,pass:true}); } catch(error) { results.push({name,pass:false,error:error.message}); } const li=document.createElement('li'); const r=results.at(-1); li.className=r.pass?'ok':'fail'; li.textContent=(r.pass?'✓ ':'✕ ')+name+(r.error?' — '+r.error:''); document.querySelector('#results').append(li); }
function assert(condition, message) { if(!condition) throw new Error(message); }
async function inject(src) { const script=doc().createElement('script'); script.src=src; const done=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject}); doc().head.append(script); await done; }
async function upload(name) { await wait(()=>doc().querySelector('input[type=file]')); const bytes=await fetch('/__fixture/'+name).then(r=>r.arrayBuffer()); const transfer=new (win().DataTransfer)(); transfer.items.add(new (win().File)([bytes], name+'.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); const input=doc().querySelector('input[type=file]'); input.files=transfer.files; input.dispatchEvent(new (win().Event)('change',{bubbles:true})); }
async function scan(code) { const input=doc().querySelector('input[name=barcode]'); value(input,code); input.form.requestSubmit(); await sleep(120); }
document.querySelector('#run').onclick=async()=>{
  document.querySelector('#run').disabled=true; document.querySelector('#status').textContent='Pruebas en curso…';
  await check('Inicio limpio y carga de catálogo mediante Web Worker',async()=>{ await open(); await upload('valid'); await wait(()=>doc().querySelectorAll('.inventory-row').length===2); assert(JSON.parse(localStorage.getItem(KEY))[0].code==='001234','Código modificado'); });
  await check('Importación duplicada muestra error sin reemplazar inventario',async()=>{ await click('Cargar archivo'); await wait(()=>doc().querySelector('input[type=file]')); await upload('duplicate'); await wait(()=>doc().querySelector('[role=alert]')); assert(JSON.parse(localStorage.getItem(KEY)).length===2,'Se perdió el catálogo'); });
  await check('Conteo manual por unidad y cambio a caja',async()=>{ await click('Contar'); await wait(()=>doc().querySelector('input[name=barcode]')); await scan('001234'); await click('Modo Caja (+N)'); await click('+12'); await scan('001234'); assert(JSON.parse(localStorage.getItem(KEY))[0].physicalStock===13,'El modo caja no se aplicó'); });
  await check('Conteo desconocido se mantiene separado',async()=>{ await click('Modo Unidad (+1)'); await scan('999999'); assert(JSON.parse(localStorage.getItem(KEY))[0].isUnregistered===true,'Falta indicador'); });
  await check('Confirmar cero y editar decimal sin guardado por desenfoque',async()=>{ await click('Inventario'); const data=JSON.parse(localStorage.getItem(KEY)); const p=data.find(x=>x.code==='001234'); await click(`Editar conteo de ${p.description}: 13`); const input=doc().querySelector('input[name=quantity]'); value(input,'0'); input.form.requestSubmit(); await wait(()=>JSON.parse(localStorage.getItem(KEY)).find(x=>x.code==='001234').physicalStock===0); assert(JSON.parse(localStorage.getItem(KEY)).find(x=>x.code==='001234').counted,'Cero no confirmado'); });
  await check('Persistencia tras recargar la aplicación',async()=>{ frame.contentWindow.location.reload(); await wait(()=>doc().querySelector('.inventory-row')); assert(doc().body.textContent.includes('Faltante'),'No restauró el faltante'); });
  await check('Paginación limita el DOM a 50 productos',async()=>{ await open(1440,seed()); assert(doc().querySelectorAll('.inventory-row').length===50,'Página sin límite'); await click('Siguiente'); assert(doc().querySelectorAll('.inventory-row').length===10,'Paginación incorrecta'); });
  for(const width of [320,390,768,1024,1440]) await check(`Sin desbordamiento horizontal a ${width}px`,async()=>{
    await open(width,seed().slice(0,4));
    for(const tab of ['Inventario','Contar','Resumen','Cargar archivo']) { await click(tab); await wait(()=>!doc().body.textContent.includes('Cargando herramienta…')); if(tab==='Contar') { await wait(()=>doc().querySelector('input[name=barcode]')); await click('Modo Caja (+N)'); }
      assert(doc().documentElement.scrollWidth<=width+1,`${tab}: ancho ${doc().documentElement.scrollWidth}`);
    }
    await click('Exportar'); await wait(()=>doc().querySelector('dialog[open]')); assert(doc().documentElement.scrollWidth<=width+1,'Modal desbordado'); await click('Cerrar exportación');
  });
  await check('Escritorio usa columnas y móvil tarjetas',async()=>{ await open(1440,seed().slice(0,3)); assert(win().getComputedStyle(doc().querySelector('.inventory-columns')).display==='grid','Faltan columnas'); frame.width=390; await sleep(150); assert(win().getComputedStyle(doc().querySelector('.inventory-columns')).display==='none','Columnas visibles en móvil'); });
  await check('Objetivos táctiles de al menos 48×48px',async()=>{ const small=buttons().filter(b=>{const r=b.getBoundingClientRect();return r.width>0 && r.height>0 && (r.width<47.5||r.height<47.5)}); assert(!small.length,small.map(b=>b.textContent.trim()).join(', ')); });
  await check('Auditoría automática de accesibilidad WCAG A/AA en vistas principales',async()=>{
    await inject('/__axe.js');
    for(const tab of ['Inventario','Contar','Resumen','Cargar archivo']) { await click(tab); await wait(()=>!doc().body.textContent.includes('Cargando herramienta…')); const report=await win().axe.run(doc(),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}); const violations=report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})); assert(!violations.length,tab+': '+JSON.stringify(violations)); }
  });
  await check('Diálogo modal y reporte imprimible tienen datos',async()=>{ await click('Exportar'); await wait(()=>doc().querySelector('dialog[open]')); assert(doc().querySelectorAll('.print-report tbody tr').length===3,'Reporte incompleto'); assert(doc().querySelector('dialog').contains(doc().activeElement),'Foco fuera del modal'); await click('Cerrar exportación'); });
  await check('Datos dañados no bloquean la aplicación ni se sobrescriben',async()=>{ await open(390,'{"broken":true}'); assert(doc().querySelector('[role=alert]'),'No avisó'); assert(localStorage.getItem(KEY)==='{"broken":true}','Sobrescribió datos dañados'); });
  await check('Cambios de otra pestaña se reflejan sin sobrescribirlos',async()=>{ await open(390,seed().slice(0,1)); const next=seed().slice(0,1); next[0].physicalStock=4; next[0].counted=true; localStorage.setItem(KEY,JSON.stringify(next)); await wait(()=>doc().querySelector('.quantity-value')?.textContent==='4'); });
  await check('Restaurar respaldo JSON conserva un cero confirmado',async()=>{
    await open(390,[]); await wait(()=>doc().querySelector('input[type=file]'));
    const restored=seed().slice(0,1).map(p=>({...p,physicalStock:0,counted:true}));
    const transfer=new (win().DataTransfer)(); transfer.items.add(new (win().File)([JSON.stringify(restored)],'respaldo.json',{type:'application/json'}));
    const input=doc().querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new (win().Event)('change',{bubbles:true}));
    await wait(()=>doc().querySelector('.status-missing'));assert(JSON.parse(localStorage.getItem(KEY))[0].counted,'Perdió el cero confirmado');
  });
  await check('Cámara denegada muestra alternativa manual',async()=>{
    await click('Contar');await wait(()=>doc().querySelector('input[name=barcode]'));
    const media=win().navigator.mediaDevices; const original=media.getUserMedia;
    media.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')};
    try { await click('Activar cámara');await wait(()=>doc().querySelector('[role=alert]'));await scan('000001');assert(JSON.parse(localStorage.getItem(KEY))[0].physicalStock===1,'Falló alternativa manual'); }
    finally {media.getUserMedia=original;}
  });
  await check('Accesibilidad de escritorio y del diálogo de exportación',async()=>{
    await open(1440,seed().slice(0,3));await inject('/__axe.js');
    for(const tab of ['Inventario','Contar','Resumen']) {await click(tab);await wait(()=>!doc().body.textContent.includes('Cargando herramienta…'));const report=await win().axe.run(doc(),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});assert(!report.violations.length,tab+': '+report.violations.map(v=>v.id));}
    await click('Exportar');await wait(()=>doc().querySelector('dialog[open]'));const report=await win().axe.run(doc(),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});assert(!report.violations.length,report.violations.map(v=>v.id).join(','));await click('Cerrar exportación');
  });
  await check('Almacenamiento lleno conserva conteo en memoria y muestra aviso',async()=>{
    await open(390,seed().slice(0,1));const prototype=win().Storage.prototype;const original=prototype.setItem;
    prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')};
    try {await click('Sumar una unidad de '+seed()[0].description);await wait(()=>doc().querySelector('[role=alert]'));assert(doc().querySelector('.quantity-value').textContent==='1','Perdió conteo en memoria');assert(JSON.parse(localStorage.getItem(KEY))[0].physicalStock===0,'La prueba no simuló cuota');}
    finally {prototype.setItem=original;}
    await click('Sumar una unidad de '+seed()[0].description);await wait(()=>!doc().querySelector('[role=alert]'));assert(JSON.parse(localStorage.getItem(KEY))[0].physicalStock===2,'No recuperó guardado');
  });
  await check('Caché PWA contiene interfaz, módulos diferidos y worker de importación',async()=>{ await win().navigator.serviceWorker.ready; await wait(()=>win().navigator.serviceWorker.controller); const names=await win().caches.keys(); const cache=await win().caches.open(names.find(n=>n.startsWith('auditor-shell-'))); const urls=(await cache.keys()).map(r=>r.url); assert(urls.some(u=>u.includes('importWorker')),'Worker no almacenado'); assert(urls.some(u=>u.includes('BarcodeScanner')),'Escáner no almacenado'); assert(urls.some(u=>u.endsWith('/index.html')),'Falta interfaz'); });
  await check('QR terminal decodifica ambas direcciones con lector independiente',async()=>{
    await inject('/__qr-reader.js'); const fixtures=await fetch('/__qr.json').then(r=>r.json());
    const reader=doc().createElement('div');reader.id='qr-test-reader';doc().body.append(reader);
    for(const {url,terminal} of fixtures) { const rows=terminal.split('\n'); const canvas=doc().createElement('canvas');canvas.width=canvas.height=330; const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,330,330);
      rows.forEach((row,y)=>{const cells=[...row.matchAll(/\x1b\[(40|107)m  /g)];cells.forEach((cell,x)=>{if(cell[1]==='40'){ctx.fillStyle='black';ctx.fillRect(x*10,y*10,10,10)}})});
      const blob=await new Promise(resolve=>canvas.toBlob(resolve)); const scanner=new (win().Html5Qrcode)('qr-test-reader'); const decoded=await scanner.scanFile(new (win().File)([blob],'qr.png',{type:'image/png'}),false); scanner.clear(); assert(decoded===url,'QR incorrecto: '+decoded);
    } reader.remove();
  });
  await check('Servidor no entrega código fuente ni rutas fuera de dist',async()=>{ for(const path of ['/src/App.tsx','/package.json','/%2e%2e%5cpackage.json']) assert((await fetch(path)).status===404,'Ruta expuesta: '+path); assert((await fetch('/index.html',{method:'POST'})).status===405,'POST permitido'); });
  await open(1440,seed().slice(0,8).map((p,i)=>({...p,physicalStock:i%3===0?3:i%3===1?5:8,counted:true})));
  const passed=results.filter(r=>r.pass).length; document.querySelector('#status').textContent=`Terminado: ${passed}/${results.length} pruebas aprobadas`;
  await fetch('/__results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({at:new Date().toISOString(),userAgent:navigator.userAgent,results},null,2)});
};
