const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(){
 const ctx=vm.createContext({BillingData:require('../lib/billing-data.cjs'),window:{addEventListener(){},matchMedia(){return {matches:false}}},document:{getElementById(){return {innerHTML:'',value:'',addEventListener(){},classList:{add(){},remove(){},toggle(){}}}},querySelectorAll(){return []},addEventListener(){}},navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}}});vm.runInContext(script,ctx);
 const run=s=>{const v=vm.runInContext(s,ctx);return v&&typeof v.then==='function'?v:JSON.parse(JSON.stringify(v)??'null')};
 run(`DB=blankDB();DB.business.uiLang='en';DB.clients=[{id:'synthetic-buyer',name:'Synthetic buyer'}];
 function inv(id,amount,extra={}){return {id,type:'invoice',number:'INV-'+id,status:'paid',clientId:'synthetic-buyer',paidDate:'2026-01-10',issueDate:'2026-01-10',currency:'THB',vatRate:0,whtRate:0,items:[{description:'Synthetic service',qty:1,price:amount}],...extra};}
 function receipt(id,parent,amount,extra={}){return {...inv(id,amount),type:'receipt',status:'issued',number:'RC-'+id,parentId:parent,...extra};}
 persist=async()=>true;render=()=>{};toast=()=>{};window.billingAPI={snapshotBackup:async()=>true};`);return run;
}
test('pending display includes milestone and conflicting receipt amounts, never invoices, without mutating financial data',()=>{
 const run=setup();run(`DB.documents=[inv('a',107,{milestone:{seq:1,of:2}}),receipt('ra','a',100),inv('b',500,{milestone:{seq:2,of:2}}),receipt('rb','b',500)];before=JSON.stringify(DB)`);
 assert.equal(run('pendingPaymentSummary().eligible.length'),0);
 const summary=run('unresolvedReceiptSummary()');assert.equal(summary.net,600);assert.equal(summary.receiptCount,2);assert.equal(summary.groupCount,2);
 assert.equal(run('taxYearAgg(2026).agg.net'),0);assert.equal(run('JSON.stringify(DB)===before'),true);
 const markup=run('renderUnresolvedReceiptSummary()');assert.match(markup,/600/);assert.match(markup,/setView\('legacy'\)/);assert.match(markup,/not|Not|excluded|Excluded|review|Review/);
});
test('separate installment receipts stay separate even with identical client, project, date, amount and number',()=>{
 const run=setup();run(`DB.documents=[inv('a',100),receipt('ra','a',100,{number:'RC-SAME',project:'Synthetic project'}),inv('b',100),receipt('rb','b',100,{number:'RC-SAME',project:'Synthetic project'})]`);
 assert.equal(run('unresolvedReceiptSummary().net'),200);assert.equal(run('unresolvedReceiptSummary().receiptCount'),2);
 run(`const s=paymentReview();s.unallocatedGroups.push(s.unallocatedGroups[0]);globalThis.repeated=s`);
 assert.equal(run('unresolvedReceiptSummary(repeated).net'),200);
});
test('retained deleted or voided receipts contribute no pending cash; archived live receipts remain included',()=>{
 const run=setup();run(`DB.documents=[inv('a',100),receipt('ra','a',100,{archivedAt:'2026-02-01T00:00:00.000Z'}),inv('deleted',900,{deletedAt:'2026-02-01T00:00:00.000Z'}),receipt('rd','deleted',900,{deletedAt:'2026-02-01T00:00:00.000Z'}),inv('void',800,{voidedAt:'2026-02-01T00:00:00.000Z'}),receipt('rv','void',800,{voidedAt:'2026-02-01T00:00:00.000Z'})]`);
 assert.equal(run('unresolvedReceiptSummary().net'),100);assert.equal(run('unresolvedReceiptSummary().receiptCount'),1);assert.equal(run('unresolvedReceiptSummary().groupCount'),3);
});
test('bad-date and foreign receipt amounts remain visibly unquantified; reporting year excludes other years',()=>{
 const run=setup();run(`DB.documents=[inv('now',100),receipt('rn','now',100),inv('old',200,{paidDate:'2025-01-10'}),receipt('ro','old',200,{paidDate:'2025-01-10'}),inv('foreign',300,{currency:'USD'}),receipt('rf','foreign',300,{currency:'USD'}),inv('unknown',400,{paidDate:''}),receipt('ru','unknown',400,{paidDate:''})]`);
 assert.equal(run('unresolvedReceiptSummary().net'),300);assert.equal(run('unresolvedReceiptSummary(undefined,2026).net'),100);assert.equal(run('unresolvedReceiptSummary(undefined,2026).groupCount'),3);assert.equal(run('unresolvedReceiptSummary(undefined,2026).unquantifiedCount'),2);
});
test('recording seven separate owner answers restores seven amounts once and leaves deleted evidence pending',async()=>{
 const run=setup();run(`DB.documents=[];for(let i=1;i<=7;i++)DB.documents.push(inv('i'+i,i*100,{milestone:{seq:i,of:7},vatRate:7}),receipt('r'+i,'i'+i,i*100));DB.documents.push(inv('deleted',900,{deletedAt:'2026-02-01T00:00:00.000Z'}),receipt('rd','deleted',900,{deletedAt:'2026-02-01T00:00:00.000Z'}));original=JSON.stringify(DB.documents);
 answers=paymentReview().legacyGroups.filter(x=>x.group.some(d=>!d.deletedAt)).map(x=>({key:x.key,sourceJSON:JSON.stringify(x.group),decision:'same_payment',representativeId:x.group.find(d=>d.type==='receipt').id}));`);
 assert.equal(run('unresolvedReceiptSummary().net'),2800);
 assert.equal(await run(`saveLegacyAnswers(answers,true,'Synthetic owner confirms each installment separately using receipt amounts')`),true);
 assert.equal(run('taxYearAgg(2026).agg.net'),2800);assert.equal(run('paymentReview().docs.length'),7);assert.equal(run('unresolvedReceiptSummary().net'),0);assert.equal(run('unresolvedReceiptSummary().groupCount'),1);assert.equal(run('JSON.stringify(DB.documents)===original'),true);
 run(`DB.reviewEvents.push({id:'synthetic-title-correction',type:'receipt_reissue',receipt:receipt('corrected','i1',100)})`);
 assert.equal(run('taxYearAgg(2026).agg.net'),2800);assert.equal(run('unresolvedReceiptSummary().net'),0);
});
test('empty review produces no banner; added helper copy has complete Thai and English entries',()=>{
 const run=setup();assert.equal(run('renderUnresolvedReceiptSummary()'),'');
 const start=html.indexOf('function unresolvedReceiptSummary('),end=html.indexOf('function renderPendingPayments(',start);assert.ok(start>=0&&end>start);
 const texts=[...html.slice(start,end).matchAll(/tr\('([^']+)'\)/g)].map(x=>x[1]);for(const key of texts)assert.ok(run(`Object.hasOwn(I18N_EN,${JSON.stringify(key)})`),key);
});
test('a group with an undated invoice and an out-of-year live receipt uses year-specific copy',()=>{
 const run=setup();run(`DB.documents=[inv('a',100,{paidDate:''}),receipt('ra','a',100,{paidDate:'2025-01-10'})];globalThis.s={unallocatedGroups:[DB.documents]}`);
 const p=run('unresolvedReceiptSummary(s,2026)');assert.equal(p.groupCount,1);assert.equal(p.receiptCount,0);assert.equal(p.unquantifiedCount,0);
 const markup=run('renderUnresolvedReceiptSummary(s,2026)');assert.match(markup,/for this year/);assert.doesNotMatch(markup,/Only invoices or deleted/);
});
test('overflow is reported separately from receipts with invalid payment facts',()=>{
 const run=setup();run(`DB.documents=[receipt('a','x',1),receipt('b','y',1)];globalThis.s={unallocatedGroups:[DB.documents]};compute=()=>({subtotal:1e306,vatAmount:0,whtAmount:0,grandTotal:1e306,netPayable:1e306})`);
 const p=run('unresolvedReceiptSummary(s)');assert.equal(p.receiptCount,2);assert.equal(p.unquantifiedCount,0);assert.equal(p.net,null);
 const markup=run('renderUnresolvedReceiptSummary(s)');assert.match(markup,/exceeds the displayable range/);assert.doesNotMatch(markup,/check payment dates/);assert.doesNotMatch(markup,/Infinity/);
});
