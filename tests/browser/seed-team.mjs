// Solo emuladores demo-auditor. Nunca usa credenciales ni datos de producción.
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, terminate } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { createCompany, createCloudAudit } from '../../src/services/cloud/repository.ts';
const projectId='demo-auditor';
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
const app=initializeApp({projectId,apiKey:'demo-key'});
const auth=getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const db=initializeFirestore(app,{}); connectFirestoreEmulator(db,'127.0.0.1',8080);
const account=await createUserWithEmailAndPassword(auth,'browser_admin@auth.grid.mx','browser-test-only');
const user={uid:account.user.uid,name:'browser_admin',role:'admin'};
await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'members',user.uid),{name:user.name,role:'admin',active:true});
  await setDoc(doc(c.firestore(),'members','fixture-auditor'),{name:'Auditora de prueba',role:'auditor',active:true,allAccess:false,companyIds:[],auditIds:[]});
});
const companyId=await createCompany(db,user,{name:'Tienda de prueba local'});
const auditId=await createCloudAudit(db,user,{companyId,period:'2026-11',products:[{code:'001',description:'Leche entera',department:'Lácteos',price:20,cost:10,theoreticalStock:5,physicalStock:0,counted:false}]});
console.log('Auditoría ficticia lista:',auditId);
await terminate(db); await deleteApp(app); await env.cleanup();
