'use strict';
// Runs only named, dedicated synthetic simulators, never a user's installed app.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const udid=process.argv[2],out=path.resolve(process.argv[3]||'review/ui-audit'),label=process.argv[4]||'device';
const devices=JSON.parse(execFileSync('xcrun',['simctl','list','devices','--json'],{encoding:'utf8'})).devices;
const device=Object.values(devices).flat().find(d=>d.udid===udid);
if(!device?.name.startsWith('BillNgai UI Audit '))throw Error('Only dedicated BillNgai UI Audit simulators are allowed');
fs.mkdirSync(out,{recursive:true});
const sim=(...args)=>execFileSync('xcrun',['simctl',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const results=[];
 const screens=process.env.BILLNGAI_AUDIT_SCREENS?.split(',')||['client','editor','recurring','split','receipt','receiptLong','invoiceLong','quotationLong','correctedPreview','confirm','dashboard','documents','clients','more','settings','settingsBusiness','report','wht'];
 const languages=process.env.BILLNGAI_AUDIT_LANGUAGES?.split(',')||['en','th'];
 if(languages.some(lang=>!['en','th'].includes(lang)))throw Error('Audit languages must be en or th');
 for(const lang of languages)for(const screen of screens){
  try{sim('terminate',udid,'com.visarut.billngai');}catch(e){}
  const container=sim('get_app_container',udid,'com.visarut.billngai','data').trim(),file=path.join(container,'Documents/mobile-ui-audit-result.json');
  fs.rmSync(file,{force:true});
  sim('launch',udid,'com.visarut.billngai','--billngai-qa','--billngai-ui-audit','--audit-screen',screen,'--audit-language',lang);
  let result=null;
  for(let count=0;count<180;count++){await wait(250);if(fs.existsSync(file)){try{result=JSON.parse(fs.readFileSync(file,'utf8'));break;}catch(e){}}}
  if(!result)throw Error('Native UI audit timed out: '+screen);
  const name=label+'-'+lang+'-'+screen;
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2)+'\n');
  sim('io',udid,'screenshot',path.join(out,name+'.png'));
  if(screen==='receipt'){const pdf=path.join(container,'Documents/mobile-qa.pdf');if(fs.existsSync(pdf))fs.copyFileSync(pdf,path.join(out,name+'.pdf'));}
  results.push({name,...result});
  console.log(name+': '+(result.ok?(result.result.violations.join('; ')||'PASS'):result.reason||result.error));
 }
 fs.writeFileSync(path.join(out,label+'-summary.json'),JSON.stringify(results,null,2)+'\n');
 process.exitCode=results.some(r=>!r.ok||r.result.violations.length)?1:0;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
