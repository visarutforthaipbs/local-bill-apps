import { env, runInDurableObject } from 'cloudflare:test';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/index';
import type { Workspace } from '../src/index';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
const hash=(n:number)=>n.toString(16).padStart(64,'0');
const change=(i:number,more={})=>({key:'document:d'+i,base:0,hash:hash(i),file:'driveFile'+i,...more});
const fresh=()=>{
 const stub=env.WORKSPACES.getByName(crypto.randomUUID());
 const invoke=async(action:string,input:unknown)=>{const result=await stub.request(action,input);if(result.status!==200)throw new Error((result.data as {error:string}).error);return result.data as any;};
 return {stub,status:()=>invoke('status',null),pull:(n:number)=>invoke('pull',n),initialize:(v:unknown)=>invoke('initialize',v),commit:(v:unknown)=>invoke('commit',v)};
};
const many=(n:number,more:(i:number)=>object=()=>({}))=>Array.from({length:n},(_,i)=>change(i,more(i)));

it('initializes 1,501 records atomically, replays exactly and pulls them as one transaction',async()=>{
 const s=fresh(),input={root:'rootFolder',commit:{operation:'init',changes:many(1501,i=>({sealedHash:hash(i),number:'ใบแจ้งหนี้-'+i,claims:['receipt-for:d'+i]}))},counterFloors:{'invoice-2026':1501}};
 const first=await s.initialize(input);
 expect(first.ok).toBe(true);expect(first.changes).toHaveLength(1501);
 expect(await s.initialize(input)).toEqual(first);
 const page=await s.pull(0);
 expect(page.cursor).toBe(1);expect(page.transactions).toHaveLength(1);expect(page.transactions[0].changes).toHaveLength(1501);
 await runInDurableObject(s.stub,(_:Workspace,state)=>{expect(state.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM heads').one().n).toBe(1501);});
});
it('stores an initialization near the 800 KiB request bound',async()=>{
 const s=fresh(),input={root:'rootFolder',commit:{operation:'init',changes:many(3700,i=>({sealedHash:hash(i)}))}};
 expect(JSON.stringify(input).length).toBeGreaterThan(700*1024);expect(JSON.stringify(input).length).toBeLessThan(819200);
 expect((await s.initialize(input)).changes).toHaveLength(3700);
 expect((await s.pull(0)).transactions[0].changes).toHaveLength(3700);
});
it('keeps the count bounds: 4,096 for initialization and 512 for ordinary commits',async()=>{
 const s=fresh();
 await expect(s.initialize({root:'rootFolder',commit:{operation:'init',changes:many(4097)}})).rejects.toThrow('INVALID_COMMIT');
 expect((await s.status()).root).toBeNull();
 await s.initialize({root:'rootFolder',commit:{operation:'init',changes:[{key:'business:main',base:0,hash:hash(0),file:'driveFile'}]}});
 await expect(s.commit({operation:'big',changes:many(513)})).rejects.toThrow('INVALID_COMMIT');
 expect((await s.commit({operation:'ok',changes:many(512)})).ok).toBe(true);
});
it('rolls back a large initialization containing a duplicate number',async()=>{
 const s=fresh(),changes=many(1500,i=>({sealedHash:hash(i),number:'INV-'+i}));
 changes[1499].number='INV-3';
 await expect(s.initialize({root:'rootFolder',commit:{operation:'init',changes}})).rejects.toThrow('DUPLICATE_NUMBER');
 expect((await s.status()).root).toBeNull();
 await runInDurableObject(s.stub,(_:Workspace,state)=>{expect(state.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM heads').one().n).toBe(0);});
});
it('bounds a pull page by size without splitting or skipping a transaction',async()=>{
 const s=fresh();
 await s.initialize({root:'rootFolder',commit:{operation:'init',changes:[{key:'business:main',base:0,hash:hash(0),file:'driveFile'}]}});
 // 20 commits of roughly 600 KB of metadata each: more than one 8 MiB page.
 for(let t=0;t<20;t++){
  const changes=Array.from({length:512},(_,i)=>({key:'document:t'+t+'d'+i,base:0,hash:hash(i),file:'driveFile'+i,claims:Array.from({length:5},(_,j)=>('c'+t+'-'+i+'-'+j).padEnd(190,'x'))}));
  expect((await s.commit({operation:'op'+t,changes})).ok).toBe(true);
 }
 const sequences:number[]=[];let cursor=0,pages=0;
 for(;;){
  const page=await s.pull(cursor);if(!page.transactions.length)break;pages++;
  expect(page.transactions.reduce((n:number,t:{changes:unknown})=>n+JSON.stringify(t.changes).length,0)).toBeLessThanOrEqual(8*1024*1024);
  expect(page.cursor).toBe(page.transactions.at(-1).sequence);
  sequences.push(...page.transactions.map((t:{sequence:number})=>t.sequence));cursor=page.cursor;
 }
 expect(sequences).toEqual(Array.from({length:21},(_,i)=>i+1));expect(pages).toBeGreaterThan(1);
});

// Only POST /v3/initialize may exceed the ordinary 512 KiB request bound.
let privateKey:CryptoKey;
beforeAll(async()=>{
 const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;
 const jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'synthetic-key',alg:'RS256',use:'sig'});
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  if(String(input)!=='https://www.googleapis.com/oauth2/v3/certs')throw Error('Unexpected network request');
  return Response.json({keys:[jwk]});
 });
});
afterAll(()=>vi.restoreAllMocks());
it('allows a larger request body only for initialization',async()=>{
 const subject='scale-'+crypto.randomUUID().replaceAll('-','');
 const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'synthetic-key'}).setSubject(subject).setIssuer('https://accounts.google.com').setAudience('synthetic-client.apps.googleusercontent.com').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const post=(path:string,body:unknown)=>worker.fetch(new Request('https://test.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json','X-BillNgai-Protocol':'4'},body:JSON.stringify(body)}),{...env,GOOGLE_CLIENT_ID:'synthetic-client.apps.googleusercontent.com',ALLOWED_SUBJECTS:subject});
 const commit={operation:'init',changes:many(3000,i=>({sealedHash:hash(i)}))};
 expect(JSON.stringify(commit).length).toBeGreaterThan(524288);
 const ordinary=await post('/v3/commit',commit);
 expect(ordinary.status).toBe(413);expect(await ordinary.json()).toEqual({error:'REQUEST_TOO_LARGE'});
 const initialized=await post('/v3/initialize',{root:'rootFolder',commit});
 expect(initialized.status).toBe(200);expect((await initialized.json() as {changes:unknown[]}).changes).toHaveLength(3000);
 const oversized=await post('/v3/initialize',{root:'rootFolder',commit:{operation:'init2',changes:many(4096,i=>({sealedHash:hash(i),claims:['receipt-for:document-number-'+i]}))}});
 expect(oversized.status).toBe(413);
});
