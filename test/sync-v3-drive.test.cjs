const {test}=require('node:test');const assert=require('node:assert/strict');const {createDriveTransport,boundedJSON}=require('../lib/sync-v3-drive.cjs');
const options={origin:'https://synthetic.invalid',root:'testRoot',accessToken:async()=>'synthetic-drive-token',identityToken:async()=>'synthetic-id-token'};
test('Drive receives payload; coordinator receives metadata and a separate identity token',async()=>{
 const calls=[];const t=createDriveTransport({...options,fetchImpl:async(url,o)=>{calls.push({url,...o});return Response.json(url.includes('googleapis')?{id:'file1'}:{ok:true});}});
 const file=await t.upload({name:'Synthetic client'});await t.commit({operation:'op1',changes:[{key:'client:a',file,hash:'a'.repeat(64),base:0}]});
 assert.equal(calls[0].method,'POST');assert.match(calls[0].body,/Synthetic client/);assert.equal(calls[0].headers.authorization,'Bearer synthetic-drive-token');
 assert.doesNotMatch(calls[1].body,/Synthetic client/);assert.equal(calls[1].headers.authorization,'Bearer synthetic-id-token');assert.equal(calls[1].redirect,'error');
});
test('rejects credential URLs, insecure origins and untrusted file paths',async()=>{
 for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?key=secret'])assert.throws(()=>createDriveTransport({...options,origin}),/SYNC_INVALID_SERVICE_URL/);
 const t=createDriveTransport({...options,fetchImpl:async()=>{throw Error('must not fetch');}});await assert.rejects(t.download('../escape'),/SYNC_INVALID_FILE_ID/);
});
test('bounds streamed response without trusting content-length and hides raw upstream error',async()=>{
 await assert.rejects(boundedJSON(new Response(' '.repeat(1024)),128),/SYNC_RESPONSE_TOO_LARGE/);
 const t=createDriveTransport({...options,fetchImpl:async()=>Response.json({error:'credentials echoed in server error'},{status:500})});await assert.rejects(t.status(),/^Error: SYNC_SERVICE_ERROR$/);
});
