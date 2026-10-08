import { verifyAppStoreProof } from './appstore';
import { createAppleDependencies, verifyStoreKit2 } from './storekit2';
import { EntitlementError } from './entitlement-errors';
import { parseGoogleClients, verifyGoogleToken } from './google-clients';
import { Buffer } from 'node:buffer';
import {createHash} from 'node:crypto';
import {verifyDirectGrant,hasWorkspaceAccess,type WorkspaceGrant} from './grants';
import appleRoot from './AppleRootCA-G3.cer';
import { DurableObject } from 'cloudflare:workers';
import { createRemoteJWKSet } from 'jose';
import { canonical, identifier, recordKey, number, need, ProtocolError, validateCommit, type Commit } from './protocol';

type Head = { key: string; revision: number; hash: string; file: string; sealed: string | null; number: string | null };
type CommitResult = {ok:true;sequence:number;changes:(Commit['changes'][number]&{revision:number})[]} | {ok:false;conflicts:Head[]};
type StoredOperation = { request: string; result: string };
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class Workspace extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS heads (key TEXT PRIMARY KEY, revision INTEGER NOT NULL, hash TEXT NOT NULL, file TEXT NOT NULL, sealed TEXT, number TEXT);
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, request TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS changes (seq INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS numbers (number TEXT PRIMARY KEY, owner TEXT NOT NULL, reservation TEXT);
      CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, request TEXT NOT NULL, number TEXT NOT NULL, owner TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counters (series TEXT PRIMARY KEY, value INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS claims (claim TEXT PRIMARY KEY, owner TEXT NOT NULL);
    `);
  }
  request(action: string, input: unknown, clientProtocol = 3): {status:number;data:unknown} {
    try {
      let data:unknown;
      if(['upgradeProtocol','status','pull','initialize','reserve','commit'].includes(action)) {
        need(Number.isInteger(clientProtocol) && [3,4].includes(clientProtocol),'SYNC_PROTOCOL_UNSUPPORTED',409);
        const minimum=Number(this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','minProtocol').toArray()[0]?.value||3);
        need(clientProtocol>=minimum,'SYNC_CLIENT_UPGRADE_REQUIRED',409);
      }
      if(action==='upgradeProtocol') {
        need(clientProtocol===4,'SYNC_CLIENT_UPGRADE_REQUIRED',409);
        need(input && typeof input==='object' && Object.keys(input).length===1 && (input as {protocol?:number}).protocol===4,'SYNC_PROTOCOL_UNSUPPORTED',409);
        data=this.ctx.storage.transactionSync(()=>{
          this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','minProtocol','4');
          return this.status();
        });
      }
      else if(action==='status') data=this.status();
      else if(action==='pull') data=this.pull(input as number);
      else if(action==='initialize') data=this.initialize(input);
      else if(action==='reserve') data=this.reserve(input);
      else if(action==='commit') data=this.commit(input);
      else if(action==='beginAppStoreVerification') data=this.beginAppStoreVerification();
      else if(action==='grantAppStore') data=this.grantAppStore(input);
      else if(action==='appStoreAccess') data=this.appStoreAccess(input);
      else if(action==='grantDirect') data=this.grantDirect(input);
      else if(action==='claimLicense') data=this.claimLicense(input);
      else throw new ProtocolError('NOT_FOUND',404);
      return {status:200,data};
    } catch(error) {
      if(error instanceof ProtocolError) return {status:error.status,data:{error:error.code}};
      return {status:500,data:{error:'SERVICE_ERROR'}};
    }
  }
  private ready() { need(this.ctx.storage.sql.exec('SELECT value FROM metadata WHERE key = ?', 'root').toArray().length, 'WORKSPACE_NOT_INITIALIZED', 409); }
  status() {
    const root = this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key = ?', 'root').toArray()[0]?.value || null;
    return { protocol: 3, capability: 4, minProtocol: Number(this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','minProtocol').toArray()[0]?.value||3), root, sequence: this.ctx.storage.sql.exec<{seq:number}>('SELECT COALESCE(MAX(seq),0) AS seq FROM changes').one().seq };
  }
  // Bootstrap is a single atomic transaction. No partial workspace becomes visible.
  initialize(input: unknown): CommitResult {
    need(input && typeof input === 'object', 'INVALID_INITIALIZATION');
    const v = input as {root:string; commit:Commit; counterFloors?:Record<string,number>};
    need(Object.keys(v).every(k=>['root','commit','counterFloors'].includes(k)),'UNKNOWN_INITIALIZATION_FIELD');
    need(identifier(v.root), 'INVALID_ROOT'); validateCommit(v.commit, 4096);
    need(!v.counterFloors||(typeof v.counterFloors==='object'&&!Array.isArray(v.counterFloors)&&Object.entries(v.counterFloors).length<=512&&Object.entries(v.counterFloors).every(([k,n])=>/^[a-z_]+-[0-9]{4}$/.test(k)&&Number.isSafeInteger(n)&&n>=0&&n<1000000000)),'INVALID_COUNTER_FLOORS');
    need(v.commit.changes.every(c => c.base === 0 && !c.reservation), 'INVALID_INITIALIZATION');
    return this.ctx.storage.transactionSync(() => {
      const st = this.status();
      if (st.root) {
        const previous = this.ctx.storage.sql.exec<StoredOperation>('SELECT request,result FROM operations WHERE id=?',v.commit.operation).toArray()[0];
        need(st.root === v.root && previous?.request === canonical(v.commit) && this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','initialization').toArray()[0]?.value===canonical(v), 'WORKSPACE_EXISTS',409);
        return JSON.parse(previous.result);
      }
      this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES (?,?)','root',v.root);
      this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES (?,?)','initialization',canonical(v));
      for(const [series,value] of Object.entries(v.counterFloors||{}))this.ctx.storage.sql.exec('INSERT INTO counters(series,value) VALUES(?,?)',series,value);
      return this.apply(v.commit,true);
    });
  }
  reserve(input: unknown) {
    need(input && typeof input === 'object','INVALID_RESERVATION');
    const v = input as {operation:string; key:string; prefix:string; suffix:string; width:number; series?:string};
    need(Object.keys(v).every(k=>['operation','key','prefix','suffix','width','series'].includes(k)),'UNKNOWN_RESERVATION_FIELD');
    need(identifier(v.operation) && recordKey(v.key), 'INVALID_RESERVATION');
    need(v.series===undefined||(typeof v.series==='string'&&/^[a-z_]+-[0-9]{4}$/.test(v.series)),'INVALID_SERIES');
    need(typeof v.prefix === 'string' && typeof v.suffix === 'string' && v.prefix.length+v.suffix.length <= 64 && !/[\x00-\x1f]/.test(v.prefix+v.suffix), 'INVALID_FORMAT');
    need(Number.isSafeInteger(v.width) && v.width>=1 && v.width<=9, 'INVALID_FORMAT');
    return this.ctx.storage.transactionSync(() => {
      this.ready();
      const previous = this.ctx.storage.sql.exec<{request:string;number:string}>('SELECT request,number FROM reservations WHERE id=?',v.operation).toArray()[0];
      if (previous) { need(previous.request === canonical(v),'OPERATION_REUSED',409); return {number:previous.number, reservation:v.operation}; }
      const head = this.ctx.storage.sql.exec<Head>('SELECT * FROM heads WHERE key=?',v.key).toArray()[0];
      need(!head?.sealed,'ALREADY_ISSUED',409);
      const series = v.series || canonical([v.prefix,v.suffix]);
      let n = this.ctx.storage.sql.exec<{value:number}>('SELECT value FROM counters WHERE series=?',series).toArray()[0]?.value || 0;
      let candidate='';
      // Existing imported numbers (including voided papers) remain reserved forever.
      for (let i=0;i<100000;i++) {
        n++; need(Number.isSafeInteger(n),'NUMBER_EXHAUSTED',409);
        candidate=v.prefix+String(n).padStart(v.width,'0')+v.suffix;
        if (!this.ctx.storage.sql.exec('SELECT 1 FROM numbers WHERE number=?',candidate).toArray().length) break;
        candidate='';
      }
      need(candidate,'NUMBER_EXHAUSTED',409);
      this.ctx.storage.sql.exec('INSERT INTO counters(series,value) VALUES(?,?) ON CONFLICT(series) DO UPDATE SET value=excluded.value',series,n);
      this.ctx.storage.sql.exec('INSERT INTO numbers(number,owner,reservation) VALUES(?,?,?)',candidate,v.key,v.operation);
      this.ctx.storage.sql.exec('INSERT INTO reservations(id,request,number,owner) VALUES(?,?,?,?)',v.operation,canonical(v),candidate,v.key);
      return {number:candidate,reservation:v.operation};
    });
  }
  commit(input: unknown): CommitResult {
    validateCommit(input);
    return this.ctx.storage.transactionSync(() => { this.ready(); return this.apply(input,false); });
  }
  private apply(input: Commit, bootstrap: boolean): CommitResult {
    const sql=this.ctx.storage.sql;
    const previous=sql.exec<StoredOperation>('SELECT request,result FROM operations WHERE id=?',input.operation).toArray()[0];
    if(previous){ need(previous.request===canonical(input),'OPERATION_REUSED',409); return JSON.parse(previous.result); }
    const conflicts: Head[]=[];
    for(const c of input.changes){
      const old=sql.exec<Head>('SELECT * FROM heads WHERE key=?',c.key).toArray()[0];
      if((old?.revision||0)!==c.base){conflicts.push(old||{key:c.key,revision:0,hash:'',file:'',sealed:null,number:null});continue;}
      need(!old?.sealed || (c.sealedHash===old.sealed && (c.number||null)===old.number),'ISSUED_FACTS_IMMUTABLE',409);
      need(!old || !c.key.startsWith('reviewEvent:') || old.hash===c.hash,'REVIEW_EVENT_IMMUTABLE',409);
      // A stored image is named by its content: the same key can never carry different content.
      need(!old || !c.key.startsWith('asset:') || old.hash===c.hash,'ASSET_IMMUTABLE',409);
      if(c.number){
        const held=sql.exec<{owner:string;reservation:string|null}>('SELECT owner,reservation FROM numbers WHERE number=?',c.number).toArray()[0];
        need(bootstrap ? !held || held.owner===c.key : held?.owner===c.key,'NUMBER_NOT_RESERVED',409);
        if(!bootstrap && !old?.sealed) need(held?.reservation===c.reservation,'NUMBER_NOT_RESERVED',409);
      }
      for(const claim of c.claims||[]){
        const owner=sql.exec<{owner:string}>('SELECT owner FROM claims WHERE claim=?',claim).toArray()[0]?.owner;
        need(!owner || owner===c.key,'FACT_ALREADY_RECORDED',409);
      }
    }
    if(conflicts.length) return {ok:false,conflicts}; // No partial effects or cached failure; resolution uses a new operation.
    for(const c of input.changes){
      if(c.number && bootstrap) sql.exec('INSERT OR IGNORE INTO numbers(number,owner,reservation) VALUES(?,?,NULL)',c.number,c.key);
      // Recheck intra-batch claims/numbers after each insert; transaction rolls back on duplicate.
      if(c.number) need(sql.exec<{owner:string}>('SELECT owner FROM numbers WHERE number=?',c.number).one().owner===c.key,'DUPLICATE_NUMBER',409);
      for(const claim of c.claims||[]){
        sql.exec('INSERT OR IGNORE INTO claims(claim,owner) VALUES(?,?)',claim,c.key);
        need(sql.exec<{owner:string}>('SELECT owner FROM claims WHERE claim=?',claim).one().owner===c.key,'FACT_ALREADY_RECORDED',409);
      }
      sql.exec('INSERT INTO heads(key,revision,hash,file,sealed,number) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,hash=excluded.hash,file=excluded.file,sealed=excluded.sealed,number=excluded.number',c.key,c.base+1,c.hash,c.file,c.sealedHash||null,c.number||null);
    }
    const committed=input.changes.map(c=>({...c,revision:c.base+1}));
    sql.exec('INSERT INTO changes(operation,payload) VALUES(?,?)',input.operation,JSON.stringify(committed));
    const seq=sql.exec<{seq:number}>('SELECT last_insert_rowid() AS seq').one().seq;
    const result:CommitResult={ok:true,sequence:seq,changes:committed};
    sql.exec('INSERT INTO operations(id,request,result) VALUES(?,?,?)',input.operation,canonical(input),JSON.stringify(result));
    return result;
  }
  beginAppStoreVerification() {
    return this.ctx.storage.transactionSync(()=>{
      const now=Date.now(),raw=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','apple-verification-rate').toArray()[0]?.value;
      const rate=raw?JSON.parse(raw):{start:now,count:0};
      if(now-rate.start>=600000){rate.start=now;rate.count=0;}
      need(rate.count<10,'APPSTORE_VERIFICATION_RATE_LIMIT',429);rate.count++;
      this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','apple-verification-rate',JSON.stringify(rate));
      return {ok:true};
    });
  }
  grantAppStore(input:unknown) {
    const v=input as WorkspaceGrant;
    const ttl=v?.verifier==='apple-sk2-v1'?3600000:86400000;
    need(v && v.source==='apple' && ['apple-sk2-v1','apple-receipt-v1'].includes(v.verifier) && /^[a-f0-9]{64}$/.test(v.purchase) && ['Production','Sandbox'].includes(v.environment||'') && Number.isSafeInteger(v.verifiedAt) && v.verifiedAt>0 && v.verifiedAt<=Date.now()+60000 && v.until!==null && Number.isSafeInteger(v.until) && v.until>Date.now() && v.until<=v.verifiedAt+ttl,'APPSTORE_RECEIPT_INVALID');
    this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','appstore',JSON.stringify(v));
    return {ok:true};
  }
  grantDirect(input:unknown) {
    const v=input as WorkspaceGrant;
    need(v && v.source==='direct' && /^[a-f0-9]{64}$/.test(v.purchase) && /^[a-f0-9]{64}$/.test(v.verifier) && Number.isSafeInteger(v.verifiedAt) && v.verifiedAt>0 && v.verifiedAt<=Date.now()+60000 && (v.until===null||(Number.isSafeInteger(v.until)&&v.until>Date.now())),'PRO_REQUIRED',403);
    this.ctx.storage.sql.exec('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','direct-grant',JSON.stringify(v));
    return {ok:true};
  }
  appStoreAccess(input?:unknown) {
    const v=input as {subject:string;directVerifier:string;revoked:string[];sandbox:string[]};
    need(v && identifier(v.subject) && typeof v.directVerifier==='string' && (v.directVerifier===''||/^[a-f0-9]{64}$/.test(v.directVerifier)) && Array.isArray(v.revoked) && v.revoked.every(h=>/^[a-f0-9]{64}$/.test(h)) && Array.isArray(v.sandbox) && v.sandbox.every(s=>identifier(s)),'INVALID_ACCESS_POLICY');
    const subject=v.subject;
    const policy={directVerifier:v.directVerifier,appleVerifier:'apple-sk2-v1',revokedPurchases:new Set(v.revoked),sandboxSubjects:new Set(v.sandbox)};
    const direct=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','direct-grant').toArray()[0]?.value;
    if(direct&&hasWorkspaceAccess([JSON.parse(direct)],subject,policy))return {valid:true,source:'direct'};
    const raw=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM metadata WHERE key=?','appstore').toArray()[0]?.value;
    if(!raw)return {valid:false};
    const apple=JSON.parse(raw) as WorkspaceGrant;
    // Old grants without verified environment/provenance need fresh proof; billing data is unchanged.
    const verifier=['apple-sk2-v1','apple-receipt-v1'].includes(apple.verifier)?apple.verifier:'apple-sk2-v1';
    return {valid:hasWorkspaceAccess([apple],subject,{...policy,appleVerifier:verifier}),source:'apple'};
  }
  // Stored in the object named 'license:<hash>': which Google accounts have used one Pro key.
  claimLicense(input: unknown) {
    const v = input as {subject:string; max:number};
    need(v && identifier(v.subject) && Number.isSafeInteger(v.max) && v.max>=1 && v.max<=20, 'INVALID_LICENSE_CLAIM');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS license_subjects (subject TEXT PRIMARY KEY, first_seen TEXT NOT NULL)');
    return this.ctx.storage.transactionSync(() => {
      if (this.ctx.storage.sql.exec('SELECT subject FROM license_subjects WHERE subject=?', v.subject).toArray().length) return {ok:true};
      const used = this.ctx.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM license_subjects').one().n;
      need(used < v.max, 'LICENSE_ACCOUNT_LIMIT', 403);
      this.ctx.storage.sql.exec('INSERT INTO license_subjects(subject,first_seen) VALUES (?,?)', v.subject, new Date().toISOString());
      return {ok:true};
    });
  }
  pull(after: number) {
    need(Number.isSafeInteger(after) && after>=0,'INVALID_CURSOR'); this.ready();
    need(after<=this.status().sequence,'CURSOR_AHEAD',409);
    const rows=this.ctx.storage.sql.exec<{seq:number;operation:string;payload:string}>('SELECT seq,operation,payload FROM changes WHERE seq>? ORDER BY seq LIMIT 32',after).toArray();
    // Keep a page well inside the clients' 16 MiB response bound. A transaction is never split.
    let size=0; const page=rows.filter((r,i)=>(size+=r.payload.length)<=8*1024*1024||i===0);
    return {transactions:page.map(r=>({sequence:r.seq,operation:r.operation,changes:JSON.parse(r.payload)})),cursor:page.at(-1)?.seq||after};
  }
}

// BillNgai Pro keys are `base64(payload).base64(signature)`, Ed25519 over the canonical
// payload — the same offline check the app does. The key itself is never stored; only its hash.
async function verifiedLicense(key:string,env:Env):Promise<WorkspaceGrant|null>{
  if(!env.LICENSE_PUBLIC_KEY)return null;
  try{return await verifyDirectGrant(key,env.LICENSE_PUBLIC_KEY);}catch{return null;}
}
function accessPolicy(subject:string,env:Env){
  const der=Buffer.from(String(env.LICENSE_PUBLIC_KEY||'').replace(/-----[A-Z ]+-----/g,'').replace(/\s+/g,''),'base64');
  return {subject,directVerifier:der.length?createHash('sha256').update(der).digest('hex'):'',revoked:String(env.REVOKED_PURCHASES||'').split(',').map(s=>s.trim()).filter(Boolean),sandbox:String(env.APPSTORE_SANDBOX_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean)};
}
async function limitedJSON(request: Request, max = 524288): Promise<unknown> {
  need(request.headers.get('content-type')?.split(';')[0]==='application/json','CONTENT_TYPE',415);
  need(request.body,'EMPTY_BODY');
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ProtocolError('REQUEST_TOO_LARGE',413);}chunks.push(value);} }
  finally{reader.releaseLock();}
  const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{throw new ProtocolError('INVALID_JSON');}
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Deny by default: an OAuth audience plus either a Pro licence key or an explicit allow-list.
      need((env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENTS) && (env.ALLOWED_SUBJECTS || env.LICENSE_PUBLIC_KEY || env.APPSTORE_BUNDLE_ID),'SERVICE_NOT_CONFIGURED',503);
      const auth=request.headers.get('authorization')||'';
      need(auth.startsWith('Bearer ') && auth.length<8192,'UNAUTHORIZED',401);
      const expected=request.headers.get('X-BillNgai-Account');
      // An explicit per-audience map deliberately overrides the legacy self-pair.
      const clients={...(env.GOOGLE_CLIENT_ID?parseGoogleClients(JSON.stringify({[env.GOOGLE_CLIENT_ID]:[env.GOOGLE_CLIENT_ID]})):{}),...(env.GOOGLE_CLIENTS?parseGoogleClients(env.GOOGLE_CLIENTS):{})};
      const subject=await verifyGoogleToken(auth.slice(7),clients,googleKeys,expected||undefined);
      const url=new URL(request.url);
      const appStore=env.WORKSPACES.getByName('appstore:'+subject);
      if(request.method==='POST' && url.pathname==='/v3/appstore-entitlement'){
        need(env.APPSTORE_BUNDLE_ID && env.APPSTORE_PRODUCT_ID,'APPSTORE_NOT_CONFIGURED',503);
        const input=await limitedJSON(request) as {receipt?:unknown;signedTransaction?:unknown};
        need(input && typeof input==='object' && !Array.isArray(input) && Object.keys(input).length===1 && (Object.hasOwn(input,'receipt')||Object.hasOwn(input,'signedTransaction')),'APPSTORE_RECEIPT_INVALID');
        const attempt:{status:number;data:unknown}=await appStore.request('beginAppStoreVerification',null);
        if(attempt.status!==200)throw new ProtocolError((attempt.data as {error?:string}|null)?.error||'APPSTORE_VERIFICATION_RATE_LIMIT',attempt.status);
        const allowSandbox=String(env.APPSTORE_SANDBOX_SUBJECTS||'').split(',').map(s=>s.trim()).includes(subject);
        let proof:WorkspaceGrant;
        if(Object.hasOwn(input,'signedTransaction')){
          const config={bundleId:env.APPSTORE_BUNDLE_ID,productId:env.APPSTORE_PRODUCT_ID,appAppleId:Number(env.APPSTORE_APP_ID),roots:[Buffer.from(appleRoot)],sandboxSubjects:String(env.APPSTORE_SANDBOX_SUBJECTS||'').split(',').map(s=>s.trim()),api:{signingKey:env.APPSTORE_SIGNING_KEY,keyId:env.APPSTORE_KEY_ID,issuerId:env.APPSTORE_ISSUER_ID}};
          const verified=await verifyStoreKit2(input,subject,config,await createAppleDependencies(config));
          proof={source:'apple',purchase:verified.purchase,environment:verified.environment,verifiedAt:verified.checkedAt,until:verified.until,verifier:'apple-sk2-v1'};
        }else proof={source:'apple',...await verifyAppStoreProof(input.receipt,env.APPSTORE_BUNDLE_ID,env.APPSTORE_PRODUCT_ID,allowSandbox)};
        const purchase=proof.purchase;
        need(!accessPolicy(subject,env).revoked.includes(purchase),'PRO_REQUIRED',403);
        const claim:{status:number;data:unknown}=await env.WORKSPACES.getByName('appstore-purchase:'+purchase).request('claimLicense',{subject,max:Number(env.MAX_ACCOUNTS_PER_LICENSE||3)});
        if(claim.status!==200)throw new ProtocolError((claim.data as {error?:string}|null)?.error||'LICENSE_ACCOUNT_LIMIT',claim.status);
        const grant:{status:number;data:unknown}=await appStore.request('grantAppStore',proof);
        // Claim is idempotent per verified subject: retry safely if storage fails.
        need(grant.status===200,'APPSTORE_GRANT_UNAVAILABLE',503);
        return Response.json(grant.data,{status:grant.status,headers:{'Cache-Control':'no-store'}});
      }
      if(!String(env.ALLOWED_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(subject)){
        const license=await verifiedLicense(request.headers.get('X-BillNgai-License')||'',env);
        if(license){
          const claim:{status:number;data:unknown}=await env.WORKSPACES.getByName('license:'+license.purchase).request('claimLicense',{subject,max:Number(env.MAX_ACCOUNTS_PER_LICENSE||3)});
          if(claim.status!==200)throw new ProtocolError((claim.data as {error?:string}|null)?.error||'LICENSE_ACCOUNT_LIMIT',claim.status);
          need(!accessPolicy(subject,env).revoked.includes(license.purchase),'PRO_REQUIRED',403);
          const saved:{status:number;data:unknown}=await appStore.request('grantDirect',license);
          if(saved.status!==200)throw new ProtocolError('PRO_REQUIRED',403);
        }else{
          const grant:{status:number;data:unknown}=await appStore.request('appStoreAccess',accessPolicy(subject,env));
          if(!(grant?.data as {valid?:boolean}|null)?.valid){
            if(env.LOG_REJECTED_SUBJECT==='1')console.log(JSON.stringify({rejectedSubject:subject}));
            throw new ProtocolError(env.LICENSE_PUBLIC_KEY||env.APPSTORE_BUNDLE_ID?'PRO_REQUIRED':'ACCOUNT_NOT_ENABLED',403);
          }
        }
      }
      const stub=env.WORKSPACES.getByName('v3:'+subject);
      let result:{status:number;data:unknown};
      const protocolHeader=request.headers.get('X-BillNgai-Protocol');
      need(protocolHeader===null||['3','4'].includes(protocolHeader),'SYNC_PROTOCOL_UNSUPPORTED',409);
      const clientProtocol=Number(protocolHeader||3);
      if(request.method==='GET' && url.pathname==='/v3/status') result=await stub.request('status',null,clientProtocol);
      else if(request.method==='GET' && url.pathname==='/v3/pull') result=await stub.request('pull',Number(url.searchParams.get('after')||'0'),clientProtocol);
      else if(request.method==='POST' && url.pathname==='/v3/protocol/upgrade') result=await stub.request('upgradeProtocol',await limitedJSON(request),clientProtocol);
      else if(request.method==='POST' && ['/v3/initialize','/v3/reserve','/v3/commit'].includes(url.pathname)) {
        // Only the one-time atomic initialization may be larger; it must stay inside a 2 MB storage row.
        result=await stub.request(url.pathname.slice(4),await limitedJSON(request,url.pathname==='/v3/initialize'?819200:524288),clientProtocol);
      }else throw new ProtocolError('NOT_FOUND',404);
      if(url.pathname==='/v3/status' && result.status===200) result.data={...(result.data as object),account:subject};
      return Response.json(result.data,{status:result.status,headers:{'Cache-Control':'no-store'}});
    }catch(e){
      const known=e instanceof ProtocolError || e instanceof EntitlementError;
      return Response.json({error:known?e.code:'SERVICE_ERROR'},{status:known?e.status:500,headers:{'Cache-Control':'no-store'}});
    }
  }
} satisfies ExportedHandler<Env>;
