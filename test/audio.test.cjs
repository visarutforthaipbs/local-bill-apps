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
 vm.runInContext(script,ctx);vm.runInContext(`DB=blankDB();toast=(msg,kind)=>messages.push({msg,kind});`,Object.assign(ctx,{messages}));
 return {ctx,run:s=>vm.runInContext(s,ctx),clips,store,messages,element};
}
test('effects default off; preference is local and playback errors cannot change financial records',async()=>{
 const h=harness(),before=h.run('JSON.stringify(DB)');
 assert.equal(h.run('sfxEnabled()'),false);h.run("playAppSfx('issued')");assert.equal(h.clips.length,0);
 h.run('setSfxEnabled(true)');assert.equal(h.run('sfxEnabled()'),true);assert.equal(h.run('JSON.stringify(DB)'),before);
 h.run("playAppSfx('issued')");assert.equal(h.clips.length,1);h.clips[0].reject(new Error('speaker unavailable'));await Promise.resolve();await Promise.resolve();
 assert.equal(h.run('JSON.stringify(DB)'),before);
 h.run('localStorage.getItem=()=>{throw Error("storage unavailable")};localStorage.setItem=()=>{throw Error("storage unavailable")};setSfxEnabled(true)');assert.equal(h.run('sfxEnabled()'),false);
});
test('explicit preview works while effects are off; unknown assets never start',()=>{
 const h=harness();h.run("playAppSfx('export',true);playAppSfx('unknown',true)");assert.equal(h.clips.length,1);assert.match(h.clips[0].src,/export-complete\.mp3$/);
});
test('voice playback is explicit, exclusive, and survives stale rejection/completion from prior clips',async()=>{
 const h=harness(),a=h.element(),b=h.element();h.ctx.a=a;h.ctx.b=b;
 h.run("renderAudioGuide('payment')");assert.equal(h.clips.length,0);
 h.run("toggleAudioGuide('payment',a)");const old=h.clips[0],ended=old.onended||old.listeners.ended;
 h.run("toggleAudioGuide('draft-issued',b)");assert.equal(old.paused,true);assert.equal(old.currentTime,0);
 old.reject(new Error('old cancelled playback'));if(ended)ended();await Promise.resolve();await Promise.resolve();
 assert.equal(b['aria-pressed'],'true');assert.equal(h.clips[1].paused,false);assert.equal(h.messages.length,0);
 h.run('setSfxEnabled(true);playAppSfx("issued")');assert.equal(h.clips.length,2,'effect must not interrupt voice');
 h.run('stopAppAudio()');assert.equal(h.clips[1].paused,true);assert.equal(b['aria-pressed'],'false');
});
test('guide can be stopped with its own button and English UI explicitly labels Thai speech',()=>{
 const h=harness();h.ctx.button=h.element();h.run("toggleAudioGuide('payment',button);toggleAudioGuide('payment',button)");assert.equal(h.clips[0].paused,true);
 const rendered=h.run("DB.business.uiLang='en';renderAudioGuide('payment')");assert.match(rendered,/Thai/);assert.match(rendered,/full payment/i);assert.doesNotMatch(rendered,/autoplay/);
});
test('draft saves stay quiet; failed issuance never plays completion; successful receipt creation is idempotent',async()=>{
 const h=harness();h.run(`DEVICE_ID='audio-test';Object.assign(DB.business,{businessName:'Synthetic seller',address:'Sample',taxId:'1234567890123',vatStatus:'non_registered'});DB.clients=[{id:'client',name:'Synthetic buyer',address:'Sample'}];
 cues=[];playAppSfx=key=>cues.push(key);render=()=>{};viewDoc=()=>{};closeModal=()=>{};persist=async()=>true;
 function fixture(extra={}){return {id:null,type:'invoice',number:null,clientId:'client',issueDate:todayISO(),paidDate:null,status:'draft',currency:'THB',vatRate:0,whtRate:0,whtReviewed:true,items:[{description:'Synthetic work',qty:1,price:1000}],...extra};}
 editDoc=fixture();`);
 await h.run('saveDraft()');assert.equal(h.run('cues.length'),0);
 await h.run('editDoc=fixture({issueConfirmed:true});persist=async()=>false;saveDoc()');assert.deepEqual(Array.from(h.run('cues')),['attention']);assert.ok(h.run('editDoc'));
 await h.run('cues=[];persist=async()=>true;saveDoc()');assert.deepEqual(Array.from(h.run('cues')),['issued']);
 await h.run("cues=[];setStatus(DB.documents[1].id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true})");assert.deepEqual(Array.from(h.run('cues')),['payment']);
 await h.run("createReceipt(DB.documents[1].id)");assert.deepEqual(Array.from(h.run('cues')),['payment','issued']);
 await h.run("createReceipt(DB.documents[1].id)");assert.deepEqual(Array.from(h.run('cues')),['payment','issued']);
});
test('PDF cancellation is silent, export success cues once, and export failure never sounds successful',async()=>{
 const h=harness();h.run(`cues=[];playAppSfx=k=>cues.push(k);getViewingDocument=()=>({number:'Synthetic'});documentOutputBlocked=()=>false;applyPrintZoom=()=>{};clearPrintZoom=()=>{};window.billingAPI={exportPDF:async()=>null};`);
 await h.run('savePDF()');assert.equal(h.run('cues.length'),0);
 await h.run("window.billingAPI.exportPDF=async()=>'/tmp/Synthetic.pdf';savePDF()");assert.deepEqual(Array.from(h.run('cues')),['export']);
 await h.run("cues=[];window.billingAPI.exportPDF=async()=>{throw Error('disk full')};savePDF()");assert.deepEqual(Array.from(h.run('cues')),['attention']);
});
test('packaging includes local effects and female voices only',()=>{
 const root=path.join(__dirname,'..'),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.ok(pkg.build.files.includes('assets/audio/**/*.mp3'));
 const voices=fs.readdirSync(path.join(root,'assets/audio/voice'));
 assert.equal(voices.filter(x=>x.endsWith('.mp3')).length,6);assert.ok(voices.every(x=>!/(male|toto)/i.test(x)));
 for(const group of ['sfx','voice'])for(const file of fs.readdirSync(path.join(root,'assets/audio',group)))if(file.endsWith('.mp3'))assert.ok(fs.statSync(path.join(root,'assets/audio',group,file)).size>1000);
});

test('trusted control taps survive a render, stay short and quiet, and throttle rapid repeats',async()=>{
 const h=harness();h.run(`setSfxEnabled(true);Date.now=()=>1000;control={id:'nav',disabled:false,getAttribute(){return null;},matches(){return false;},closest(){return null;}};target={closest(){return control;}};buttonTapClick({isTrusted:true,target});stopAppAudio();`);
 await Promise.resolve();assert.equal(h.clips.length,1);assert.match(h.clips[0].src,/button-tap\.mp3$/);assert.ok(h.clips[0].volume<.3);
 h.run('stopAppAudio();buttonTapClick({isTrusted:true,target});');await Promise.resolve();assert.equal(h.clips.length,1);
 h.run('Date.now=()=>1300;buttonTapClick({isTrusted:true,target});');await Promise.resolve();assert.equal(h.clips.length,2);
});
test('taps exclude disabled and synthetic controls, audio UI, outcome actions, typing and active speech',async()=>{
 const h=harness();h.run(`setSfxEnabled(true);control={id:'',disabled:false,getAttribute(){return null;},matches(){return false;},closest(){return null;}};target={closest(){return control;}};`);
 h.run('buttonTapClick({isTrusted:false,target});control.disabled=true;buttonTapClick({isTrusted:true,target});control.disabled=false;control.closest=()=>({});buttonTapClick({isTrusted:true,target});control.closest=()=>null;control.getAttribute=k=>k===\'onclick\'?\'issueDoc()\':null;buttonTapClick({isTrusted:true,target});control.getAttribute=()=>null;buttonTapClick({isTrusted:true,target:{closest(){return null}}});');
 await Promise.resolve();assert.equal(h.clips.length,0);
 h.ctx.button=h.element();h.run("toggleAudioGuide('payment',button);buttonTapClick({isTrusted:true,target});");await Promise.resolve();assert.equal(h.clips.length,1);assert.match(h.clips[0].src,/help-payment-th/);
});
