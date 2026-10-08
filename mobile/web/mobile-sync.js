'use strict';
// Same desktop core. All calls are serialized by mobile-bridge; records, cursor,
// conflicts and uncertain operations are committed in the same native SQLite payload.
(()=>{
 const create=(native,io)=>{
  const {S,B,BillingSyncController}=window.BillNgaiSyncCore;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=async()=>{const text=await io.read();if(!text)throw Error('DATA_NOT_INITIALIZED');const db=JSON.parse(text);validate(db);return db;};
  function validate(db,checkProjection=true){
   window.BillingData.validate(db,{strictLiveDocuments:true});
   B.flatten(db);
   if(db.syncV3){
    S.validate(db.syncV3);const visible=clone(db.syncV3);
    for(const [key,intent] of Object.entries(visible.intents||{})){if(intent.present)visible.records[key]=intent.before;else delete visible.records[key];}
    if(checkProjection&&S.canonical(B.flatten(db))!==S.canonical(B.flatten(B.project(db,visible))))throw Error('SYNC_LOCAL_STATE_MISMATCH');
   }
  }
  const write=async db=>{validate(db);await io.write(JSON.stringify(db),true);};
  let refreshing;
  const call=async(action,body={},account)=>{
   const request={action,body,...(account?{account}:{})};
   try{return await native.syncRequest(request);}catch(error){
    if(error.message!=='PRO_REQUIRED'||!['status','pull','reserve','initialize','commit','protocol/upgrade'].includes(action))throw error;
    // Expired Apple leases need one native verified proof, including after join.
    // A failed proof/retry remains denied; Drive operations do not renew access.
    if(!refreshing)refreshing=Promise.resolve().then(()=>native.syncVerifyPro()).finally(()=>{refreshing=null;});
    await refreshing;return native.syncRequest(request);
   }
  };
  const transport=(state,approved)=>{
   const upgrade=async()=>{if(!approved)throw Error('SYNC_PROTOCOL_CONSENT_REQUIRED');let result;try{result=await call('protocol/upgrade',{protocol:4},state.account);}catch(error){if(String(error.message).includes('NOT_FOUND'))throw Error('SYNC_PROTOCOL_UPGRADE_REQUIRED');throw error;}
    if(result?.capability!==4||result?.minProtocol!==4)throw Error('SYNC_PROTOCOL_UPGRADE_REQUIRED');return result;};
   const gated=async(action,body)=>{await upgrade();return call(action,body,state.account);};
   return {
    upgradeProtocol:upgrade,
    status:()=>call('status',{},state.account),
    initialize:commit=>gated('initialize',{root:state.root,commit,counterFloors:state.counterFloors||{}}),
    reserve:request=>gated('reserve',request),
    commit:request=>gated(state.mode==='initializing'?'initialize':'commit',state.mode==='initializing'?{root:state.root,commit:request,counterFloors:state.counterFloors||{}}:request),
    pull:cursor=>gated('pull',{cursor}),
    upload:async record=>{const value=await gated('upload',{root:state.root,text:S.canonical(record),hash:S.digest(record)});if(!/^[A-Za-z0-9_-]{1,128}$/.test(value.id||''))throw Error('SYNC_INVALID_FILE_ID');return value.id;},
    download:file=>gated('download',{file})
   };
  };
  // Controller validates a proposed edit before updating its sync projection.
  // Persisted reads and writes still require exact projection agreement.
  const controller=async()=>{const db=await read();if(!db.syncV3)throw Error('SYNC_NOT_CONNECTED');return new BillingSyncController({account:db.syncV3.account,read,write,transport:transport(db.syncV3,db.meta.protocolUpgradeApproved===true),validateDatabase:next=>validate(next,false)});};
  async function status(){
   const cfg=await native.syncConfiguration();let db;try{db=await read();}catch(error){if(error.message!=='DATA_NOT_INITIALIZED')throw error;}
   const s=db?.syncV3;
   return {configured:!!cfg.configured,connected:!!s,protocolApproved:db?.meta?.protocolUpgradeApproved===true,mode:s?.mode||'',account:s?.account||'',conflicts:Object.entries(s?.conflicts||{}).map(([key,value])=>({key,...value})),pending:Object.keys(s?.intents||{}).length};
  }
  const online=()=>call('status');
  return {
   status,
   connect:async(options={})=>{
    if(!(await native.syncConfiguration()).configured)throw Error('SYNC_V3_NOT_CONFIGURED');
    const db=await read(),baseline=S.canonical(db);if(db.syncV3)throw Error('SYNC_ALREADY_CONNECTED');
    if(options.approveProtocol!==true)throw Error('SYNC_PROTOCOL_CONSENT_REQUIRED');db.meta.protocolUpgradeApproved=true;
    // The same count/byte preflight the first sync applies; throws SYNC_BOOTSTRAP_TOO_LARGE.
    const records=B.flatten(db);S.prepare({...S.initial('preflight'),mode:'initializing',root:'r'.repeat(128),records,counterFloors:B.counterFloors(db)},B.seal);
    await io.snapshot('before-sync-v3');await native.syncAuthorize();
    const remote=await online();if(remote.protocol!==3||!remote.account||!/^[A-Za-z0-9_-]{1,128}$/.test(remote.account))throw Error('SYNC_INVALID_WORKSPACE');
    const replace=!!remote.root&&['clients','documents','recurring','reviewEvents'].some(k=>db[k].length);
    if(replace&&options.replaceLocal!==true)throw Error('SYNC_JOIN_REQUIRES_EMPTY_PROFILE');
    let root=remote.root;
    if(root){const access=await call('inspect',{file:root},remote.account);if(access.id!==root||access.mimeType!=='application/vnd.google-apps.folder')throw Error('SYNC_DRIVE_ACCESS_REQUIRED');}
    else root=(await call('root',{},remote.account)).id;
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(root||''))throw Error('SYNC_INVALID_ROOT');
    // Detect an external write during authorization before adopting its workspace.
    if(S.canonical(await read())!==baseline)throw Error('DATA_CHANGED_ON_DISK');
    const state=S.initial(remote.account);state.root=root;state.mode=remote.root?'joining':'initializing';state.records=remote.root?{}:records;state.counterFloors=remote.root?{}:B.counterFloors(db);
    if(replace)Object.assign(db,{clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},assets:{}});
    db.syncV3=state;
    if(replace){validate(db);if(typeof io.adopt!=='function')throw Error('SYNC_ADOPTION_UNAVAILABLE');await io.adopt(JSON.stringify(db));}
    else await write(db);
    return status();
   },
   run:async(options={})=>{
    let db=await read();if(options.approveProtocol===true){db.meta.protocolUpgradeApproved=true;await write(db);}
    const c=await controller();
    if(db.syncV3.mode==='joining')await c.session().pull();else await c.sync();
    const next=await read();
    // A bounded pull may need another run: never enable issuance until caught up.
    const remote=await call('status',{},next.syncV3.account);
    if(remote.root!==next.syncV3.root)throw Error('SYNC_WORKSPACE_CHANGED');
    if(!next.syncV3.pending&&next.syncV3.cursor===remote.sequence){next.syncV3.mode='active';await write(next);}
    return {text:JSON.stringify(await read()),status:await status()};
   },
   save:async text=>{
    let db;try{db=await read();}catch(error){if(error.message!=='DATA_NOT_INITIALIZED')throw error;}
    if(!db?.syncV3){const next=JSON.parse(text);validate(next);if(next.syncV3)throw Error('SYNC_BINDING_REQUIRED');await io.write(text,false);return true;}
    if(db.syncV3.mode!=='active')throw Error('SYNC_SETUP_PENDING');
    const next=JSON.parse(text);
    if(next.syncV3?.cursor!==db.syncV3.cursor||S.canonical(next.syncV3?.heads||{})!==S.canonical(db.syncV3.heads))throw Error('SYNC_REFRESH_REQUIRED');
    return {text:JSON.stringify(await (await controller()).save(next))};
   },
   reserve:async(key,parts)=>{const db=await read();if(db.syncV3?.mode!=='active')throw Error('SYNC_SETUP_PENDING');return (await controller()).reserve(key,parts);},
   resolve:async(key,choice)=>({text:JSON.stringify(await (await controller()).resolve(key,choice)),status:await status()}),
   disconnect:async(options={})=>{
    const db=await read(),s=db.syncV3;
    if(s&&(s.pending||Object.keys(s.intents||{}).length||Object.keys(s.conflicts||{}).length||Object.entries(s.records).some(([key,value])=>S.digest(value)!==s.heads[key]?.hash)))throw Error('SYNC_DISCONNECT_PENDING');
    await io.snapshot('before-sync-disconnect');delete db.syncV3;await write(db);await native.syncDisconnectCredentials();return {text:JSON.stringify(db),status:await status()};
   },
   cloudReady:async()=>{try{if(!(await native.syncConfiguration()).configured)return false;const result=await call('status');return result.protocol===3;}catch{return false;}}
  };
 };
 window.BillNgaiMobileSync={create};
})();
