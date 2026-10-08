'use strict';
// Bundle the reviewed renderer without a second financial implementation or secrets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),desktop=path.resolve(root,'..'),out=path.join(root,'www');
// This is a generated allowlist bundle. Stale files must not enter later builds.
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(desktop,'billing.html'),'utf8');
const sourceHash=crypto.createHash('sha256').update(html).digest('hex');
html=require(path.join(desktop,'scripts/channel-renderer.cjs')).appleRenderer(html);
fs.mkdirSync(path.join(out,'lib'),{recursive:true});
fs.copyFileSync(path.join(desktop,'lib/billing-data.cjs'),path.join(out,'lib/billing-data.js'));
html=html.replace('src="lib/billing-data.cjs"','src="lib/billing-data.js"');
// Native launch assets inherit the same approved brand, with no second palette.
const catalog=path.join(root,'ios/App/App/Assets.xcassets');
const launch=path.join(catalog,'LaunchLogo.imageset');fs.mkdirSync(launch,{recursive:true});
fs.copyFileSync(path.join(desktop,'logo.svg'),path.join(launch,'logo.svg'));
fs.writeFileSync(path.join(launch,'Contents.json'),JSON.stringify({images:[{idiom:'universal',filename:'logo.svg'}],info:{author:'xcode',version:1},properties:{'preserves-vector-representation':true}},null,2)+'\n');
const canvas=html.match(/--bg:\s*#([0-9a-f]{6})\s*;/i)?.[1];if(!canvas)throw Error('Missing approved background token');
const components=Object.fromEntries(['red','green','blue'].map((key,index)=>[key,(parseInt(canvas.slice(index*2,index*2+2),16)/255).toFixed(6)]));
// iOS requires exactly 1024px and no alpha channel; keep the approved master intact.
execFileSync('xcrun',['swift',path.join(root,'scripts/prepare-icon.swift'),path.join(desktop,'build/icon_source.png'),path.join(catalog,'AppIcon.appiconset/AppIcon-512@2x.png'),components.red,components.green,components.blue],{stdio:'pipe'});
const colors=path.join(catalog,'BillNgaiCanvas.colorset');fs.mkdirSync(colors,{recursive:true});
fs.writeFileSync(path.join(colors,'Contents.json'),JSON.stringify({colors:[{idiom:'universal',color:{'color-space':'srgb',components:{...components,alpha:'1.000000'}}}],info:{author:'xcode',version:1}},null,2)+'\n');
const accent=html.match(/--accent:\s*#([0-9a-f]{6})\s*;/i)?.[1];if(!accent)throw Error('Missing approved accent token');
const accentComponents=Object.fromEntries(['red','green','blue'].map((key,index)=>[key,(parseInt(accent.slice(index*2,index*2+2),16)/255).toFixed(6)]));
const accentColors=path.join(catalog,'BillNgaiAccent.colorset');fs.mkdirSync(accentColors,{recursive:true});
fs.writeFileSync(path.join(accentColors,'Contents.json'),JSON.stringify({colors:[{idiom:'universal',color:{'color-space':'srgb',components:{...accentComponents,alpha:'1.000000'}}}],info:{author:'xcode',version:1}},null,2)+'\n');
html=html.replace('width=device-width, initial-scale=1.0','width=device-width, initial-scale=1.0, viewport-fit=cover');
html=html.replace('</head>','<link rel="stylesheet" href="mobile.css">\n<link rel="stylesheet" href="mobile-print-preview.css">\n<link rel="stylesheet" href="mobile-iphone-ui.css">\n</head>');
html=html.replace('<script>','<script src="capacitor.js"></script>\n<script src="mobile-sync-core.js"></script>\n<script src="mobile-sync.js"></script>\n<script src="mobile-bridge.js"></script>\n<script>');
const bootCall='\nboot();\n</script>';
if(!html.includes(bootCall))throw Error('Review shared boot completion before bundling');
html=html.replace(bootCall,'\nwindow.BillNgaiMobileBoot=boot();\n</script>');
html=html.replace('</body>','<script src="mobile-ui.js"></script>\n<script src="mobile-accessibility.js"></script>\n<script src="mobile-editor-recovery.js"></script>\n<script src="mobile-print-preview.js"></script>\n<script src="mobile-iphone-ui.js"></script>\n</body>');
// Native sharing reports completion/cancellation itself. Preserve the CSV builders.
for(const message of ['ส่งออก CSV แล้ว','ส่งออก CSV (50 ทวิ) แล้ว']){
 const premature=`toast(tr('${message}'),'ok');`;
 if(!html.includes(premature))throw Error('Review changed desktop export feedback before bundling');
 html=html.replace(premature,'/* Native share completion is handled by downloadFile. */');
}
const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
html=html.replace('<meta charset="UTF-8">',`<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
fs.writeFileSync(path.join(out,'index.html'),html);
for(const file of ['mobile-sync.js','mobile.css','mobile-bridge.js','mobile-ui.js','mobile-accessibility.js','mobile-editor-recovery.js','mobile-print-preview.js','mobile-print-preview.css','mobile-iphone-ui.js','mobile-iphone-ui.css'])fs.copyFileSync(path.join(root,'web',file),path.join(out,file));
fs.copyFileSync(path.join(root,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(out,'capacitor.js'));
const appPackage=JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8'));
const artwork=appPackage.build.files.filter(file=>file.startsWith('assets/brand/fintech/')&&file.endsWith('.png')&&!file.includes('*')&&!file.includes('..'));
for(const file of ['logo.svg','fonts',...artwork]){
 const src=path.join(desktop,file),target=path.join(out,file);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(src,target,{recursive:true});
}
// Public diagnostic metadata contains source identity, never local customer data.
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({renderer:'shared billing.html',sha256:sourceHash,purchaseChannel:'apple',prototype:true,cloudReady:false},null,2)+'\n');
const qa=path.join(out,'mobile-qa.js');
if(process.argv.includes('--qa')||process.argv.includes('--ui-audit')||process.argv.includes('--recovery-qa'))fs.copyFileSync(path.join(root,'test/mobile-qa.js'),qa);
else fs.rmSync(qa,{force:true});
if(process.argv.includes('--ui-audit'))fs.copyFileSync(path.join(root,'test/mobile-ui-audit.js'),path.join(out,'mobile-ui-audit.js'));
require('./bundle-sync.cjs')(out).then(()=>console.log('Prepared bundled mobile renderer and shared sync core; live acceptance remains gated.')).catch(error=>{console.error(error);process.exitCode=1;});

if(process.argv.includes('--recovery-qa'))fs.copyFileSync(path.join(root,'test/mobile-recovery-qa.js'),path.join(out,'mobile-recovery-qa.js'));
