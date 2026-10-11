const {req,APP}=require('./client.cjs');
(async()=>{
 const v=await req('GET',`/v1/apps/${APP}/appStoreVersions?limit=10&fields[appStoreVersions]=platform,versionString,appStoreState,appVersionState,createdDate`);
 if(v.status!==200){console.log('versions HTTP',v.status,v.text.slice(0,300));return;}
 for(const x of v.json.data)console.log('VERSION',x.id,x.attributes.platform,x.attributes.versionString,x.attributes.appVersionState||x.attributes.appStoreState,x.attributes.createdDate.slice(0,10));
 const iap=await req('GET',`/v1/apps/${APP}/inAppPurchasesV2?fields[inAppPurchases]=name,productId,state,inAppPurchaseType`);
 for(const x of (iap.json?.data||[]))console.log('IAP',x.attributes.productId,x.attributes.inAppPurchaseType,x.attributes.state);
 const subs=await req('GET',`/v1/apps/${APP}/reviewSubmissions?limit=5&fields[reviewSubmissions]=platform,state,submittedDate`);
 for(const x of (subs.json?.data||[]))console.log('REVIEW-SUBMISSION',x.id,x.attributes.platform,x.attributes.state,x.attributes.submittedDate);
 const info=await req('GET',`/v1/apps/${APP}/appInfos?fields[appInfos]=appStoreState,state`);for(const x of (info.json?.data||[]))console.log('APPINFO',x.id,x.attributes.state||x.attributes.appStoreState);
})();
