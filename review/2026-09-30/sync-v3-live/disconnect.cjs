const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9334');const A=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));
 await A.evaluate(()=>{askConfirm=async()=>true;window.confirm=()=>true;});
 const before=await A.evaluate(()=>({docs:DB.documents.length,clients:DB.clients.length}));
 await A.evaluate(async()=>{await disconnectSyncV3();});
 const after=await A.evaluate(async()=>{await refreshSyncInfo();return {connected:syncV3Info.connected,docs:DB.documents.length,clients:DB.clients.length,bindingInMemory:!!DB.syncV3,toast:document.getElementById('toast').textContent};});
 const disk=JSON.parse(fs.readFileSync(path.join(__dirname,'profile-A/billing.json'),'utf8'));
 const backups=fs.readdirSync(path.join(__dirname,'profile-A/backups')).filter(n=>n.includes('before-sync-disconnect'));
 const tokensGone=!fs.existsSync(path.join(__dirname,'profile-A/sync-tokens.bin'));
 // Import/restore are allowed again once disconnected: the app accepts an explicit restore.
 const out={before,after,bindingOnDisk:!!disk.syncV3,backups:backups.length,tokensGone};console.log(JSON.stringify(out,null,1));
 fs.appendFileSync(path.join(__dirname,'results.jsonl'),JSON.stringify({at:new Date().toISOString(),step:'disconnect',...out})+'\n');setTimeout(()=>process.exit(0),100);})().catch(e=>{console.error(e);process.exit(1);});
