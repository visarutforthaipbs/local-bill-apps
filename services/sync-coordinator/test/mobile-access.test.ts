import {env,runInDurableObject} from 'cloudflare:test';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {EntitlementError} from '../src/entitlement-errors';
const apple=vi.hoisted(()=>({initial:{} as Record<string,unknown>,current:{} as Record<string,unknown>,calls:0,outage:false}));
// Stub Apple's network/cryptography boundary only. The actual route, verified
// transaction policy, Durable Object grants/quotas and Google signature run.
vi.mock('../src/storekit2',async()=>{
 const actual=await vi.importActual<typeof import('../src/storekit2')>('../src/storekit2');
 return {...actual,createAppleDependencies:async(config:import('../src/storekit2').AppleVerifierConfig)=>{
  if(!config.api.signingKey||!config.api.keyId||!config.api.issuerId)throw new EntitlementError('APPSTORE_NOT_CONFIGURED',503);
  return {verify:async(jws:string)=>({...jws.endsWith('.current')?apple.current:apple.initial}),current:async()=>{apple.calls++;if(apple.outage)throw new EntitlementError('APPSTORE_VERIFICATION_UNAVAILABLE',503);return proof(String(apple.current.environment),'current');}};
 }};
});
import worker from '../src/index';
declare module 'cloudflare:test' {interface ProvidedEnv extends Env {}}
const bundle='com.visarut.billngai',product='com.visarut.billngai.pro';
const desktop='desktop.apps.googleusercontent.com',ios='ios.apps.googleusercontent.com',foreign='foreign.apps.googleusercontent.com';
function proof(environment='Production',signature='initial',alg='ES256'){return Buffer.from(JSON.stringify({alg})).toString('base64url')+'.'+Buffer.from(JSON.stringify({environment})).toString('base64url')+'.'+signature;}
function reset(original='1001',extra:Record<string,unknown>={}){apple.initial={bundleId:bundle,productId:product,type:'Non-Consumable',environment:'Production',transactionId:original,originalTransactionId:original,signedDate:Date.now(),purchaseDate:Date.now()-86400000,...extra};apple.current={...apple.initial};apple.calls=0;apple.outage=false;}
let googleKey:CryptoKey,licensePair:CryptoKeyPair,publicPEM='';
beforeAll(async()=>{
 const pair=await generateKeyPair('RS256');googleKey=pair.privateKey;const jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'mobile-route',alg:'RS256',use:'sig'});
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  if(String(input)==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
  if(String(input)==='https://buy.itunes.apple.com/verifyReceipt')return Response.json({status:0,environment:'Production',receipt:{bundle_id:bundle,in_app:[{product_id:product,original_transaction_id:apple.initial.originalTransactionId}]}});
  throw Error('unexpected network');
 });
 licensePair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']) as CryptoKeyPair;
 publicPEM='-----BEGIN PUBLIC KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('spki',licensePair.publicKey)).toString('base64')+'\n-----END PUBLIC KEY-----';
});
afterAll(()=>vi.restoreAllMocks());
const settings=(extra:Record<string,string>={})=>({...env,GOOGLE_CLIENT_ID:desktop,GOOGLE_CLIENTS:JSON.stringify({[desktop]:[desktop,ios],[ios]:[ios]}),ALLOWED_SUBJECTS:'',LICENSE_PUBLIC_KEY:publicPEM,APPSTORE_BUNDLE_ID:bundle,APPSTORE_PRODUCT_ID:product,APPSTORE_APP_ID:'6789503350',APPSTORE_SANDBOX_SUBJECTS:'',APPSTORE_SIGNING_KEY:'synthetic-not-a-real-key',APPSTORE_KEY_ID:'synthetic',APPSTORE_ISSUER_ID:'synthetic',MAX_ACCOUNTS_PER_LICENSE:'3',REVOKED_PURCHASES:'',...extra});
async function call(subject:string,path='/v3/status',body?:unknown,options:{aud?:string|string[];azp?:string;account?:string;license?:string;config?:Record<string,string>;protocol?:string}={}){
 const token=await new SignJWT(options.azp?{azp:options.azp}:{}).setProtectedHeader({alg:'RS256',kid:'mobile-route'}).setSubject(subject).setIssuer('https://accounts.google.com').setAudience(options.aud||ios).setIssuedAt().setExpirationTime('5m').sign(googleKey);
 const headers:Record<string,string>={authorization:'Bearer '+token,'content-type':'application/json'};
 if(options.account)headers['X-BillNgai-Account']=options.account;if(options.license)headers['X-BillNgai-License']=options.license;if(options.protocol)headers['X-BillNgai-Protocol']=options.protocol;
 return worker.fetch(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers,...body===undefined?{}:{body:JSON.stringify(body)}}),settings(options.config));
}
async function pro(extra:Record<string,unknown>={}){const payload={license:'billngai-pro',plan:'pro-lifetime',...extra};const body=JSON.stringify(payload,Object.keys(payload).sort());return Buffer.from(JSON.stringify(payload)).toString('base64')+'.'+Buffer.from(await crypto.subtle.sign({name:'Ed25519'},licensePair.privateKey,new TextEncoder().encode(body))).toString('base64');}
it('iOS signed proof checks current Apple state then grants a one-hour account lease; desktop uses same workspace',async()=>{
 reset('1101');expect((await call('sk2-owner','/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(200);expect(apple.calls).toBe(1);
 expect((await call('sk2-owner')).status).toBe(200);expect((await call('sk2-owner','/v3/status',undefined,{aud:desktop})).status).toBe(200);expect((await call('sk2-unrelated')).status).toBe(403);
 await runInDurableObject(env.WORKSPACES.getByName('appstore:sk2-owner'),(_instance,state)=>{const grant=JSON.parse(state.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','appstore').one().value);expect(grant.verifier).toBe('apple-sk2-v1');expect(grant.until-grant.verifiedAt).toBe(3600000);expect(JSON.stringify(grant)).not.toContain(proof());});
});
it('legacy receipt and StoreKit2 share the same purchase account quota',async()=>{
 reset('1102');for(const [subject,body] of [['mixed-one',{receipt:'YQ=='}],['mixed-two',{signedTransaction:proof()}],['mixed-three',{signedTransaction:proof()}]] as const)expect((await call(subject,'/v3/appstore-entitlement',body)).status).toBe(200);
 const response=await call('mixed-four','/v3/appstore-entitlement',{signedTransaction:proof()});expect(response.status).toBe(403);expect(await response.json()).toEqual({error:'LICENSE_ACCOUNT_LIMIT'});
});
it('wrong SKU/type, current refund/expiry/identity/future signature and outages never create a grant',async()=>{
 let n=1200;
 for(const change of [{bundleId:'other'},{productId:'other'},{type:'Consumable'},{revocationReason:0},{expiresDate:1},{originalTransactionId:'999'},{signedDate:Date.now()+120000}]){
  reset(String(++n));apple.current={...apple.current,...change};const subject='sk2-denied-'+n;const result=await call(subject,'/v3/appstore-entitlement',{signedTransaction:proof()});expect(result.status).toBeGreaterThanOrEqual(400);expect((await call(subject)).status).toBe(403);
 }
 reset('1299');apple.outage=true;expect((await call('sk2-outage','/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(503);
});
it('an old lifetime signature can grant only after a fresh Apple API verification; a current refund still denies it',async()=>{
 reset('1297',{signedDate:Date.now()-365*86400000,purchaseDate:Date.now()-366*86400000});
 expect((await call('sk2-old-lifetime','/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(200);
 expect(apple.calls).toBeGreaterThan(0);
 reset('1298',{signedDate:Date.now()-365*86400000,purchaseDate:Date.now()-366*86400000});apple.current={...apple.current,revocationDate:Date.now()-60000};
 expect((await call('sk2-old-refunded','/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(403);
 expect((await call('sk2-old-refunded')).status).toBe(403);
});
it('Sandbox opt-in follows authenticated subject; removed opt-in invalidates cached access',async()=>{
 reset('1301',{environment:'Sandbox'});expect((await call('sk2-sandbox','/v3/appstore-entitlement',{signedTransaction:proof('Sandbox')})).status).toBe(403);expect(apple.calls).toBe(0);
 const config={APPSTORE_SANDBOX_SUBJECTS:'sk2-sandbox'};expect((await call('sk2-sandbox','/v3/appstore-entitlement',{signedTransaction:proof('Sandbox')},{config})).status).toBe(200);
 expect((await call('sk2-sandbox','/v3/status',undefined,{config})).status).toBe(200);expect((await call('sk2-sandbox')).status).toBe(403);
});
it('ambiguous bodies, untrusted environments/algorithms and missing API configuration fail closed',async()=>{
 reset('1401');for(const body of [{receipt:'YQ==',signedTransaction:proof()},{signedTransaction:proof(),pro:true},{signedTransaction:{}},{signedTransaction:proof('Xcode')},{signedTransaction:proof('Production','initial','none')}])expect((await call('sk2-shape','/v3/appstore-entitlement',body)).status).toBeGreaterThanOrEqual(400);
 expect((await call('sk2-config','/v3/appstore-entitlement',{signedTransaction:proof()},{config:{APPSTORE_SIGNING_KEY:''}})).status).toBe(503);
 expect(apple.calls).toBe(0);
});
it('verified Google aud/azp pair maps to same subject; unrelated/mixed parties and account headers rejected',async()=>{
 const config={ALLOWED_SUBJECTS:'google-pairs'};
 for(const options of [{aud:ios},{aud:desktop},{aud:desktop,azp:ios},{aud:[desktop,ios],azp:ios}])expect((await call('google-pairs','/v3/status',undefined,{...options,config})).status).toBe(200);
 for(const options of [{aud:foreign},{aud:ios,azp:desktop},{aud:desktop,azp:foreign},{aud:[desktop,ios]},{aud:[desktop,foreign],azp:ios}])expect((await call('google-pairs','/v3/status',undefined,{...options,config})).status).toBe(401);
 expect((await call('google-pairs','/v3/status',undefined,{config,account:'other'})).status).toBe(403);
 expect((await call('google-pairs','/v3/status',undefined,{config:{ALLOWED_SUBJECTS:'google-pairs',GOOGLE_CLIENTS:''}})).status).toBe(401);
});
it('desktop direct purchase binds verified account; iOS needs no license header; revocation/key rotation deny it',async()=>{
 const key=await pro({owner:'cross-platform-synthetic'});
 expect((await call('direct-mobile','/v3/status',undefined,{aud:desktop,license:key})).status).toBe(200);expect((await call('direct-mobile')).status).toBe(200);expect((await call('direct-foreign')).status).toBe(403);
 const hash=createHash('sha256').update(key).digest('hex');expect((await call('direct-mobile','/v3/status',undefined,{config:{REVOKED_PURCHASES:hash}})).status).toBe(403);expect((await call('direct-mobile','/v3/status',undefined,{config:{LICENSE_PUBLIC_KEY:''}})).status).toBe(403);
 reset('1501');apple.current.revocationReason=0;expect((await call('direct-mobile','/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(403);expect((await call('direct-mobile')).status).toBe(200);
});
it('SK2 lease expiry/revocation policy and protocol upgrade remain enforced independently',async()=>{
 reset('1601');const subject='sk2-expiry';expect((await call(subject,'/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(200);
 const hash=createHash('sha256').update('Production:'+bundle+':'+product+':1601').digest('hex');expect((await call(subject,'/v3/status',undefined,{config:{REVOKED_PURCHASES:hash}})).status).toBe(403);
 expect((await call(subject,'/v3/protocol/upgrade',{protocol:4},{protocol:'4'})).status).toBe(200);expect((await call(subject)).status).toBe(409);
 expect((await call(subject,'/v3/appstore-entitlement',{signedTransaction:proof()})).status).toBe(200);expect((await call(subject,'/v3/status',undefined,{protocol:'4'})).status).toBe(200);
 await runInDurableObject(env.WORKSPACES.getByName('appstore:'+subject),(_instance,state)=>{const grant=JSON.parse(state.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','appstore').one().value);grant.until=Date.now()-1;state.storage.sql.exec('UPDATE metadata SET value=? WHERE key=?',JSON.stringify(grant),'appstore');});
 expect((await call(subject,'/v3/status',undefined,{protocol:'4'})).status).toBe(403);
});
