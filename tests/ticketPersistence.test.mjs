import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc, writeBatch, terminate } from 'firebase/firestore';
import { persistTicket, TicketConflictError } from '../utils/ticketPersistence.ts';

const projectId = 'demo-drk-ticket-regression';
const app = initializeApp({ projectId, apiKey: 'test-only' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8787);
const ref = (coll, id) => doc(db, coll, id);
const ticket = (id, origin = 'manual') => ({id, origin, status:'Offen', title:'Testauftrag', dueDate:'16.09.2026', notes:[]});
const close = t => ({...t, status:'Abgeschlossen', completionDate:'21.09.2026', completionTime:'13:00'});
const exists = async (coll,id) => (await getDoc(ref(coll,id))).exists();
const read = async (coll,id) => (await getDoc(ref(coll,id))).data();

before(async () => {
 const response = await fetch(`http://127.0.0.1:8787/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
 assert.equal(response.ok, true, 'Local emulator reset failed');
});

for (const origin of ['manual','routine']) {
 test(`${origin}: stale overdue write cannot resurrect a completed ticket`, async () => {
   const t=ticket(`stale-${origin}`, origin), coll=origin==='routine'?'routine_tickets':'tickets';
   await persistTicket(db,t,'create');
   await persistTicket(db,close(t),'complete',t);
   await assert.rejects(persistTicket(db,{...t,status:'Überfällig'},'update',t),TicketConflictError);
   assert.equal(await exists(coll,t.id),false);
   assert.equal((await read('completed_tickets',t.id)).status,'Abgeschlossen');
 });
}
test('two clients closing simultaneously preserve a single archive',async()=>{
 const t=ticket('parallel'); await persistTicket(db,t,'create');
 const results=await Promise.allSettled([persistTicket(db,close(t),'complete',t),persistTicket(db,close(t),'complete',t)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(await exists('tickets',t.id),false);
 assert.equal((await read('completed_tickets',t.id)).status,'Abgeschlossen');
});
test('explicit reopen is atomic and clears completion fields',async()=>{
 const t=ticket('reopen'); await persistTicket(db,t,'create');
 const archived=await persistTicket(db,close(t),'complete',t);
 const reopened=await persistTicket(db,{...archived,status:'In Arbeit'},'reopen',archived);
 assert.equal(await exists('completed_tickets',t.id),false);
 assert.equal(reopened.is_reopened,true); assert.equal(reopened.lifecycleRevision,1);
 for(const k of ['closedAt','completionDate','completionTime']) assert.equal(reopened[k],undefined);
 await assert.rejects(persistTicket(db,{...t,status:'Überfällig'},'update',t),TicketConflictError);
 await persistTicket(db,{...reopened,status:'Überfällig'},'update',reopened);
});
test('creation cannot reuse archived, active, routine or deleted IDs',async()=>{
 const archived=ticket('collision-archived'); await persistTicket(db,archived,'create');
 await persistTicket(db,close(archived),'complete',archived);
 await assert.rejects(persistTicket(db,archived,'create'),TicketConflictError);
 const active=ticket('collision-active'); await persistTicket(db,active,'create');
 await assert.rejects(persistTicket(db,active,'create'),TicketConflictError);
 const routine=ticket('collision-routine','routine'); await persistTicket(db,routine,'create');
 await assert.rejects(persistTicket(db,{...routine,origin:'manual'},'create'),TicketConflictError);
 await setDoc(ref('app_data','deleted-ticket-ids'),{value:['deleted-id']});
 await assert.rejects(persistTicket(db,ticket('deleted-id'),'create'),TicketConflictError);
});
test('an automatic update cannot recreate a deleted active document',async()=>{
 const t=ticket('missing'); await persistTicket(db,t,'create'); await deleteDoc(ref('tickets',t.id));
 await assert.rejects(persistTicket(db,{...t,status:'Überfällig'},'update',t),TicketConflictError);
 assert.equal(await exists('tickets',t.id),false);
});
test('closing preserves a newer remote conversation',async()=>{
 const t=ticket('preserve-chat'); await persistTicket(db,t,'create');
 await setDoc(ref('tickets',t.id),{...t,notes:['new remote note']});
 const archived=await persistTicket(db,close(t),'complete',t);
 assert.deepEqual(archived.notes,['new remote note']);
});
test('automatic overdue update respects a newer deadline and parked status',async()=>{
 const t=ticket('changed-deadline'); await persistTicket(db,t,'create');
 await setDoc(ref('tickets',t.id),{...t,dueDate:'30.09.2026'});
 await assert.rejects(persistTicket(db,{...t,status:'Überfällig'},'update',t),TicketConflictError);
 await setDoc(ref('tickets',t.id),{...t,status:'Zurückgestellt'});
 await assert.rejects(persistTicket(db,{...t,status:'Überfällig'},'update',t),TicketConflictError);
});
test('server rules reject stale writes from OLD app versions',async()=>{
 const t=ticket('legacy'); await persistTicket(db,t,'create');
 await persistTicket(db,close(t),'complete',t);
 await assert.rejects(setDoc(ref('tickets',t.id),{...t,status:'Überfällig'}),{code:'permission-denied'});
 await assert.rejects(setDoc(ref('routine_tickets',t.id),{...t,status:'Überfällig'}),{code:'permission-denied'});
 // Legacy reopen consists of two separate writes. Neither may destroy the archive.
 await assert.rejects(setDoc(ref('tickets',t.id),{...t,status:'In Arbeit',is_reopened:true}),{code:'permission-denied'});
 await assert.rejects(deleteDoc(ref('completed_tickets',t.id)),{code:'permission-denied'});
 assert.equal((await read('completed_tickets',t.id)).status,'Abgeschlossen');
});
test('legacy completion remains compatible with protective rules',async()=>{
 const t=ticket('legacy-close'); await setDoc(ref('tickets',t.id),t);
 await setDoc(ref('completed_tickets',t.id),close(t));
 await setDoc(ref('tickets',t.id),close(t));
 await deleteDoc(ref('tickets',t.id));
 assert.equal(await exists('completed_tickets',t.id),true);
});
test('intentional deletion with the existing blocklist still works',async()=>{
 const t=ticket('delete-completed'); await persistTicket(db,t,'create');
 await persistTicket(db,close(t),'complete',t);
 const batch=writeBatch(db);
 batch.set(ref('app_data','deleted-ticket-ids'),{value:[t.id]});
 batch.delete(ref('completed_tickets',t.id)); await batch.commit();
 assert.equal(await exists('completed_tickets',t.id),false);
});
test('a rejected archive write cannot partially delete the active ticket',async()=>{
 const t=ticket('rejected-close'); await persistTicket(db,t,'create');
 const batch=writeBatch(db);
 batch.set(ref('completed_tickets',t.id),{...t,status:'Überfällig'});
 batch.delete(ref('tickets',t.id));
 await assert.rejects(batch.commit(),{code:'permission-denied'});
 assert.equal((await read('tickets',t.id)).status,'Offen');
 assert.equal(await exists('completed_tickets',t.id),false);
});
test('simultaneous creation with the same number never overwrites the winner',async()=>{
 const t=ticket('concurrent-create');
 const results=await Promise.allSettled([persistTicket(db,t,'create'),persistTicket(db,{...t,title:'Other client'},'create')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const winner=results.find(x=>x.status==='fulfilled').value;
 assert.equal((await read('tickets',t.id)).title,winner.title);
});
after(async()=>{await terminate(db);await deleteApp(app)});
