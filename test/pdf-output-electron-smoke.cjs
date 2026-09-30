// PDF output must contain only the document paper: no lineage chips, instalment progress,
// status/action bars or app background. Isolated synthetic profile; exports via the same
// printToPDF options as the app's “PDF” button.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
// macOS PDFKit text extraction (no extra dependencies).
// PDFKit returns decomposed sara am (nikhahit + aa); normalise before matching Thai text.
const pdfText=file=>pdfTextRaw(file).replace(/\u0E4D\u0E32/g,'\u0E33');
const pdfTextRaw=file=>execFileSync('/usr/bin/osascript',['-l','JavaScript','-e',
 'ObjC.import("PDFKit");function run(a){const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));return d.string.js+"\\n@@pages="+d.pageCount;}',file],{encoding:'utf8'});
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-pdf-output-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic Translator',address:'Chiang Mai 50220',taxId:'1234567890121',vatStatus:'non_registered'},
  clients:[{id:'buyer',name:'Synthetic NGO',address:'Bangkok 10900'}],documents:[],reviewEvents:[],meta:{setupDone:true},counters:{},recurring:[]}));
 const exe=process.argv[2],app=await _electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed,{},{polling:100});
  await page.evaluate(()=>{window.confirm=()=>true;askConfirm=async()=>true;});
  // Quotation → instalment invoice, so both the lineage strip and the progress card are on screen.
  const qid=await page.evaluate(async()=>{
   editDoc={id:null,type:'quotation',number:null,status:'draft',clientId:'buyer',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,
    items:[{description:'Report layout, English to Thai',qty:32,unit:'page',price:120}],issueConfirmed:true};await saveDoc();
   const q=DB.documents.find(d=>d.type==='quotation');
   editDoc={id:null,type:'invoice',number:null,status:'draft',parentId:q.id,clientId:'buyer',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,
    milestone:{seq:1,of:1,label:''},items:[{description:'Instalment 1/1',qty:1,price:3840}],issueConfirmed:true};await saveDoc();
   return q.id;});
  await page.evaluate(id=>viewDoc(id),qid);
  await page.locator('.doc-trail').waitFor();await page.locator('.split-progress').waitFor();
  const file=path.join(root,'quotation.pdf');
  // Exercise the real “PDF” button path (savePDF → doc:pdf); only the native save dialog is stubbed.
  await app.evaluate(({dialog,shell},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});shell.showItemInFolder=()=>{};},file);
  await page.evaluate(()=>savePDF());
  await fs.access(file);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBackgroundColor()),'#FFF9F3','app background restored after export');
  const text=pdfText(file);
  assert.match(text,/ใบเสนอราคา/);assert.match(text,/Report layout/);
  for(const screenOnly of ['นำไปออก','สร้างจาก','การแบ่งงวด','ชำระแล้ว','ออกบิลแล้ว','ส่งแล้ว','พิมพ์','ตัวเลือกเพิ่มเติม'])
   assert.ok(!text.includes(screenOnly),'screen-only text in PDF: '+screenOnly);
  assert.match(text,/@@pages=1\s*$/,'one A4 page');
  // Page corners must be white paper, not the cream app background.
  // Rasterise the way Finder/Preview show it (Quick Look), so unpainted margins count as paper.
  execFileSync('/usr/bin/qlmanage',['-t','-s','900','-o',root,file],{stdio:'ignore'});const png=file+'.png';
  const corner=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
   const x=c.getContext('2d');x.drawImage(img,0,0);return [...x.getImageData(4,4,1,1).data,...x.getImageData(img.width-5,img.height-5,1,1).data];},
   'data:image/png;base64,'+(await fs.readFile(png)).toString('base64'));
  assert.deepEqual(corner.slice(0,3),[255,255,255],'top-left corner is white, got '+corner.slice(0,3));
  assert.deepEqual(corner.slice(4,7),[255,255,255],'bottom-right corner is white, got '+corner.slice(4,7));
  assert.deepEqual(errors,[]);
  console.log('PASS: PDF contains only the paper — no lineage, instalment progress, status or actions; white page; one A4 page.');console.log('ARTIFACTS='+root);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
