// App Store Connect API client for BillNgai release work (app record 6789503350).
// Auth: a TEAM key .p8 in ~/.private_keys/AuthKey_<KEY_ID>.p8 (never commit, cat or print it).
//   ASC_KEY_ID    — "BillNgai Release" team key (App Manager: can edit versions + submit)
//                   "BillNgai Notarization Key" team key (Developer: uploads + notarytool only)
//   ASC_ISSUER_ID — team issuer id from App Store Connect → Users and Access → Integrations → Team Keys
// Individual (per-user) keys do not work with Apple's tools.
const crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path'),https=require('https');
const KEY_ID=process.env.ASC_KEY_ID,ISSUER=process.env.ASC_ISSUER_ID;if(!KEY_ID||!ISSUER)throw new Error('set ASC_KEY_ID and ASC_ISSUER_ID (values live in the private layer, never in this repo)');exports.APP='6789503350';
function jwt(){const pem=fs.readFileSync(path.join(os.homedir(),'.private_keys','AuthKey_'+KEY_ID+'.p8'),'utf8');const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const now=Math.floor(Date.now()/1000);
 const u=b64({alg:'ES256',kid:KEY_ID,typ:'JWT'})+'.'+b64({iss:ISSUER,iat:now,exp:now+900,aud:'appstoreconnect-v1'});return u+'.'+crypto.sign('sha256',Buffer.from(u),{key:pem,dsaEncoding:'ieee-p1363'}).toString('base64url');}
exports.req=(method,p,body)=>new Promise((res,rej)=>{const data=body?JSON.stringify(body):null;const r=https.request({host:'api.appstoreconnect.apple.com',path:p,method,headers:{Authorization:'Bearer '+jwt(),'Content-Type':'application/json',...(data?{'Content-Length':Buffer.byteLength(data)}:{})}},rs=>{let d='';rs.on('data',c=>d+=c);rs.on('end',()=>{let j=null;try{j=JSON.parse(d)}catch{};res({status:rs.statusCode,json:j,text:d});});});r.on('error',rej);if(data)r.write(data);r.end();});
