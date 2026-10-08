import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { Environment, Type, SignedDataVerifier } from '@apple/app-store-server-library';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyGoogleToken, parseGoogleClients } from '../src/google.ts';
import { verifyStoreKit2, purchaseHash, createAppleDependencies } from '../src/apple.ts';
import { verifyDirectGrant, hasWorkspaceAccess } from '../src/grants.ts';
const now = Date.now();
const cfg = {bundleId:'com.visarut.billngai',productId:'com.visarut.billngai.pro',sandboxSubjects:['qa-sub']};
const tx = {transactionId:'12345',originalTransactionId:'12340',bundleId:cfg.bundleId,productId:cfg.productId,type:Type.NON_CONSUMABLE,environment:Environment.PRODUCTION,signedDate:now,purchaseDate:now-86400000};
function proof(environment = 'Production', alg='ES256') { return [Buffer.from(JSON.stringify({alg})).toString('base64url'),Buffer.from(JSON.stringify({environment})).toString('base64url'),'signature'].join('.'); }
const request = {signedTransaction:proof()};
function deps(overrides:object={}) { return {verify:async()=>({...tx,...overrides}),current:async()=>proof()}; }
const failure = (code:string)=> (error:unknown) => !!error && (error as {code:string}).code===code;
test('same original Apple identity produces legacy receipt hash, current data checked before grant', async()=>{
  let calls=0;const d=deps();d.current=async()=>{calls++;return proof();};
  const result=await verifyStoreKit2(request,'user-sub',cfg,d,now);
  assert.equal(calls,1);assert.equal(result.purchase,createHash('sha256').update('Production:com.visarut.billngai:com.visarut.billngai.pro:12340').digest('hex'));
  assert.equal(result.purchase,purchaseHash(Environment.PRODUCTION,cfg.bundleId,cfg.productId,'12340'));
  assert.equal(result.until-now,3600000);
});
test('old client proof still checks current refund and does not grant',async()=>{
  let count=0;await assert.rejects(verifyStoreKit2(request,'user-sub',cfg,{...deps(),verify:async()=>++count===1?{...tx,signedDate:now-86400000}:{...tx,revocationDate:now}},now),failure('APPSTORE_PRO_REVOKED'));
});
test('current transaction identity, expiry and freshness mismatch rejected',async()=>{
  for (const [change,code] of [[{originalTransactionId:'99'},'APPSTORE_TRANSACTION_INVALID'],[{transactionId:'99'},'APPSTORE_TRANSACTION_INVALID'],[{expiresDate:now-1},'APPSTORE_PRO_EXPIRED'],[{signedDate:now-900001},'APPSTORE_VERIFICATION_UNAVAILABLE']] as const) {
    let count=0;await assert.rejects(verifyStoreKit2(request,'user-sub',cfg,{...deps(),verify:async()=>++count===1?tx:{...tx,...change}},now),failure(code));
  }
});
test('wrong bundle/product/type, revoked field including zero, future date rejected',async()=>{
  for (const override of [{bundleId:'other'},{productId:'other'},{type:Type.CONSUMABLE},{revocationReason:0},{signedDate:now+60001},{transactionId:'invalid'}]) {
    await assert.rejects(verifyStoreKit2(request,'user-sub',cfg,deps(override),now));
  }
});
test('sandbox restricted by verified subject and environment, Xcode and extra body fields refused',async()=>{
  let checks=0;const d={...deps({environment:Environment.SANDBOX}),verify:async()=>{checks++;return {...tx,environment:Environment.SANDBOX};},current:async()=>proof('Sandbox')};
  await assert.rejects(verifyStoreKit2({signedTransaction:proof('Sandbox')},'not-qa',cfg,d,now),failure('APPSTORE_SANDBOX_NOT_ENABLED'));assert.equal(checks,0);
  assert.equal((await verifyStoreKit2({signedTransaction:proof('Sandbox')},'qa-sub',cfg,d,now)).environment,'Sandbox');
  await assert.rejects(verifyStoreKit2({signedTransaction:proof('Xcode')},'qa-sub',cfg,d,now));
  await assert.rejects(verifyStoreKit2({...request,receipt:'abc'},'qa-sub',cfg,d,now));
  await assert.rejects(verifyStoreKit2({signedTransaction:proof('Production','none')},'qa-sub',cfg,d,now));
});
test('API outage returns no grant',async()=>{
  await assert.rejects(verifyStoreKit2(request,'user-sub',cfg,{...deps(),current:async()=>{throw new Error('network outage');}},now));
});
test('official verifier rejects untrusted/fake signature rather than decoding a grant',async()=>{
  const verifier=new SignedDataVerifier([],true,Environment.PRODUCTION,cfg.bundleId,6789503350);
  await assert.rejects(verifier.verifyAndDecodeTransaction(proof()));
});
const web='web.apps.googleusercontent.com',ios='ios.apps.googleusercontent.com',unrelated='other.apps.googleusercontent.com';
test('Google signed audience/azp pairs retain same subject, invalid party/audience/account/expiry fail',async()=>{
  const keys=await generateKeyPair('RS256');const clients=parseGoogleClients(JSON.stringify({[web]:[web,ios],[ios]:[ios]}));
  async function token(aud:string|string[]=ios,azp:unknown=undefined,exp=Math.floor(Date.now()/1000)+3600) {const jwt=new SignJWT({...azp===undefined?{}:{azp},sub:'same-sub'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience(aud).setIssuedAt().setExpirationTime(exp);return jwt.sign(keys.privateKey);}
  assert.equal(await verifyGoogleToken(await token(),clients,keys.publicKey),'same-sub');
  assert.equal(await verifyGoogleToken(await token(web,ios),clients,keys.publicKey),'same-sub');
  assert.equal(await verifyGoogleToken(await token(web,undefined),clients,keys.publicKey),'same-sub');
  for(const jwt of [await token(ios,web),await token(web,unrelated),await token(unrelated),await token([web,ios],undefined),await token(ios,ios,1)]) await assert.rejects(verifyGoogleToken(jwt,clients,keys.publicKey),failure('UNAUTHORIZED'));
  await assert.rejects(verifyGoogleToken(await token(),clients,keys.publicKey,'other-sub'),failure('SYNC_ACCOUNT_MISMATCH'));
  const attacker=await generateKeyPair('RS256');const forged=await new SignJWT({sub:'same-sub',azp:ios}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience(ios).setIssuedAt().setExpirationTime('1h').sign(attacker.privateKey);
  await assert.rejects(verifyGoogleToken(forged,clients,keys.publicKey),failure('UNAUTHORIZED'));
});
function directLicense(payload:object) {const {privateKey,publicKey}=generateKeyPairSync('ed25519');const key=Buffer.from(JSON.stringify(payload)).toString('base64')+'.'+sign(null,Buffer.from(JSON.stringify(payload,Object.keys(payload).sort())),privateKey).toString('base64');return {key,publicKey:publicKey.export({format:'pem',type:'spki'}).toString()};}
test('direct verified lifetime grant authorizes same Google workspace without license header on mobile, revoked/rotated fail',async()=>{
  const pair=directLicense({license:'billngai-pro',plan:'pro-lifetime'});const grant=await verifyDirectGrant(pair.key,pair.publicKey,now);
  assert.equal(grant.purchase,createHash('sha256').update(pair.key).digest('hex'));assert.equal(grant.until,null);assert.equal(JSON.stringify(grant).includes(pair.key),false);
  const policy={directVerifier:grant.verifier,appleVerifier:'apple-v1',revokedPurchases:new Set<string>(),sandboxSubjects:new Set<string>()};
  assert.ok(hasWorkspaceAccess([grant],'same-sub',policy,now+86400000));
  assert.equal(hasWorkspaceAccess([grant],'same-sub',{...policy,revokedPurchases:new Set([grant.purchase])},now),false);
  assert.equal(hasWorkspaceAccess([grant],'same-sub',{...policy,directVerifier:'rotated'},now),false);
});
test('direct dated grant inclusive Bangkok day, malformed date/tampering expired fail',async()=>{
  const pair=directLicense({license:'billngai-pro',plan:'pro',validUntil:'2026-10-03'});const end=Date.parse('2026-10-04T00:00:00+07:00');
  const grant=await verifyDirectGrant(pair.key,pair.publicKey,end-1);assert.equal(grant.until,end);
  await assert.rejects(verifyDirectGrant(pair.key,pair.publicKey,end),failure('PRO_REQUIRED'));
  const invalid=directLicense({license:'billngai-pro',validUntil:'2026-02-30'});await assert.rejects(verifyDirectGrant(invalid.key,invalid.publicKey,now));
  await assert.rejects(verifyDirectGrant(pair.key+'x',pair.publicKey,now));
});
test('Apple workspace lease expiry, sandbox-subject restriction and hash revocation fail closed',()=>{
  const grant={source:'apple' as const,purchase:'a'.repeat(64),verifiedAt:now,until:now+3600000,verifier:'apple-v1',environment:'Sandbox' as const};
  const policy={directVerifier:'b'.repeat(64),appleVerifier:'apple-v1',revokedPurchases:new Set<string>(),sandboxSubjects:new Set(['qa-sub'])};
  assert.ok(hasWorkspaceAccess([grant],'qa-sub',policy,now));assert.equal(hasWorkspaceAccess([grant],'other',policy,now),false);assert.equal(hasWorkspaceAccess([grant],'qa-sub',policy,now+3600000),false);
  assert.equal(hasWorkspaceAccess([{...grant,until:null}],'qa-sub',policy,now),false);
});

test('missing Apple API credentials refuse to construct a verifier/grant',async()=>{
  await assert.rejects(createAppleDependencies({...cfg,appAppleId:6789503350,roots:[],api:{signingKey:'',keyId:'',issuerId:''}}),failure('APPSTORE_NOT_CONFIGURED'));
});
test('hash delimiter injection and unapproved Google config rejected',()=>{
  assert.throws(()=>purchaseHash(Environment.PRODUCTION,'com.visarut:other',cfg.productId,'12340'));
  assert.throws(()=>parseGoogleClients('{"attacker": ["anything"]}'));
  assert.throws(()=>parseGoogleClients('{}'));
});
