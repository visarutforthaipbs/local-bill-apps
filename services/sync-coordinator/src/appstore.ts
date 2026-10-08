import { need, ProtocolError } from './protocol';
import {purchaseHash} from './storekit2';
// Electron exposes StoreKit 1 app receipts, not StoreKit 2 signed transactions.
// Keep receipt verification server-side; never trust the local masPro flag.
export async function verifyAppStoreProof(receipt: unknown, bundle: string, product: string, allowSandbox: boolean, fetchImpl: typeof fetch = fetch) {
  need(typeof receipt==='string' && receipt.length>=4 && receipt.length<=400000 && receipt.length%4===0 && /^[A-Za-z0-9+/]+={0,2}$/.test(receipt), 'APPSTORE_RECEIPT_INVALID');
  async function verify(url:string) {
    let response:Response;
    try{response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({'receipt-data':receipt}),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new ProtocolError('APPSTORE_VERIFICATION_UNAVAILABLE',503);}
    need(response.ok,'APPSTORE_VERIFICATION_UNAVAILABLE',503);
    need(response.body,'APPSTORE_VERIFICATION_UNAVAILABLE',503);
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();throw new ProtocolError('APPSTORE_VERIFICATION_UNAVAILABLE',503);}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ProtocolError('APPSTORE_VERIFICATION_UNAVAILABLE',503);}
  }
  let result=await verify('https://buy.itunes.apple.com/verifyReceipt');
  need(result && typeof result==='object','APPSTORE_RECEIPT_INVALID',403);
  if(result.status===21007){
    need(allowSandbox,'APPSTORE_SANDBOX_NOT_ENABLED',403);
    result=await verify('https://sandbox.itunes.apple.com/verifyReceipt');
  }
  need(result && result.status===0,'APPSTORE_RECEIPT_INVALID',403);
  need(result.environment==='Production'||(allowSandbox&&result.environment==='Sandbox'),'APPSTORE_RECEIPT_INVALID',403);
  need(result.receipt?.bundle_id===bundle && Array.isArray(result.receipt.in_app),'APPSTORE_RECEIPT_INVALID',403);
  const items=result.receipt.in_app.filter((v:Record<string,unknown>)=>v.product_id===product);
  const purchase=items.find((v:Record<string,unknown>)=>typeof v.original_transaction_id==='string'&&/^\d{1,128}$/.test(v.original_transaction_id)&&!Object.hasOwn(v,'cancellation_date')&&!Object.hasOwn(v,'cancellation_date_ms'));
  need(purchase,'APPSTORE_PRO_REQUIRED',403);
  // Do not retain the receipt, Apple ID or raw transaction ID.
  const verifiedAt=Date.now();
  return {purchase:purchaseHash(result.environment,bundle,product,purchase.original_transaction_id),environment:result.environment as 'Production'|'Sandbox',verifiedAt,until:verifiedAt+86400000,verifier:'apple-receipt-v1'};
}

export async function verifyAppStoreReceipt(...args:Parameters<typeof verifyAppStoreProof>) { return (await verifyAppStoreProof(...args)).purchase; }
