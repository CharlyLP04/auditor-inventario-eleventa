import { LoadingSkeleton } from '../../src/components/LoadingSkeleton';
import { useState } from 'react';

import { LayoutGrid, ScanBarcode, ClipboardList, ChartColumn } from 'lucide-react';
import { InventoryTable } from '../../src/components/InventoryTable';
import { InterfaceScale } from '../../src/components/InterfaceScale';
import '../../src/index.css';
import '../../src/workspace.css';
import type { Product } from '../../src/types';
const tabs = [{title:'Deptos.', Icon:LayoutGrid}, {title:'Contar', Icon:ScanBarcode}, {title:'Auditoría', Icon:ClipboardList}, {title:'Balance', Icon:ChartColumn}];
const seed: Product[] = ['Big Mix Queso 185G','Big Mix Queso 80G','Cacahuate Hot Nuts Adobado Suelto','Cacahuate Hot Nut Enigma','Chicharrón Natural Barcel 90G','Producto con descripción muy larga para comprobar lectura y ajuste en pantallas pequeñas'].map((description,i)=>({code:'750081831'+i,description,department:'Barcel',theoreticalStock:i,physicalStock:0,counted:false,cost:0,price:20+i*4,minStock:4}));
seed.push({...seed[0],code:'SKU'+ '1234567890'.repeat(6),description:'ProductoSinEspacios'.repeat(7),price:99999999.99});
export function Review(){
 const [products,setProducts]=useState(seed);
 const [loading,setLoading]=useState(false);
 return <div className="app-shell cloud-shell"><header className="app-header"><div className="brand"><div><h1>Auditorías Grid.mx</h1><p>Prueba local · sin Firebase</p></div></div><InterfaceScale username="mobile-review" /></header><main className="app-main"><div className="cloud-audit">
 <nav className="app-nav cloud-nav" aria-label="Secciones de la auditoría">{tabs.map(({title,Icon})=><button key={String(title)} aria-current={title==='Auditoría'?'page':undefined}><Icon size={22}/><span>{String(title)}</span></button>)}</nav>
 <button className="secondary" onClick={()=>setLoading(v=>!v)}>{loading?'Mostrar inventario':'Previsualizar carga'}</button>
 {loading ? <LoadingSkeleton label="Cargando catálogo y conteos completos…" /> : <InventoryTable products={products} viewKey="mobile-review" onUpdateQuantity={async(code,quantity)=>{setProducts(items=>items.map(p=>p.code===code?{...p,physicalStock:quantity,counted:true}:p));return true;}} />}
 </div></main></div>;
}

