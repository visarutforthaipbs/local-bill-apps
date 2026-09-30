import { env } from 'cloudflare:test';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/index';
import { canonical } from '../src/protocol';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
// Synthetic keys only: a throwaway Google signing key and a throwaway Pro-licence key pair.
let googleKey:CryptoKey, licenseKey:CryptoKeyPair, licensePem='';
const b64=(bytes:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
beforeAll(async()=>{
 const pair=await generateKeyPair('RS256');googleKey=pair.privateKey;
 const jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'synthetic-key',alg:'RS256',use:'sig'});
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  if(String(input)!=='https://www.googleapis.com/oauth2/v3/certs')throw Error('Unexpected network request');
  return Response.json({keys:[jwk]});
 });
 licenseKey=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']) as CryptoKeyPair;
 licensePem='-----BEGIN PUBLIC KEY-----\n'+b64(await crypto.subtle.exportKey('spki',licenseKey.publicKey) as ArrayBuffer)+'\n-----END PUBLIC KEY-----';
});
afterAll(()=>vi.restoreAllMocks());
const configured=(extra:Record<string,string>={})=>({...env,GOOGLE_CLIENT_ID:'synthetic-client',ALLOWED_SUBJECTS:'',LICENSE_PUBLIC_KEY:licensePem,MAX_ACCOUNTS_PER_LICENSE:'2',...extra});
const token=(subject:string)=>new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'synthetic-key'}).setSubject(subject).setIssuer('https://accounts.google.com').setAudience('synthetic-client').setIssuedAt().setExpirationTime('1h').sign(googleKey);
async function license(payload:Record<string,unknown>,signer=licenseKey.privateKey){
 const body=new TextEncoder().encode(canonical(payload));
 return b64(new TextEncoder().encode(JSON.stringify(payload)))+'.'+b64(await crypto.subtle.sign({name:'Ed25519'},signer,body));
}
async function status(subject:string,key?:string,e=configured()){
 const headers:Record<string,string>={authorization:'Bearer '+await token(subject)};if(key!==undefined)headers['X-BillNgai-License']=key;
 const res=await worker.fetch(new Request('https://test.invalid/v3/status',{headers}),e);return {status:res.status,body:await res.json() as {error?:string}};
}
const pro={license:'billngai-pro',plan:'pro-lifetime',email:'synthetic@example.invalid'};

it('accepts any validly signed Pro key and refuses requests without one',async()=>{
 expect((await status('license-user-1',await license(pro))).status).toBe(200);
 const missing=await status('license-user-2');expect(missing.status).toBe(403);expect(missing.body.error).toBe('PRO_REQUIRED');
});
it('refuses tampered, foreign-signed, non-Pro and expired keys',async()=>{
 const good=await license(pro),[p,s]=good.split('.');
 const tampered=b64(new TextEncoder().encode(JSON.stringify({...pro,email:'other@example.invalid'})))+'.'+s;
 const foreign=(await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify'])) as CryptoKeyPair;
 for(const key of [tampered,p+'.'+b64(new Uint8Array(64)),await license(pro,foreign.privateKey),await license({...pro,license:'other'}),await license({...pro,plan:'pro',validUntil:'2020-01-01'}),'not-a-key'])
  expect((await status('license-user-3',key)).status).toBe(403);
 expect((await status('license-user-3',await license({...pro,plan:'pro',validUntil:'2099-12-31'}))).status).toBe(200);
});
it('limits one key to a small number of Google accounts, and the same account can return',async()=>{
 const key=await license({...pro,email:'shared@example.invalid'});
 expect((await status('shared-a',key)).status).toBe(200);
 expect((await status('shared-b',key)).status).toBe(200);
 const third=await status('shared-c',key);expect(third.status).toBe(403);expect(third.body.error).toBe('LICENSE_ACCOUNT_LIMIT');
 expect((await status('shared-a',key)).status).toBe(200);
});
it('keeps the explicit allow-list for staff/test accounts, and a Pro key cannot switch accounts',async()=>{
 expect((await status('staff-account',undefined,configured({ALLOWED_SUBJECTS:'staff-account'}))).status).toBe(200);
 const req=new Request('https://test.invalid/v3/status',{headers:{authorization:'Bearer '+await token('license-user-1'),'X-BillNgai-License':await license(pro),'X-BillNgai-Account':'someone-else'}});
 expect((await worker.fetch(req,configured())).status).toBe(403);
});
it('without a licence key configured, the service stays allow-list only',async()=>{
 const res=await status('anyone',await license(pro),configured({LICENSE_PUBLIC_KEY:'',ALLOWED_SUBJECTS:'staff-account'}));
 expect(res.status).toBe(403);expect(res.body.error).toBe('ACCOUNT_NOT_ENABLED');
});
