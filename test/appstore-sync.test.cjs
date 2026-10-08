const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDriveTransport}=require('../lib/sync-v3-drive.cjs');
test('MAS receipt exchange stays on coordinator, retries rejected operation once and never sends direct key',async()=>{
 const seen=[];let granted=false;
 const fetchImpl=async(url,o)=>{seen.push({url,headers:o.headers,body:o.body});if(url.endsWith('/appstore-entitlement')){granted=true;return Response.json({ok:true});}return granted?Response.json({protocol:3}):Response.json({error:'PRO_REQUIRED'},{status:403});};
 const t=createDriveTransport({origin:'https://sync.example.invalid',root:'root',account:'google-test',appStoreReceipt:async()=>'synthetic-base64-proof',accessToken:async()=>'drive-token',identityToken:async()=>'google-token',fetchImpl});
 assert.equal((await t.status()).protocol,3);assert.equal(seen.length,3);
 assert.equal(seen[1].url,'https://sync.example.invalid/v3/appstore-entitlement');assert.deepEqual(JSON.parse(seen[1].body),{receipt:'synthetic-base64-proof'});
 for(const call of seen){assert.equal(call.headers['X-BillNgai-License'],undefined);assert.equal(call.headers.authorization,'Bearer google-token');}
});
test('invalid Apple proof fails closed with no sync-operation retry',async()=>{
 let calls=0;
 const t=createDriveTransport({origin:'https://sync.example.invalid',root:'root',appStoreReceipt:async()=>'proof',accessToken:async()=>'drive',identityToken:async()=>'jwt',fetchImpl:async url=>{calls++;return Response.json({error:url.endsWith('/appstore-entitlement')?'APPSTORE_RECEIPT_INVALID':'PRO_REQUIRED'},{status:403});}});
 await assert.rejects(t.status(),/APPSTORE_RECEIPT_INVALID/);assert.equal(calls,2);
});
test('a server that still denies after successful receipt exchange cannot cause an infinite retry',async()=>{
 let calls=0;const t=createDriveTransport({origin:'https://sync.example.invalid',root:'root',appStoreReceipt:async()=>'proof',accessToken:async()=>'drive',identityToken:async()=>'jwt',fetchImpl:async url=>{calls++;return url.endsWith('/appstore-entitlement')?Response.json({ok:true}):Response.json({error:'PRO_REQUIRED'},{status:403});}});
 await assert.rejects(t.status(),/PRO_REQUIRED/);assert.equal(calls,3);
});
test('Apple proof retry preserves protocol consent and cannot leak an accidentally supplied direct key',async()=>{
 const seen=[];let granted=false;
 const t=createDriveTransport({origin:'https://sync.example.invalid',root:'root',license:'must-not-leak',allowProtocolUpgrade:true,appStoreReceipt:async()=>'proof',accessToken:async()=>'drive',identityToken:async()=>'jwt',fetchImpl:async(url,o)=>{
  seen.push({url,...o});
  if(url.endsWith('/appstore-entitlement')){granted=true;return Response.json({ok:true});}
  if(!granted)return Response.json({error:'PRO_REQUIRED'},{status:403});
  return Response.json(url.endsWith('/protocol/upgrade')?{capability:4,minProtocol:4}:{ok:true});
 }});
 await t.pull(0);
 assert.deepEqual(seen.map(s=>s.url.split('/v3/')[1]),['protocol/upgrade','appstore-entitlement','protocol/upgrade','pull?after=0']);
 for(const call of seen){assert.equal(call.headers['X-BillNgai-License'],undefined);assert.equal(call.headers['X-BillNgai-Protocol'],'4');}
});
