const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9334');const A=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));
 const prompts=[];await A.evaluate(()=>{window.__prompts=[];askConfirm=async(m)=>{window.__prompts.push(m);return true;};window.confirm=()=>true;});
 await A.evaluate(async()=>{DB.clients.push({id:'local-only',name:'Local only after disconnect',address:'Nowhere',updatedAt:new Date().toISOString(),deletedAt:null});await persist(true);});
 await A.evaluate(async()=>{await connectSyncV3();});
 const r=await A.evaluate(async()=>{await refreshSyncInfo();return {prompts:window.__prompts,connected:syncV3Info.connected,mode:syncV3Info.mode,err:syncErr,toast:document.getElementById('toast').textContent,
   clients:DB.clients.filter(c=>!c.deletedAt).map(c=>c.name).sort(),docs:DB.documents.length,localOnlyKept:DB.clients.some(c=>c.id==='local-only')};});
 const backups=fs.readdirSync(path.join(__dirname,'profile-A/backups')).filter(n=>n.includes('before-sync-replace'));
 const backupHasLocal=backups.some(n=>fs.readFileSync(path.join(__dirname,'profile-A/backups',n),'utf8').includes('Local only after disconnect'));
 const out={...r,replaceBackups:backups.length,backupHasLocalOnlyClient:backupHasLocal};console.log(JSON.stringify(out,null,1));
 fs.appendFileSync(path.join(__dirname,'results.jsonl'),JSON.stringify({at:new Date().toISOString(),step:'reconnect-replace',...out})+'\n');setTimeout(()=>process.exit(0),100);})().catch(e=>{console.error(e);process.exit(1);});
