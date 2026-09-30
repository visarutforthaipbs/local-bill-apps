import { env, SELF, runInDurableObject } from 'cloudflare:test';
import { it, expect } from 'vitest';
import type { Workspace } from '../src/index';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
const change=(key='document:a',base=0,more={})=>({key,base,hash:'a'.repeat(64),file:'driveFile',...more});
const fresh=()=>{
 const stub=env.WORKSPACES.getByName(crypto.randomUUID());
 const invoke=async(action:string,input:unknown)=>{const result=await stub.request(action,input);if(result.status!==200)throw new Error((result.data as {error:string}).error);return result.data as any;};
 return {stub,status:()=>invoke('status',null),pull:(n:number)=>invoke('pull',n),initialize:(v:unknown)=>invoke('initialize',v),commit:(v:unknown)=>invoke('commit',v),reserve:(v:unknown)=>invoke('reserve',v)};
};
async function ready(){const stub=fresh();await stub.initialize({root:'rootFolder',commit:{operation:'init',changes:[change('business:main')]}});return stub;}
it('denies unconfigured public access',async()=>{const r=await SELF.fetch('https://example.com/v3/status');expect(r.status).toBe(503);});
it('isolates workspace accounts',async()=>{const a=await ready(),b=fresh();expect((await a.status()).root).toBe('rootFolder');expect((await b.status()).root).toBeNull();});
it('serializes competing bootstrap and permits exact retry',async()=>{
 const s=fresh();const input={root:'rootA',commit:{operation:'a',changes:[change()]}};
 const results=await Promise.allSettled([s.initialize(input),s.initialize({...input,root:'rootB',commit:{...input.commit,operation:'b'}})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await s.initialize(input)).toEqual((results[0] as PromiseFulfilledResult<unknown>).value);expect((await s.pull(0)).transactions).toHaveLength(1);
});
it('same base concurrent changes admit exactly one writer',async()=>{
 const s=await ready();const results=await Promise.all(['one','two'].map(operation=>s.commit({operation,changes:[change()]})));
 expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.filter(r=>!r.ok)).toHaveLength(1);
 expect((await s.pull(1)).transactions).toHaveLength(1);
});
it('unknown commit result can be retried after object reconstruction without duplicate income',async()=>{
 const s=await ready();const c={operation:'payment1',changes:[change('reviewEvent:p1',0,{claims:['payment:invoice1']})]};
 const result=await s.commit(c);
 await runInDurableObject(s.stub,async(_instance:Workspace,state)=>{expect(state.storage.sql.exec('SELECT * FROM operations WHERE id=?','payment1').toArray()).toHaveLength(1);});
 expect(await s.commit(c)).toEqual(result);expect((await s.pull(1)).transactions).toHaveLength(1);
 await expect(s.commit({...c,changes:[change('reviewEvent:p2',0,{claims:['payment:invoice1']})]})).rejects.toThrow('OPERATION_REUSED');
 await expect(s.commit({operation:'other',changes:[change('reviewEvent:p2',0,{claims:['payment:invoice1']})]})).rejects.toThrow('FACT_ALREADY_RECORDED');
});
it('all-or-nothing batch rejects stale dependency without writing receipt',async()=>{
 const s=await ready();await s.commit({operation:'first',changes:[change()]});
 const result=await s.commit({operation:'batch',changes:[change(),change('reviewEvent:receipt')]});
 expect(result.ok).toBe(false);expect((await s.pull(1)).transactions).toHaveLength(1);
});
it('rejects duplicate claims within batch and rolls back every change',async()=>{
 const s=await ready();await expect(s.commit({operation:'dup',changes:[change('reviewEvent:a',0,{claims:['payment:x']}),change('reviewEvent:b',0,{claims:['payment:x']})]})).rejects.toThrow('FACT_ALREADY_RECORDED');
 expect((await s.pull(1)).transactions).toHaveLength(0);
 expect((await s.commit({operation:'retry',changes:[change('reviewEvent:a',0,{claims:['payment:x']})]})).ok).toBe(true);
});
it('allocates unique numbers concurrently, skips imports, retries same reservation',async()=>{
 const s=fresh();await s.initialize({root:'root',commit:{operation:'init',changes:[change('document:old',0,{number:'RC-69-001',sealedHash:'b'.repeat(64)})]}});
 const req=(i:number)=>({operation:'reserve'+i,key:'document:d'+i,prefix:'RC-69-',suffix:'',width:3});
 const numbers=await Promise.all(Array.from({length:20},(_,i)=>s.reserve(req(i))));
 expect(new Set(numbers.map(r=>r.number)).size).toBe(20);expect(numbers[0].number).toBe('RC-69-002');expect(await s.reserve(req(0))).toEqual(numbers[0]);
 await expect(s.reserve({...req(0),key:'document:other'})).rejects.toThrow('OPERATION_REUSED');
});
it('freezes issued facts, binds reserved number to record, permits lifecycle metadata',async()=>{
 const s=await ready();const reservation=await s.reserve({operation:'reserve',key:'document:a',prefix:'RC-69-',suffix:'',width:3});
 const c=change('document:a',0,{...reservation,sealedHash:'b'.repeat(64)});
 await expect(s.commit({operation:'wrong',changes:[{...c,key:'document:b'}]})).rejects.toThrow('NUMBER_NOT_RESERVED');
 expect((await s.commit({operation:'issue',changes:[c]})).ok).toBe(true);
 await expect(s.commit({operation:'edit',changes:[{...c,base:1,sealedHash:'c'.repeat(64)}]})).rejects.toThrow('ISSUED_FACTS_IMMUTABLE');
 expect((await s.commit({operation:'void',changes:[{...c,base:1,hash:'d'.repeat(64)}]})).ok).toBe(true);
 await expect(s.reserve({operation:'again',key:'document:a',prefix:'RC-69-',suffix:'',width:3})).rejects.toThrow('ALREADY_ISSUED');
});
it('review events are immutable, cursors cannot skip nonexistent history',async()=>{
 const s=await ready();await s.commit({operation:'review',changes:[change('reviewEvent:old')]});
 await expect(s.commit({operation:'rewrite',changes:[change('reviewEvent:old',1,{hash:'c'.repeat(64)})]})).rejects.toThrow('REVIEW_EVENT_IMMUTABLE');
 await expect(s.pull(99)).rejects.toThrow('CURSOR_AHEAD');
 await expect(s.pull(-1)).rejects.toThrow('INVALID_CURSOR');
});
it('duplicate imported numbers roll back bootstrap, invalid keys are rejected',async()=>{
 const s=fresh();await expect(s.initialize({root:'root',commit:{operation:'dup',changes:[change('document:a',0,{number:'RC-001',sealedHash:'b'.repeat(64)}),change('document:b',0,{number:'RC-001',sealedHash:'b'.repeat(64)})]}})).rejects.toThrow('DUPLICATE_NUMBER');
 expect((await s.status()).root).toBeNull();
 await expect(s.initialize({root:'root',commit:{operation:'bad',changes:[change('__proto__:x')]}})).rejects.toThrow('INVALID_KEY');
});
it('preserves consumed counter gaps and sequence across format changes',async()=>{
 const s=fresh();await s.initialize({root:'root',counterFloors:{'receipt-2026':14},commit:{operation:'init',changes:[change('business:main')]}});
 const a=await s.reserve({operation:'reserveA',key:'document:a',prefix:'RC-69-',suffix:'',width:3,series:'receipt-2026'});expect(a.number).toBe('RC-69-015');
 const b=await s.reserve({operation:'reserveB',key:'document:b',prefix:'RECEIPT-26-',suffix:'',width:3,series:'receipt-2026'});expect(b.number).toBe('RECEIPT-26-016');
});
