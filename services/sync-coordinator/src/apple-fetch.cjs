'use strict';
const {Buffer}=require('node:buffer');
// Apple's SDK needs node-fetch's default/Headers/buffer interfaces. Workers'
// native fetch supports its transport without node:http or a crypto bypass.
async function appleFetch(input,options={}) {
 let url;try{url=new URL(String(input));}catch{throw Error('APPLE_TRANSPORT_URL');}
 const method=String(options.method||'GET').toUpperCase();
 const ocsp=['ocsp.apple.com','ocsp2.apple.com'].includes(url.hostname)&&['http:','https:'].includes(url.protocol)&&method==='POST'&&/^\/[A-Za-z0-9/_.+=-]*$/.test(url.pathname);
 const api=['api.storekit.itunes.apple.com','api.storekit-sandbox.itunes.apple.com'].includes(url.hostname)&&url.protocol==='https:'&&method==='GET'&&/^\/inApps\/v1\/transactions\/\d{1,128}$/.test(url.pathname);
 if((!ocsp&&!api)||url.username||url.password||url.port||url.search||url.hash)throw Error('APPLE_TRANSPORT_URL');
 const controller=new AbortController(),caller=options.signal;
 if(caller?.aborted)throw Error('APPLE_TRANSPORT_ABORTED');
 const abort=()=>controller.abort();caller?.addEventListener('abort',abort,{once:true});
 const timeout=Number.isFinite(options.timeout)&&options.timeout>0?Math.min(options.timeout,15000):15000;
 const timer=setTimeout(abort,timeout);
 let reader,rejectAbort;
 const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(Error('APPLE_TRANSPORT_ABORTED'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
 try {
  const {timeout:_timeout,size:_size,signal:_signal,...init}=options;
  const response=await Promise.race([globalThis.fetch(url.href,{...init,method,redirect:'manual',signal:controller.signal}),aborted]);
  reader=response.body?.getReader();
  if(response.status>=300&&response.status<400)throw Error('APPLE_TRANSPORT_REDIRECT');
  if(Number(response.headers.get('content-length'))>524288)throw Error('APPLE_TRANSPORT_SIZE');
  const chunks=[];let length=0;
  if(reader)for(;;){
   const {value,done}=await Promise.race([reader.read(),aborted]);if(done)break;
   length+=value.byteLength;if(length>524288)throw Error('APPLE_TRANSPORT_SIZE');chunks.push(value);
  }
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const result=new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  result.buffer=async()=>Buffer.from(await result.arrayBuffer());return result;
 } catch {
  // Never include an upstream URL, header, proof or error text in errors/logs.
  if(reader)void reader.cancel().catch(()=>{});controller.abort();
  throw Error('APPLE_TRANSPORT_FAILED');
 } finally {
  clearTimeout(timer);caller?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);
 }
}
module.exports=appleFetch;module.exports.default=appleFetch;module.exports.Headers=globalThis.Headers;
