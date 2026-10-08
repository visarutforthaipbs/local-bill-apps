'use strict';
// Run with node --test test/apple-fetch.node.cjs. Apple cryptography is never mocked here.
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fetchApple=require('../src/apple-fetch.cjs');
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const current='https://api.storekit.itunes.apple.com/inApps/v1/transactions/123';

test('official SDK CommonJS/default/Headers and native JSON/buffer interfaces work',async()=>{
 assert.equal(fetchApple.default,fetchApple);assert.equal(fetchApple.Headers,Headers);
 let request;
 globalThis.fetch=async(url,options)=>{request={url,options};return new Response('{"signedTransactionInfo":"synthetic"}',{status:200,headers:{'content-type':'application/json'}});};
 const result=await fetchApple(current,{method:'GET',headers:new Headers({authorization:'synthetic-test-only'})});
 assert.equal(request.options.redirect,'manual');assert.ok(request.options.signal);
 assert.deepEqual(await result.json(),{signedTransactionInfo:'synthetic'});
 globalThis.fetch=async()=>new Response(Uint8Array.from([0,128,255]),{status:200,statusText:'OK',headers:{'content-type':'application/ocsp-response'}});
 const ocsp=await fetchApple('http://ocsp.apple.com/ocsp03-test',{method:'POST',body:Buffer.from([1]),headers:new Headers()});
 assert.equal(ocsp.statusText,'OK');assert.equal(ocsp.headers.get('content-type'),'application/ocsp-response');
 assert.deepEqual(await ocsp.buffer(),Buffer.from([0,128,255]));
});
test('only the exact Apple hosts, methods and transaction paths reach fetch',async()=>{
 let count=0;globalThis.fetch=async()=>{count++;return new Response('{}');};
 for(const [url,method]of [
  ['https://example.com/inApps/v1/transactions/123','GET'],
  ['https://api.storekit.itunes.apple.com.evil.test/inApps/v1/transactions/123','GET'],
  ['http://api.storekit.itunes.apple.com/inApps/v1/transactions/123','GET'],
  [current+'?q=1','GET'],[current+'#fragment','GET'],[current.replace('https://','https://user:pass@'),'GET'],
  [current.replace('.com/','.com:444/'),'GET'],[current,'POST'],
  [current.replace('/123','/../123'),'GET'],[current.replace('/123','/abc'),'GET'],
  [current.replace('/123','/'+ '1'.repeat(129)),'GET'],['https://ocsp.apple.com/path','GET']
 ])await assert.rejects(()=>fetchApple(url,{method}));
 assert.equal(count,0);
 await fetchApple('https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/1',{method:'GET'});
 await fetchApple('https://ocsp2.apple.com/ocsp-test',{method:'POST',body:Buffer.from([1])});assert.equal(count,2);
});
test('HTTP errors remain responses for the official SDK; redirect errors expose no upstream detail',async()=>{
 globalThis.fetch=async()=>new Response('{"errorCode":4040010}',{status:404,statusText:'Not Found'});
 const response=await fetchApple(current,{method:'GET'});assert.equal(response.status,404);assert.deepEqual(await response.json(),{errorCode:4040010});
 globalThis.fetch=async()=>new Response(null,{status:301,headers:{location:'https://private.test'}});
 await assert.rejects(()=>fetchApple(current,{method:'GET'}));
 globalThis.fetch=async()=>{throw Error('Bearer SECRET https://private.test');};
 await assert.rejects(()=>fetchApple(current,{method:'GET'}),e=>!e.message.includes('SECRET')&&!e.message.includes('private.test'));
});
test('chunked bodies are bounded and canceled without relying on Content-Length',async()=>{
 let canceled=false;
 globalThis.fetch=async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(262145));},cancel(){canceled=true;}}));
 await assert.rejects(()=>fetchApple(current,{method:'GET'}));assert.equal(canceled,true);
});
test('SDK timeout also bounds a stalled body and cancels it',async()=>{
 let canceled=false;
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));},cancel(){canceled=true;}}));
 const before=Date.now();await assert.rejects(()=>fetchApple(current,{method:'GET',timeout:25}));assert.ok(Date.now()-before<1000);assert.equal(canceled,true);
});
test('caller cancellation is honored before and during body consumption',async()=>{
 let count=0;globalThis.fetch=async()=>{count++;return new Response('{}');};
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>fetchApple(current,{method:'GET',signal:aborted.signal}));assert.equal(count,0);
 let canceled=false;const controller=new AbortController();
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));},cancel(){canceled=true;}}));
 const pending=fetchApple(current,{method:'GET',signal:controller.signal});setTimeout(()=>controller.abort(),20);
 await assert.rejects(()=>pending);assert.equal(canceled,true);
});
