// Behavioral regression tests with a mocked StoreKit transport, never purchase evidence.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
const html=fs.readFileSync(path.join(root,'billing.html'),'utf8');
const id='com.visarut.billngai.pro';
function native(options={}){
  const handlers={},events={},finished=[],notifications=[];
  let cfg={},writes=0,calls=0;
  const context=vm.createContext({
    process:{mas:true},IS_MAS:true,CONFIG_PATH:'test-config',console:{error(){}},setTimeout,
    readConfig:async()=>structuredClone(cfg),
    atomicWrite:async(_p,text)=>{if(options.writeFails)throw Error('disk full');cfg=JSON.parse(text);writes++;},
    win:{isDestroyed:()=>false,webContents:{send:(_channel,status)=>notifications.push(status)}},
    handleIPC:(k,fn)=>handlers[k]=fn,withDataLock:fn=>fn(),
    inAppPurchase:{on:(k,fn)=>events[k]=fn,
      finishTransactionByDate:date=>finished.push(date),
      canMakePayments:()=>options.payments!==false,
      getProducts:async()=>options.products||[],
      purchaseProduct:async()=>{calls++;return options.accepted!==false;},
      restoreCompletedTransactions:()=>{} }
  });
  vm.runInContext(main.slice(main.indexOf('const IAP_PRO_ID ='),main.indexOf('/* ---------------- Google Drive Workspace Sync')),context);
  return {handlers,finished,notifications,get cfg(){return cfg},get writes(){return writes},get calls(){return calls},
    async emit(state,extra={}){events['transactions-updated']({},[{transactionState:state,transactionDate:'2026-09-06T00:00:00Z',payment:{productIdentifier:id},...extra}]);await vm.runInContext('iapTransactions',context);}};
}
test('StoreKit false return reports unavailable and never grants Pro',async()=>{
  const n=native({accepted:false});assert.equal(await n.handlers['iap:buy'](),false);
  assert.equal(n.notifications.at(-1).state,'unavailable');assert.equal(n.cfg.masPro,undefined);
});
test('queue acceptance does not grant, and repeated clicks do not duplicate requests',async()=>{
  const n=native();await n.handlers['iap:buy']();await n.handlers['iap:buy']();
  assert.equal(n.calls,1);assert.equal(n.cfg.masPro,undefined);
});
test('payments disabled prevents queueing',async()=>{
  const n=native({payments:false});await assert.rejects(n.handlers['iap:buy'](),/iap-payments-disabled/);assert.equal(n.calls,0);
});
test('purchase and restore persist before finishing and survive renderer absence via status',async()=>{
  const n=native();await n.emit('purchased');assert.equal(n.cfg.masPro.product,id);assert.equal(n.finished.length,1);
  assert.equal(n.handlers['iap:status']().state,'purchased');
  await n.emit('restored');assert.equal(n.writes,1);assert.equal(n.handlers['iap:status']().state,'restored');
});
test('disk failure leaves transaction unfinished for redelivery',async()=>{
  const n=native({writeFails:true});await n.emit('purchased');
  assert.equal(n.finished.length,0);assert.equal(n.notifications.at(-1).state,'save-failed');assert.equal(n.cfg.masPro,undefined);
});
test('cancel, failure, and deferred states reach renderer without granting Pro',async()=>{
  const n=native();await n.emit('failed',{errorCode:2});assert.equal(n.notifications.at(-1).state,'cancelled');
  await n.emit('failed',{errorCode:0});assert.equal(n.notifications.at(-1).state,'failed');
  await n.emit('deferred');assert.equal(n.notifications.at(-1).state,'deferred');
  assert.equal(await n.handlers['iap:buy'](),false);assert.equal(n.cfg.masPro,undefined);
});
test('unrelated transactions and product results cannot unlock Pro',async()=>{
  const n=native({products:[{productIdentifier:'other'},{productIdentifier:id,formattedPrice:'$19.99'}]});
  await n.emit('purchased',{payment:{productIdentifier:'other'}});assert.equal(n.writes,0);assert.equal(n.finished.length,0);
  const products=await n.handlers['iap:products']();assert.equal(products.length,1);assert.equal(products[0].id,id);
});
test('MAS cannot become Pro from a direct-channel key',()=>{
  const c=vm.createContext({IS_MAS:true,parseLicenseKey:()=>({email:'test',plan:'pro'}),Date});
  vm.runInContext(main.slice(main.indexOf('function licenseStatusOf'),main.indexOf("handleIPC('license:status'")),c);
  assert.equal(vm.runInContext("licenseStatusOf({licenseKey:'valid-direct-key'}).valid",c),false);
});
function renderer(options={}){
  const nodes=Object.fromEntries(['iapBuyBtn','iapRestoreBtn','iapPrice','iapStatus'].map(k=>[k,{disabled:false,textContent:''}]));
  let timer,buyCalls=0,owned=false;
  const c=vm.createContext({document:{getElementById:k=>nodes[k]},
    window:{billingAPI:{iapProducts:async()=>options.products??[{id,price:'฿599.00'}],
      iapBuy:async()=>{buyCalls++;return options.accepted!==false;},iapRestore:async()=>true,
      licenseStatus:async()=>({valid:owned})}},
    PRO:{valid:false},isPro:()=>owned,tr:s=>s,ic:()=>'',refreshSyncInfo:async()=>{},render(){},toast(){},
    setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{timer=null;}});
  const start=html.indexOf('let iapBusy=false;'),end=html.indexOf('\nasync function activateLicense()',start);
  vm.runInContext(html.slice(start,end),c);
  return {c,nodes,run:src=>vm.runInContext(src,c),get calls(){return buyCalls},timeout:()=>timer(),own:()=>owned=true};
}
test('empty or unrelated product disables Buy and offers truthful feedback',async()=>{
  const r=renderer({products:[{id:'other',price:'$1'}]});await r.run('loadIapPrice()');
  assert.equal(r.nodes.iapBuyBtn.disabled,true);await r.run('iapBuyPro()');assert.equal(r.calls,0);
  assert.match(r.nodes.iapPrice.textContent,/โหลดสินค้าไม่ได้/);
});
test('false queue response never shows purchase-started success',async()=>{
  const r=renderer({accepted:false});await r.run('loadIapPrice()');await r.run('iapBuyPro()');
  assert.match(r.nodes.iapStatus.textContent,/ยังเริ่มการซื้อไม่ได้/);assert.equal(r.nodes.iapBuyBtn.disabled,false);
});
test('pending purchase locks Buy through modal lifecycle; cancellation unlocks it',async()=>{
  const r=renderer();await r.run('loadIapPrice()');await r.run('iapBuyPro()');
  await r.run('loadIapPrice()');assert.equal(r.nodes.iapBuyBtn.disabled,true);
  await r.run("handleIapChanged({state:'cancelled'})");assert.equal(r.nodes.iapBuyBtn.disabled,false);
});
test('restore timeout cannot claim an account has no purchase',async()=>{
  const r=renderer();await r.run('iapRestorePro()');r.timeout();
  assert.match(r.nodes.iapStatus.textContent,/ยังไม่ได้รับผลกู้คืน/);
  assert.doesNotMatch(r.nodes.iapStatus.textContent,/ไม่พบการซื้อ/);
});
test('restored owner gets confirmation and cannot buy again',async()=>{
  const r=renderer();await r.run('loadIapPrice()');r.own();
  await r.run("handleIapChanged({state:'restored'})");assert.equal(r.nodes.iapBuyBtn.disabled,true);
  assert.equal(r.nodes.iapStatus.textContent,'กู้คืนการซื้อแล้ว');
});
test('slower old product response cannot overwrite a newer successful retry',async()=>{
  const r=renderer();let first; r.c.window.billingAPI.iapProducts=()=>new Promise(resolve=>first=resolve);
  const old=r.run('loadIapPrice()');r.c.window.billingAPI.iapProducts=async()=>[{id,price:'$20'}];
  await r.run('loadIapPrice()');first([]);await old;
  assert.match(r.nodes.iapPrice.textContent,/\$20/);assert.equal(r.nodes.iapBuyBtn.disabled,false);
});
