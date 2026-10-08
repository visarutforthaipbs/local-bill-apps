const {finished}=require('node:stream/promises');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {appleRenderer}=require('../scripts/channel-renderer.cjs');
test('builder maps only the generated Apple renderer, and packaged validation rejects the direct modal',async t=>{
 const os=require('node:os'),asar=require('@electron/asar');
 const {beforePack,afterPack}=require('../scripts/validate-release-config.cjs');
 const {getFileMatchers,copyFiles}=require('app-builder-lib/out/fileMatcher');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-channel-package-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),resources=path.join(root,'out/BillNgai.app/Contents/Resources'),staged=path.join(root,'staged');
 fs.mkdirSync(path.join(source,'secrets'),{recursive:true});fs.mkdirSync(resources,{recursive:true});
 const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');fs.writeFileSync(path.join(source,'billing.html'),html);
 fs.writeFileSync(path.join(source,'secrets/gdrive-oauth.json'),JSON.stringify({installed:{client_id:'123-test.apps.googleusercontent.com',client_secret:'synthetic-placeholder'}}));
 const {doMergeConfigs}=require('app-builder-lib/out/util/config/config');
 const build=doMergeConfigs([JSON.parse(JSON.stringify(require('../package.json').build))]);
 fs.writeFileSync(path.join(source,'must-not-package.txt'),'Unrelated development source');
 const context={electronPlatformName:'mas',appOutDir:path.join(root,'out'),packager:{config:build,info:{appDir:source},appInfo:{productFilename:'BillNgai'}}};
 await beforePack(context);assert.equal(fs.readFileSync(path.join(source,'billing.html'),'utf8'),html);
 const matchers=getFileMatchers(build,'files',staged,{defaultSrc:source,macroExpander:v=>v,customBuildOptions:build.mas,globalOutDir:path.join(root,'out')});
 await copyFiles(matchers,null,false);assert.equal(fs.readFileSync(path.join(staged,'billing.html'),'utf8'),appleRenderer(html));
 assert.equal(fs.existsSync(path.join(staged,'must-not-package.txt')),false);
 await finished(await asar.createPackage(staged,path.join(resources,'app.asar')));asar.uncacheAll();await afterPack(context);
 fs.writeFileSync(path.join(staged,'billing.html'),html);await finished(await asar.createPackage(staged,path.join(resources,'app.asar')));asar.uncacheAll();await assert.rejects(afterPack(context),/Release blocked/);
 // A mixed MAS/direct build restores the original renderer selection.
 context.electronPlatformName='darwin';await beforePack(context);
 const direct=path.join(root,'direct');
 await copyFiles(getFileMatchers(build,'files',direct,{defaultSrc:source,macroExpander:v=>v,customBuildOptions:build.mac,globalOutDir:path.join(root,'out')}),null,false);
 assert.equal(fs.readFileSync(path.join(direct,'billing.html'),'utf8'),html);
 assert.equal(fs.existsSync(path.join(direct,'must-not-package.txt')),false);
});
test('Apple packaging removes the direct purchase modal while preserving financial and phone code',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8'),apple=appleRenderer(source);
 assert.match(source,/https:\/\/lin\.ee\/pSl8nEH/);
 assert.doesNotMatch(apple,/https:\/\/lin\.ee\/pSl8nEH|Early Bird|ซื้อ Pro: สแกนจ่ายผ่าน PromptPay/);
 for(const name of ['paymentReview','dataUpgradePreview','openClientEditor','openRecurringEditor','openMasUpgradeModal'])assert.ok(apple.includes('function '+name+'('));
 const inline=[...apple.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 new vm.Script(inline);
 assert.equal(appleRenderer(apple),apple);
 assert.throws(()=>appleRenderer(source.replace('function openDirectUpgradeModal(){','function renamedModal(){')),/Release blocked/);
});
