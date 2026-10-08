// Local compatibility probe only. This is NOT an entitlement service and
// refuses public hosts. Production coordinator must use the modules above.
import { Buffer } from 'node:buffer';
import { X509Certificate, generateKeyPairSync, sign, verify } from 'node:crypto';

import rootData from '../certs/AppleRootCA-G3.cer';
export default {
  async fetch(request: Request) {
    if (!['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname)) return new Response('Local probe only', {status:403});
    const {Environment,SignedDataVerifier}=await import('@apple/app-store-server-library');
    const root=new X509Certificate(Buffer.from(rootData));
    const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
    const message=Buffer.from('synthetic compatibility probe');
    const signature=sign('SHA256',message,keys.privateKey);
    const verifier=new SignedDataVerifier([Buffer.from(rootData)],true,Environment.PRODUCTION,'com.visarut.billngai',6789503350);
    let rejects=false;
    try {await verifier.verifyAndDecodeTransaction('eyJhbGciOiJFUzI1NiJ9.eyJlbnZpcm9ubWVudCI6IlByb2R1Y3Rpb24ifQ.c2lnbmF0dXJl');} catch {rejects=true;}
    // Optional synthetic signed chain supplied by local test only; online=false
    // intentionally belongs to this probe, never the production factory.
    let syntheticChain: boolean | undefined;
    if(request.method==='POST') {
      const body=await request.json() as {root:string,jws:string};
      const offline=new SignedDataVerifier([Buffer.from(body.root,'base64')],false,Environment.PRODUCTION,'com.visarut.billngai',6789503350);
      const tx=await offline.verifyAndDecodeTransaction(body.jws);
      syntheticChain=tx.productId==='com.visarut.billngai.pro';
    }
    return Response.json({appleLibraryLoaded:true,rootSelfSignature:root.verify(root.publicKey),ecSignature:verify('SHA256',message,keys.publicKey,signature),fakeProofRejected:rejects,syntheticChain});
  }
};
