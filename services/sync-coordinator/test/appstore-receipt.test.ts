import {env,runInDurableObject} from 'cloudflare:test';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {generateKeyPair,exportJWK,exportPKCS8,SignJWT} from 'jose';
import worker from '../src/index';
import {verifyAppStoreReceipt} from '../src/appstore';
declare module 'cloudflare:test' {interface ProvidedEnv extends Env {}}
const bundle='com.visarut.billngai',product='com.visarut.billngai.pro';
const production=(extra:Record<string,unknown>={})=>({status:0,environment:'Production',receipt:{bundle_id:bundle,in_app:[{product_id:product,original_transaction_id:'1234567890',...extra}]}});
const fixtureFetch=(value:unknown)=>vi.fn(async()=>Response.json(value)) as unknown as typeof fetch;
it('requires an Apple-verified exact bundle/product and uncancelled non-consumable',async()=>{
 const hash=await verifyAppStoreReceipt('YQ==',bundle,product,false,fixtureFetch(production()));expect(hash).toMatch(/^[a-f0-9]{64}$/);
 for(const bad of [{...production(),status:21002},{...production(),receipt:{bundle_id:'other',in_app:production().receipt.in_app}},production({product_id:'other'}),production({cancellation_date_ms:'0'}),production({original_transaction_id:''})])await expect(verifyAppStoreReceipt('YQ==',bundle,product,false,fixtureFetch(bad))).rejects.toThrow();
});
it('sandbox fallback is exact 21007 and opt-in; never grants production access from sandbox by default',async()=>{
 const seen:string[]=[];const mock=vi.fn(async input=>{seen.push(String(input));return Response.json(seen.length===1?{status:21007}:{...production(),environment:'Sandbox'});}) as unknown as typeof fetch;
 await expect(verifyAppStoreReceipt('YQ==',bundle,product,false,mock)).rejects.toThrow('APPSTORE_SANDBOX_NOT_ENABLED');expect(seen).toHaveLength(1);
 seen.length=0;await expect(verifyAppStoreReceipt('YQ==',bundle,product,true,mock)).resolves.toMatch(/^[a-f0-9]{64}$/);
 expect(seen).toEqual(['https://buy.itunes.apple.com/verifyReceipt','https://sandbox.itunes.apple.com/verifyReceipt']);
});
it('rejects oversized/malformed receipts, unavailable Apple, malformed and oversized responses',async()=>{
 for(const receipt of ['',{},'not base64','YQ=='.repeat(100001)])await expect(verifyAppStoreReceipt(receipt,bundle,product,false,fixtureFetch(production()))).rejects.toThrow();
 for(const response of [new Response('',{status:503}),new Response('{'),new Response(' '.repeat(2097153))])await expect(verifyAppStoreReceipt('YQ==',bundle,product,false,(async()=>response) as typeof fetch)).rejects.toThrow();
});
let key:CryptoKey;let apple:unknown=production();
beforeAll(async()=>{const pair=await generateKeyPair('RS256');key=pair.privateKey;const jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'appstore-test',alg:'RS256',use:'sig'});
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{if(String(input)==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});if(String(input)==='https://buy.itunes.apple.com/verifyReceipt')return Response.json(apple);throw Error('unexpected network');});});
afterAll(()=>vi.restoreAllMocks());
const settings=()=>({...env,GOOGLE_CLIENT_ID:'synthetic-client.apps.googleusercontent.com',ALLOWED_SUBJECTS:'',LICENSE_PUBLIC_KEY:'',APPSTORE_BUNDLE_ID:bundle,APPSTORE_PRODUCT_ID:product,APPSTORE_SANDBOX_SUBJECTS:'',MAX_ACCOUNTS_PER_LICENSE:'3'});
async function call(subject:string,path='/v3/status',body?:unknown,extraHeaders:Record<string,string>={}){
 const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'appstore-test'}).setSubject(subject).setIssuer('https://accounts.google.com').setAudience('synthetic-client.apps.googleusercontent.com').setIssuedAt().setExpirationTime('5m').sign(key);
 return worker.fetch(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json',...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})}),settings());
}
it('Google login or local Pro flags alone cannot grant sync; verified receipt binds only authenticated account',async()=>{
 expect((await call('receipt-owner')).status).toBe(403);
 expect((await call('receipt-owner','/v3/appstore-entitlement',{masPro:true})).status).toBe(400);
 expect((await call('receipt-owner','/v3/appstore-entitlement',{receipt:'YQ=='},{'X-BillNgai-Account':'other'})).status).toBe(403);
 apple=production();expect((await call('receipt-owner','/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(200);
 expect((await call('receipt-owner')).status).toBe(200);expect((await call('unrelated-owner')).status).toBe(403);
});
it('one Apple purchase cannot be claimed by more than three Google accounts',async()=>{
 apple=production();for(const subject of ['receipt-owner-two','receipt-owner-three'])expect((await call(subject,'/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(200);
 const response=await call('receipt-owner-four','/v3/appstore-entitlement',{receipt:'YQ=='});expect(response.status).toBe(403);expect(await response.json()).toEqual({error:'LICENSE_ACCOUNT_LIMIT'});
});

it('bounds receipt verification attempts per authenticated Google subject',async()=>{
 apple=production({cancellation_date_ms:'123'});
 for(let i=0;i<10;i++)expect((await call('receipt-rate-check','/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(403);
 const response=await call('receipt-rate-check','/v3/appstore-entitlement',{receipt:'YQ=='});expect(response.status).toBe(429);expect(await response.json()).toEqual({error:'APPSTORE_VERIFICATION_RATE_LIMIT'});
 apple=production();
});
it('workspace upgrade denies old coordinator reads but leaves Apple proof administration available',async()=>{
 apple=production({original_transaction_id:'6666666666'});
 const subject='receipt-protocol-owner';
 expect((await call(subject,'/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(200);
 expect((await call(subject,'/v3/protocol/upgrade',{protocol:4},{'X-BillNgai-Protocol':'4'})).status).toBe(200);
 const old=await call(subject);expect(old.status).toBe(409);expect(await old.json()).toEqual({error:'SYNC_CLIENT_UPGRADE_REQUIRED'});
 expect((await call(subject,'/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(200);
 expect((await call(subject,'/v3/status',undefined,{'X-BillNgai-Protocol':'4'})).status).toBe(200);
});

it('expired Apple grants require fresh proof and refunded proof cannot renew them',async()=>{
 apple=production({original_transaction_id:'9876543210'});
 expect((await call('receipt-expiry-owner','/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(200);
 expect((await call('receipt-expiry-owner')).status).toBe(200);
 await runInDurableObject(env.WORKSPACES.getByName('appstore:receipt-expiry-owner'),(_instance,state)=>{
  const raw=state.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','appstore').toArray()[0].value;
  const grant=JSON.parse(raw);grant.until=Date.now()-1;
  state.storage.sql.exec('UPDATE metadata SET value=? WHERE key=?',JSON.stringify(grant),'appstore');
 });
 expect((await call('receipt-expiry-owner')).status).toBe(403);
 apple=production({original_transaction_id:'9876543210',cancellation_date_ms:'123'});
 expect((await call('receipt-expiry-owner','/v3/appstore-entitlement',{receipt:'YQ=='})).status).toBe(403);
 expect((await call('receipt-expiry-owner')).status).toBe(403);
 apple=production();
});

it('actual Apple factory loads in Workers with online verification and rejects fake signed proofs',async()=>{
 const {createAppleDependencies}=await import('../src/storekit2');
 const {Buffer}=await import('node:buffer');const {default:root}=await import('../src/AppleRootCA-G3.cer');
 await expect(createAppleDependencies({bundleId:bundle,productId:product,appAppleId:6789503350,roots:[Buffer.from(root)],sandboxSubjects:[],api:{signingKey:'',keyId:'',issuerId:''}})).rejects.toThrow('APPSTORE_NOT_CONFIGURED');
 const pair=await generateKeyPair('ES256',{extractable:true});
 const verifier=await createAppleDependencies({bundleId:bundle,productId:product,appAppleId:6789503350,roots:[Buffer.from(root)],sandboxSubjects:[],api:{signingKey:await exportPKCS8(pair.privateKey),keyId:'synthetic',issuerId:'synthetic'}});
 await expect(verifier.verify('eyJhbGciOiJFUzI1NiJ9.eyJlbnZpcm9ubWVudCI6IlByb2R1Y3Rpb24ifQ.c2lnbmF0dXJl','Production')).rejects.toThrow('APPSTORE_TRANSACTION_INVALID');
});
