import { env } from 'cloudflare:test';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/index';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
let privateKey:CryptoKey;
const configured=()=>({...env,GOOGLE_CLIENT_ID:'synthetic-client',ALLOWED_SUBJECTS:'synthetic-account'});
beforeAll(async()=>{
 const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;
 const jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'synthetic-key',alg:'RS256',use:'sig'});
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  if(String(input)!=='https://www.googleapis.com/oauth2/v3/certs')throw Error('Unexpected network request');
  return Response.json({keys:[jwk]});
 });
});
afterAll(()=>vi.restoreAllMocks());
async function token(options:{audience?:string;subject?:string;expiry?:string;issuer?:string}={}){
 return new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'synthetic-key'}).setSubject(options.subject||'synthetic-account').setIssuer(options.issuer||'https://accounts.google.com').setAudience(options.audience||'synthetic-client').setIssuedAt().setExpirationTime(options.expiry||'5m').sign(privateKey);
}
async function call(jwt:string,path='/v3/status',body?:string){return worker.fetch(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json'},...(body===undefined?{}:{body})}),configured());}
it('accepts correctly signed audience/issuer/subject and isolates via verified identity',async()=>{expect((await call(await token())).status).toBe(200);});
it('rejects missing, malformed, expired, wrong audience and wrong issuer tokens',async()=>{
 for(const jwt of ['', 'not-a-jwt',await token({expiry:'-1h'}),await token({audience:'wrong'}),await token({issuer:'https://attacker.invalid'})])expect((await call(jwt)).status).toBe(401);
});
it('valid Google token does not bypass private test-account allowlist',async()=>{expect((await call(await token({subject:'different-account'}))).status).toBe(403);});
it('RPC domain failures retain their status, malformed and oversized bodies are rejected',async()=>{
 const jwt=await token();expect((await call(jwt,'/v3/commit',JSON.stringify({operation:'x',changes:[]}))).status).toBe(400);
 expect((await call(jwt,'/v3/commit','{')).status).toBe(400);
 expect((await call(jwt,'/v3/commit',' '.repeat(524289))).status).toBe(413);
 expect((await call(jwt,'/v3/pull?after=1')).status).toBe(409);
});
it('account-bound replica cannot send operations after switching Google accounts',async()=>{
 const req=new Request('https://test.invalid/v3/status',{headers:{authorization:'Bearer '+await token(),'X-BillNgai-Account':'old-account'}});
 expect((await worker.fetch(req,configured())).status).toBe(403);
});
