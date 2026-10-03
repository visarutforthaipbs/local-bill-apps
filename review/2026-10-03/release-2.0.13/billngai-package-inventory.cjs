const asar=require('@electron/asar'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const archive=process.argv[2],pkg=JSON.parse(fs.readFileSync('package.json'));
const files=asar.listPackage(archive).map(p=>p.replace(/\\/g,'/').replace(/^\//,''));let matched=[];
for(const f of files){
 let st;try{st=asar.statFile(archive,f.split('/').join(path.sep));}catch{continue;}
 if(st.files||f==='package.json'||f==='secrets/gdrive-oauth.json')continue;
 if(fs.existsSync(f)&&fs.statSync(f).isFile()){assert.ok(fs.readFileSync(f).equals(asar.extractFile(archive,f.split('/').join(path.sep))),'mismatch '+f);matched.push(f);}
}
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'2.0.13');
assert.ok(fs.readFileSync('secrets/gdrive-oauth.json').equals(asar.extractFile(archive,path.join('secrets','gdrive-oauth.json'))));
assert.equal(matched.filter(f=>f.endsWith('.mp3')).length,11);
assert.equal(matched.filter(f=>f.startsWith('assets/brand/fintech/')).length,5);
assert.equal(files.some(f=>f.startsWith('mobile/')||/set-1-/.test(f)),false);
console.log(JSON.stringify({version:'2.0.13',matched,oauthMatches:true,mobileExcluded:true},null,2));
