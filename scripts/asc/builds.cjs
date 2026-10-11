// Read-only: list the latest builds on the BillNgai App Store Connect record. The key file is read by this script only to sign the token; nothing from it is printed.
const {req,APP}=require('./client.cjs');
(async()=>{const r=await req('GET',`/v1/builds?filter[app]=${APP}&sort=-uploadedDate&limit=8&include=preReleaseVersion&fields[builds]=version,uploadedDate,processingState,expired,preReleaseVersion&fields[preReleaseVersions]=version,platform`);
 if(r.status!==200){console.log('HTTP',r.status,r.text.slice(0,300));return;}
 const j=r.json;const pre=Object.fromEntries((j.included||[]).map(i=>[i.id,i.attributes]));
 for(const b of j.data){const p=pre[b.relationships?.preReleaseVersion?.data?.id]||{};console.log((p.platform||'?').padEnd(6),(p.version||'?').padEnd(7),'build',String(b.attributes.version).padEnd(7),b.attributes.processingState.padEnd(11),b.attributes.uploadedDate);}
})().catch(e=>console.log('ERR',e.message));
