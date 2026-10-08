const {test}=require('node:test');const assert=require('node:assert/strict');const {createDriveTransport,boundedJSON}=require('../lib/sync-v3-drive.cjs');
const options={allowProtocolUpgrade:true,origin:'https://synthetic.invalid',root:'testRoot',accessToken:async()=>'synthetic-drive-token',identityToken:async()=>'synthetic-id-token'};
test('Drive receives payload; coordinator receives metadata and a separate identity token',async()=>{
 const calls=[];const t=createDriveTransport({...options,fetchImpl:async(url,o)=>{calls.push({url,...o});return Response.json(url.includes('googleapis')?{id:'file1'}:url.includes('/protocol/upgrade')?{capability:4,minProtocol:4}:{ok:true});}});
 const file=await t.upload({name:'Synthetic client'});await t.commit({operation:'op1',changes:[{key:'client:a',file,hash:'a'.repeat(64),base:0}]});
 const payload=calls.find(c=>c.url.includes('googleapis')),commit=calls.find(c=>c.url.endsWith('/commit'));
 assert.equal(payload.method,'POST');assert.match(payload.body,/Synthetic client/);assert.equal(payload.headers.authorization,'Bearer synthetic-drive-token');
 assert.doesNotMatch(commit.body,/Synthetic client/);assert.equal(commit.headers.authorization,'Bearer synthetic-id-token');assert.equal(commit.redirect,'error');
});
test('rejects credential URLs, insecure origins and untrusted file paths',async()=>{
 for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?key=secret'])assert.throws(()=>createDriveTransport({...options,origin}),/SYNC_INVALID_SERVICE_URL/);
 const t=createDriveTransport({...options,fetchImpl:async()=>{throw Error('must not fetch');}});await assert.rejects(t.download('../escape'),/SYNC_INVALID_FILE_ID/);
});
test('bounds streamed response without trusting content-length and hides raw upstream error',async()=>{
 await assert.rejects(boundedJSON(new Response(' '.repeat(1024)),128),/SYNC_RESPONSE_TOO_LARGE/);
 const t=createDriveTransport({...options,fetchImpl:async()=>Response.json({error:'credentials echoed in server error'},{status:500})});await assert.rejects(t.status(),/^Error: SYNC_SERVICE_ERROR$/);
});

test('refuses upload/pull when the coordinator cannot gate older clients',async()=>{
 const calls=[];const t=createDriveTransport({...options,fetchImpl:async(url)=>{calls.push(url);return Response.json({error:'NOT_FOUND'},{status:404});}});
 await assert.rejects(t.upload({name:'Synthetic'}),/SYNC_PROTOCOL_UPGRADE_REQUIRED/);
 await assert.rejects(t.pull(0),/SYNC_PROTOCOL_UPGRADE_REQUIRED/);
 assert.ok(calls.every(url=>url.endsWith('/v3/protocol/upgrade')));
});
test('default transport cannot irreversibly upgrade a workspace without disclosed consent',async()=>{
 let calls=0;const t=createDriveTransport({...options,allowProtocolUpgrade:false,fetchImpl:async()=>{calls++;throw Error('must not call');}});
 await assert.rejects(t.pull(0),/SYNC_PROTOCOL_CONSENT_REQUIRED/);await assert.rejects(t.download('validFile'),/SYNC_PROTOCOL_CONSENT_REQUIRED/);await assert.rejects(t.upload({name:'Synthetic'}),/SYNC_PROTOCOL_CONSENT_REQUIRED/);assert.equal(calls,0);
});
