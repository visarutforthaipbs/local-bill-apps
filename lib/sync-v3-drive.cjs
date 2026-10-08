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
function createDriveTransport({origin,root,account,counterFloors,accessToken,identityToken,license='',appStoreReceipt=null,fetchImpl=fetch,allowLocalhost=false,allowProtocolUpgrade=false}){
 const url=new URL(origin);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(allowLocalhost&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('SYNC_INVALID_SERVICE_URL');
 if(!id(root))throw Error('SYNC_INVALID_ROOT');
 async function coordinator(path,body,retry=true){
  const response=await fetchImpl(url.origin+'/v3/'+path,{method:body===undefined?'GET':'POST',headers:{'X-BillNgai-Protocol':'4',authorization:'Bearer '+await identityToken(),...(account?{'X-BillNgai-Account':account}:{}),...(!appStoreReceipt&&license?{'X-BillNgai-License':license}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(30000)});
  const data=await boundedJSON(response,16*1024*1024);
  if(!response.ok){
   if(retry && data?.error==='PRO_REQUIRED' && appStoreReceipt){
    await coordinator('appstore-entitlement',{receipt:await appStoreReceipt()},false);
    return coordinator(path,body,false);
   }
   const code=typeof data?.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(data.error)?data.error:'SYNC_SERVICE_ERROR';throw Error(code);}return data;
 }
 async function drive(url,options){
  const response=await fetchImpl(url,{...options,headers:{...options.headers,authorization:'Bearer '+await accessToken()},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('SYNC_DRIVE_HTTP_'+response.status);return response;
 }
 let upgradePromise=null;
 async function upgradeProtocol(){
  if(!allowProtocolUpgrade)throw Error('SYNC_PROTOCOL_CONSENT_REQUIRED');
  if(upgradePromise)return upgradePromise;
  upgradePromise=confirmProtocol().catch(error=>{upgradePromise=null;throw error;});return upgradePromise;
 }
 async function confirmProtocol(){
  let result;try{result=await coordinator('protocol/upgrade',{protocol:4});}catch(error){if(error.message==='NOT_FOUND')throw Error('SYNC_PROTOCOL_UPGRADE_REQUIRED');throw error;}
  if(result?.capability!==4||result?.minProtocol!==4)throw Error('SYNC_PROTOCOL_UPGRADE_REQUIRED');
  return result;
 }
 return {
  upgradeProtocol,
  status:()=>coordinator('status'),
  initialize:async commit=>{await upgradeProtocol();return coordinator('initialize',{root,commit,...(counterFloors?{counterFloors}:{})});},
  reserve:async request=>{await upgradeProtocol();return coordinator('reserve',request);},
  commit:async request=>{await upgradeProtocol();return coordinator('commit',request);},
  pull:async cursor=>{if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('INVALID_CURSOR');await upgradeProtocol();return coordinator('pull?after='+cursor);},
  upload:async record=>{
   await upgradeProtocol();
   const text=S.canonical(record);if(Buffer.byteLength(text)>8*1024*1024)throw Error('SYNC_RECORD_TOO_LARGE');
   const boundary='billngai'+randomBytes(16).toString('hex');
   const metadata={name:S.digest(record)+'.json',parents:[root],mimeType:'application/json',appProperties:{billngaiProtocol:'3'}};
   const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--\r\n`;
   const response=await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
   const result=await boundedJSON(response,16384);if(!id(result.id))throw Error('SYNC_INVALID_FILE_ID');return result.id;
  },
  download:async file=>{
   if(!id(file))throw Error('SYNC_INVALID_FILE_ID');
   await upgradeProtocol();
   return boundedJSON(await drive('https://www.googleapis.com/drive/v3/files/'+file+'?alt=media',{method:'GET',headers:{}}));
  }
 };
}
module.exports={createDriveTransport,boundedJSON};
