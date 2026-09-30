'use strict';
const {randomBytes}=require('node:crypto');
const S=require('./sync-v3.cjs');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
async function boundedJSON(response,max=8*1024*1024){
 if(!response.body)throw Error('EMPTY_RESPONSE');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>max){await reader.cancel();throw Error('SYNC_RESPONSE_TOO_LARGE');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('SYNC_RESPONSE_INVALID');}
}
function createDriveTransport({origin,root,account,counterFloors,accessToken,identityToken,fetchImpl=fetch,allowLocalhost=false}){
 const url=new URL(origin);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(allowLocalhost&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('SYNC_INVALID_SERVICE_URL');
 if(!id(root))throw Error('SYNC_INVALID_ROOT');
 async function coordinator(path,body){
  const response=await fetchImpl(url.origin+'/v3/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+await identityToken(),...(account?{'X-BillNgai-Account':account}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(30000)});
  const data=await boundedJSON(response,16*1024*1024);
  if(!response.ok){const code=typeof data?.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(data.error)?data.error:'SYNC_SERVICE_ERROR';throw Error(code);}return data;
 }
 async function drive(url,options){
  const response=await fetchImpl(url,{...options,headers:{...options.headers,authorization:'Bearer '+await accessToken()},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('SYNC_DRIVE_HTTP_'+response.status);return response;
 }
 return {
  status:()=>coordinator('status'),
  initialize:commit=>coordinator('initialize',{root,commit,...(counterFloors?{counterFloors}:{})}),
  reserve:request=>coordinator('reserve',request),
  commit:request=>coordinator('commit',request),
  pull:cursor=>{if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('INVALID_CURSOR');return coordinator('pull?after='+cursor);},
  upload:async record=>{
   const text=S.canonical(record);if(Buffer.byteLength(text)>8*1024*1024)throw Error('SYNC_RECORD_TOO_LARGE');
   const boundary='billngai'+randomBytes(16).toString('hex');
   const metadata={name:S.digest(record)+'.json',parents:[root],mimeType:'application/json',appProperties:{billngaiProtocol:'3'}};
   const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--\r\n`;
   const response=await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
   const result=await boundedJSON(response,16384);if(!id(result.id))throw Error('SYNC_INVALID_FILE_ID');return result.id;
  },
  download:async file=>{
   if(!id(file))throw Error('SYNC_INVALID_FILE_ID');
   return boundedJSON(await drive('https://www.googleapis.com/drive/v3/files/'+file+'?alt=media',{method:'GET',headers:{}}));
  }
 };
}
module.exports={createDriveTransport,boundedJSON};
