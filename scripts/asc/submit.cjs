// Submit BillNgai 2.1.0 on iOS and macOS through the App Store Connect API.
// usage: node scripts/asc/submit.cjs <metadata.json> <screens-dir> [--submit]   e.g. review/2026-10-11/store-metadata-2.1.0.json review/2026-10-10/design/store-screens
// Version/build ids below are the 2.1.0 ones; update IOS_VERSION/IOS_BUILD/MAC_BUILD (see builds.cjs / state.cjs) for the next release.   (without --submit: prepares everything, submits nothing)
const {req,APP}=require('./client.cjs');const fs=require('fs'),path=require('path'),crypto=require('crypto'),https=require('https');
const [meta,screens,flag]=process.argv.slice(2);const M=JSON.parse(fs.readFileSync(meta,'utf8'));const SUBMIT=flag==='--submit';
const IOS_VERSION='e2048f3b-f08f-4d89-a28e-f66dca13b6b1',IOS_BUILD='30681498-2292-4103-8634-a266a4fe511b',MAC_BUILD='c0dad118-e688-446e-8a78-aedd1fda391d';
const ok=(r,what)=>{if(r.status>=300){throw new Error(what+' → HTTP '+r.status+' '+JSON.stringify(r.json?.errors?.[0]||r.text.slice(0,200)));}return r.json;};
async function ensureMacVersion(){const v=await req('GET',`/v1/apps/${APP}/appStoreVersions?filter[platform]=MAC_OS&filter[versionString]=2.1.0`);if(v.json?.data?.length)return v.json.data[0].id;
 return ok(await req('POST','/v1/appStoreVersions',{data:{type:'appStoreVersions',attributes:{platform:'MAC_OS',versionString:M.versionString,releaseType:'AFTER_APPROVAL',copyright:M.copyright},relationships:{app:{data:{type:'apps',id:APP}}}}}),'create mac version').data.id;}
async function localization(versionId){const l=await req('GET',`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);let loc=(l.json?.data||[]).find(x=>x.attributes.locale===M.locale);
 const attrs={description:M.description,keywords:M.keywords,whatsNew:M.whatsNew,supportUrl:M.supportUrl,marketingUrl:M.marketingUrl,promotionalText:M.promotionalText};
 if(loc){let r=await req('PATCH',`/v1/appStoreVersionLocalizations/${loc.id}`,{data:{type:'appStoreVersionLocalizations',id:loc.id,attributes:attrs}});
  if(r.status===409&&/whatsNew/i.test(JSON.stringify(r.json))){const {whatsNew,...rest}=attrs;console.log('  first version: What\'s New not allowed, skipping it');r=await req('PATCH',`/v1/appStoreVersionLocalizations/${loc.id}`,{data:{type:'appStoreVersionLocalizations',id:loc.id,attributes:rest}});}
  ok(r,'patch localization');}
 else loc=ok(await req('POST','/v1/appStoreVersionLocalizations',{data:{type:'appStoreVersionLocalizations',attributes:{locale:M.locale,...attrs},relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}}),'create localization').data;return loc.id;}
function put(url,headers,body){return new Promise((res,rej)=>{const u=new URL(url);const r=https.request({host:u.host,path:u.pathname+u.search,method:'PUT',headers:{...headers,'Content-Length':body.length}},rs=>{rs.resume();rs.on('end',()=>res(rs.statusCode));});r.on('error',rej);r.end(body);});}
async function screenshotsFor(locId,types){for(const [type,files] of Object.entries(types)){
 const sets=await req('GET',`/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?filter[screenshotDisplayType]=${type}`);let set=sets.json?.data?.[0];
 if(!set)set=ok(await req('POST','/v1/appScreenshotSets',{data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:type},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:locId}}}}}),'create set '+type).data;
 const existing=await req('GET',`/v1/appScreenshotSets/${set.id}/appScreenshots?fields[appScreenshots]=fileName`);const have=new Set((existing.json?.data||[]).map(x=>x.attributes.fileName));
 for(const f of files){const name=f.replace(/\//g,'-');if(have.has(name)){console.log('  skip',name);continue;}const buf=fs.readFileSync(path.join(screens,f));
  const shot=ok(await req('POST','/v1/appScreenshots',{data:{type:'appScreenshots',attributes:{fileName:name,fileSize:buf.length},relationships:{appScreenshotSet:{data:{type:'appScreenshotSets',id:set.id}}}}}),'reserve '+name).data;
  for(const op of shot.attributes.uploadOperations){const h={};for(const x of op.requestHeaders)h[x.name]=x.value;const st=await put(op.url,h,buf.subarray(op.offset,op.offset+op.length));if(st>=300)throw new Error('upload chunk '+name+' HTTP '+st);}
  ok(await req('PATCH',`/v1/appScreenshots/${shot.id}`,{data:{type:'appScreenshots',id:shot.id,attributes:{uploaded:true,sourceFileChecksum:crypto.createHash('md5').update(buf).digest('hex')}}}),'commit '+name);console.log('  uploaded',type,name);}}}
async function reviewDetail(versionId){const d=await req('GET',`/v1/appStoreVersions/${versionId}/appStoreReviewDetail`);const attrs={contactEmail:'visarut298@gmail.com',contactFirstName:'Visarut',contactLastName:'Sankham',contactPhone:'+66627283058',demoAccountRequired:false,notes:M.reviewNotes};
 if(d.json?.data)ok(await req('PATCH',`/v1/appStoreReviewDetails/${d.json.data.id}`,{data:{type:'appStoreReviewDetails',id:d.json.data.id,attributes:attrs}}),'patch review detail');
 else ok(await req('POST','/v1/appStoreReviewDetails',{data:{type:'appStoreReviewDetails',attributes:attrs,relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}}),'create review detail');}
async function attachBuild(versionId,buildId){ok(await req('PATCH',`/v1/appStoreVersions/${versionId}/relationships/build`,{data:{type:'builds',id:buildId}}),'attach build');}
async function submit(platform,versionId){const s=ok(await req('POST','/v1/reviewSubmissions',{data:{type:'reviewSubmissions',attributes:{platform},relationships:{app:{data:{type:'apps',id:APP}}}}}),'create submission '+platform).data;
 ok(await req('POST','/v1/reviewSubmissionItems',{data:{type:'reviewSubmissionItems',relationships:{reviewSubmission:{data:{type:'reviewSubmissions',id:s.id}},appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}}),'add item');
 ok(await req('PATCH',`/v1/reviewSubmissions/${s.id}`,{data:{type:'reviewSubmissions',id:s.id,attributes:{submitted:true}}}),'submit');console.log('SUBMITTED',platform,s.id);}
(async()=>{
 console.log('iOS: version string');ok(await req('PATCH',`/v1/appStoreVersions/${IOS_VERSION}`,{data:{type:'appStoreVersions',id:IOS_VERSION,attributes:{versionString:M.versionString,releaseType:'AFTER_APPROVAL',copyright:M.copyright}}}),'ios version');
 const macId=await ensureMacVersion();console.log('Mac version',macId);
 const iosLoc=await localization(IOS_VERSION),macLoc=await localization(macId);console.log('localizations ok');
 await screenshotsFor(iosLoc,{APP_IPHONE_67:M.screenshots.APP_IPHONE_67,APP_IPAD_PRO_3GEN_129:M.screenshots.APP_IPAD_PRO_3GEN_129});await screenshotsFor(macLoc,{APP_DESKTOP:M.screenshots.APP_DESKTOP});
 await reviewDetail(IOS_VERSION);await reviewDetail(macId);console.log('review details ok');
 await attachBuild(IOS_VERSION,IOS_BUILD);await attachBuild(macId,MAC_BUILD);console.log('builds attached');
 if(SUBMIT){await submit('IOS',IOS_VERSION);await submit('MAC_OS',macId);}else console.log('prepared only (no --submit)');
})().catch(e=>{console.error('STOP:',e.message);process.exitCode=1;});
