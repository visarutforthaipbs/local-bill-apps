import {env} from 'cloudflare:test';import {it,expect} from 'vitest';
import S from '../../../lib/sync-v3.cjs';import B from '../../../lib/sync-v3-billing.cjs';import C from '../../../lib/sync-v3-controller.cjs';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
const clone=(v:unknown)=>JSON.parse(JSON.stringify(v));
it('two billing replicas cannot record competing payment facts on the same invoice',async()=>{
 const stub=env.WORKSPACES.getByName(crypto.randomUUID());
 const rpc=async(action:string,value:unknown)=>{const r=await stub.request(action,value);if(r.status!==200)throw Error((r.data as {error:string}).error);return r.data as any;};
 const invoice={id:'inv',type:'invoice',status:'sent',number:'INV-69-001',items:[{description:'Synthetic',qty:1,price:100}],currency:'THB',issueDate:'2026-09-29'};
 const db={business:{businessName:'Synthetic'},documents:[invoice],clients:[],reviewEvents:[],recurring:[],counters:{},meta:{}};
 const records=B.flatten(db),files:Record<string,unknown>={};
 const changes=Object.entries(records).map(([key,record],i)=>{const file='f'+i;files[file]=record;return {key,base:0,hash:S.digest(record),file,...B.seal(key,record)};});
 const result=await rpc('initialize',{root:'syntheticRoot',commit:{operation:'init',changes}});
 const initial={...S.initial('synthetic'),records,root:'syntheticRoot',mode:'active',cursor:1,heads:Object.fromEntries(result.changes.map((c:any)=>[c.key,{revision:c.revision,hash:c.hash}]))};
 const transport={reserve:(r:unknown)=>rpc('reserve',r),commit:(r:unknown)=>rpc('commit',r),pull:(n:number)=>rpc('pull',n),upload:async(record:unknown)=>{const id='f'+Object.keys(files).length;files[id]=record;return id;},download:async(id:string)=>files[id]};
 const replica=()=>{let stored=clone({...db,syncV3:initial});return {read:()=>clone(stored),controller:new C.BillingSyncController({account:'synthetic',read:async()=>clone(stored),write:async(next:unknown)=>{stored=clone(next);},transport,validateDatabase:()=>{}})};};
 const a=replica(),b=replica();const one=a.read(),two=b.read();Object.assign(one.documents[0],{status:'paid',paymentId:'paymentA',paidDate:'2026-09-29'});Object.assign(two.documents[0],{status:'paid',paymentId:'paymentB',paidDate:'2026-09-28'});
 await a.controller.save(one);await expect(b.controller.save(two)).rejects.toThrow('SYNC_FINALIZATION_PENDING');
 expect(b.read().documents[0].status).toBe('sent');expect(Object.keys(b.read().syncV3.conflicts)).toEqual(['document:inv']);
 await b.controller.resolve('document:inv','remote');expect(b.read().documents[0].paymentId).toBe('paymentA');
 expect((await rpc('pull',1)).transactions).toHaveLength(1);
});
