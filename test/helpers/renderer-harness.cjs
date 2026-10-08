const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function rendererHarness(backup=async()=>true){
 const element=()=>({innerHTML:'',textContent:'',value:'',checked:false,style:{},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
 const ctx=vm.createContext({BillingData:require('../../lib/billing-data.cjs'),window:{addEventListener(){},matchMedia(){return {matches:false};},billingAPI:{snapshotBackup:backup}},document:{getElementById:element,querySelectorAll(){return []},addEventListener(){}},navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}},confirm(){return true}});
 const script=fs.readFileSync(path.join(__dirname,'../../billing.html'),'utf8').match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');vm.runInContext(script,ctx);
 const run=code=>vm.runInContext(code,ctx);run(`DB=blankDB();delete DB.meta.reviewSemanticsVersion;DB.business.uiLang='en';persist=async()=>true;render=()=>{};toast=()=>{};
 const i={id:'i',type:'invoice',number:'INV-1',status:'paid',clientId:'c',paidDate:'2026-01-10',issueDate:'2026-01-10',currency:'THB',vatRate:0,whtRate:0,items:[{description:'Synthetic service',qty:1,price:1000}]};
 DB.clients=[{id:'c',name:'Synthetic'}];DB.documents=[i,{...i,id:'r',type:'receipt',number:'RC-1',status:'issued',parentId:'i'}];
 function answer(decision='same_payment'){const item=paymentReview().legacyGroups[0];return {key:item.key,sourceJSON:reviewSourceJSON(item.group),heads:item.resolution.heads,decision,representativeId:decision==='same_payment'?'r':undefined};}`);
 return {ctx,run};
}
module.exports={rendererHarness};
