const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function harness(){
 const store=new Map(),clips=[],messages=[];
 function element(){return {textContent:'',innerHTML:'',checked:false,isConnected:true,setAttribute(k,v){this[k]=v;},addEventListener(){},classList:{add(){},remove(){}},closest(){return null;}};}
 const elements=new Map();
 class Clip{
  constructor(src){this.src=src;this.currentTime=0;this.listeners={};clips.push(this);}
  play(){this.paused=false;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
  pause(){this.paused=true;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  removeEventListener(k,fn){if(this.listeners[k]===fn)delete this.listeners[k];}
 }
 const ctx=vm.createContext({Audio:Clip,window:{addEventListener(){},matchMedia(){return {matches:false};}},document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},addEventListener(){}},navigator:{platform:'Test'},confirm(){return true;},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},localStorage:{getItem(k){return store.get(k)||null;},setItem(k,v){store.set(k,v);}}});
 vm.runInContext(script,ctx);vm.runInContext(`DB=blankDB();toast=(msg,kind,action,outcome)=>messages.push({msg,kind,outcome});`,Object.assign(ctx,{messages}));
 return {ctx,run:s=>vm.runInContext(s,ctx),clips,store,messages,element};
}

function workflow(h){h.run(`DEVICE_ID='motion-test';Object.assign(DB.business,{businessName:'Synthetic seller',address:'Sample',taxId:'1234567890123',vatStatus:'non_registered'});DB.clients=[{id:'client',name:'Synthetic buyer',address:'Sample'}];render=()=>{};viewDoc=()=>{};closeModal=()=>{};playAppSfx=()=>{};persist=async()=>true;
function fixture(extra={}){return {id:null,type:'invoice',number:null,clientId:'client',issueDate:todayISO(),paidDate:null,status:'draft',currency:'THB',vatRate:0,whtRate:0,whtReviewed:true,items:[{description:'Synthetic work',qty:1,price:1000}],...extra};}`);}
test('document and payment outcome artwork waits for persistence and stays absent on failure',async()=>{
 const h=harness();workflow(h);h.run(`editDoc=fixture();persist=()=>new Promise(resolve=>{finish=resolve});`);const saving=h.run('saveDraft()');await Promise.resolve();assert.equal(h.messages.length,0);h.run('finish(false)');await saving;assert.equal(h.messages.filter(m=>m.outcome).length,0);
 h.run('persist=async()=>true;editDoc=fixture()');await h.run('saveDraft()');assert.equal(h.messages.at(-1).outcome,'saved');
 h.run('editDoc=fixture({issueConfirmed:true})');await h.run('saveDoc()');assert.equal(h.messages.at(-1).outcome,'issued');h.messages.length=0;
 await h.run("persist=async()=>false;setStatus(DB.documents[1].id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true})");assert.equal(h.messages.filter(m=>m.outcome).length,0);assert.equal(h.run('DB.documents[1].status'),'sent');
 await h.run("persist=async()=>true;setStatus(DB.documents[1].id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true})");assert.equal(h.messages.at(-1).outcome,'payment');h.messages.length=0;
 await h.run("setStatus(DB.documents[1].id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true})");assert.equal(h.messages.length,0,'duplicate action cannot repeat completion');
});
test('native export and backup outcomes require a confirmed file and ignore cancellation/errors',async()=>{
 const h=harness();workflow(h);h.run(`getViewingDocument=()=>({number:'Synthetic'});documentOutputBlocked=()=>false;applyPrintZoom=()=>{};clearPrintZoom=()=>{};window.billingAPI={exportPDF:async()=>null,exportData:async()=>null,snapshotBackup:async()=>null};loadBackupHistory=()=>{};`);
 for(const action of ['savePDF()','elExport()','makeManualSnapshot()'])await h.run(action);assert.equal(h.messages.filter(m=>m.outcome).length,0);
 h.run(`window.billingAPI.exportPDF=async()=>'/tmp/Synthetic.pdf';window.billingAPI.exportData=async()=>'/tmp/backup.json';window.billingAPI.snapshotBackup=async()=>'backup.json';`);
 await h.run('savePDF()');assert.equal(h.messages.at(-1).outcome,'export');await h.run('elExport()');assert.equal(h.messages.at(-1).outcome,'backup');await h.run('makeManualSnapshot()');assert.equal(h.messages.at(-1).outcome,'backup');h.messages.length=0;
 h.run(`window.billingAPI.exportPDF=async()=>{throw Error('disk full')};window.billingAPI.exportData=async()=>{throw Error('disk full')};window.billingAPI.snapshotBackup=async()=>{throw Error('disk full')};`);
 for(const action of ['savePDF()','elExport()','makeManualSnapshot()'])await h.run(action);assert.equal(h.messages.filter(m=>m.outcome).length,0);
 h.messages.length=0;h.run('persist=async()=>false;window.billingAPI.snapshotBackup=async()=>{throw Error("must not run")};');await h.run('makeManualSnapshot()');assert.equal(h.messages.length,0);
});
