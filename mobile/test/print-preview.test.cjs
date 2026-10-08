const test=require('node:test'),assert=require('node:assert/strict');
const {createCoordinator}=require('../web/mobile-print-preview.js');
test('changing documents rejects a delayed preview and serializes native rendering',async()=>{
 let current='a',done,calls=[];
 const c=createCoordinator(id=>{calls.push(id);return id==='a'?new Promise(r=>done=r):Promise.resolve({documentId:id,token:'b1',pageCount:1});},id=>id===current);
 const a=c.prepare('a');await Promise.resolve();await Promise.resolve();current='b';const b=c.prepare('b');
 done({documentId:'a',token:'a1',pageCount:1});assert.equal(await a,null);assert.equal((await b).token,'b1');assert.deepEqual(calls,['a','b']);assert.equal(c.current('a'),null);
});
test('failed or mismatched PDFs never become shareable, and retry recovers',async()=>{
 let attempt=0;const c=createCoordinator(async id=>{if(++attempt===1)throw Error('renderer unavailable');return {documentId:id,token:'ok',pageCount:1};},()=>true);
 await assert.rejects(c.prepare('a'));assert.equal(c.current('a'),null);await c.prepare('a');assert.equal(c.current('a').token,'ok');c.invalidate();assert.equal(c.current('a'),null);
 const invalid=createCoordinator(async()=>({documentId:'wrong',token:'x',pageCount:1}),()=>true);await assert.rejects(invalid.prepare('a'));assert.equal(invalid.current('a'),null);
});
