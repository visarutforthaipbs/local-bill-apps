// Diagnostic reproductions of known 2.0.3 defects, NOT passing release regressions.
// Synthetic VM records only. Never opens the installed app or its data directory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const history = fs.readFileSync(path.join(root, 'test/history.test.cjs'), 'utf8');
const setup = new Function('require', '__dirname', history.slice(0, history.indexOf("test('")) + '\nreturn setup;')(require, path.join(root, 'test'));
const html = fs.readFileSync(path.join(root, 'billing.html'), 'utf8');
async function probe(name, fn) { await fn(); console.log('REPRODUCED: ' + name); }
(async () => {
  await probe('native void fails before saving', async () => {
    const {run} = setup();
    run(`DB.documents=[fixture()]; prompt=()=>{throw Error('prompt() is not supported.');};`);
    await assert.rejects(run(`voidDocument('doc1')`), /prompt\(\) is not supported/);
    assert.equal(run(`!!DB.documents[0].voidedAt`), false);
  });
  await probe('native invoice payment also uses unsupported prompt', async () => {
    const {run} = setup();
    run(`frozen({type:'invoice',status:'sent',whtReviewed:true}); prompt=()=>{throw Error('prompt() is not supported.');};`);
    await assert.rejects(run(`setStatus('doc1','paid')`), /prompt\(\) is not supported/);
    assert.equal(run(`DB.documents[0].status`), 'sent');
  });
  await probe('quotation decline action silently leaves sent status', async () => {
    const {run} = setup();
    run(`frozen({type:'quotation',status:'sent'});`);
    await run(`setStatus('doc1','declined')`);
    assert.equal(run(`DB.documents[0].status`), 'sent');
    assert.match(html, /setStatus\('\$\{d.id\}','declined'\)/);
  });
  await probe('retained legacy document loses its old deleted buyer during migration', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{const db=blankDB();db.clients=[{id:'old-buyer',name:'Synthetic retained buyer',deletedAt:'2020-01-01T00:00:00Z'}];db.documents=[fixture({clientId:'old-buyer'})];const m=migrate(db);return m.documents.length===1 && m.documents[0].clientId==='old-buyer' && m.clients.length===0;})()`), true);
  });
  await probe('draft print CSS hides the only not-issued marker (static)', () => {
    const {run} = setup();
    const paper = run(`renderPaper(fixture({status:'draft'}),DB.clients[0],compute(fixture({status:'draft'})))`);
    assert.match(paper, /<div class="banner">ร่าง — ยังไม่ออกเอกสาร<\/div>/);
    assert.doesNotMatch(paper.replace(/<div class="banner">[\s\S]*?<\/div>/g, ''), /ร่าง|DRAFT|not issued/);
    assert.match(html, /@media print\{[\s\S]*?\.sidebar,\.topbar,\.doc-actions,\.overlay,\.toast,\.banner[^\{]*\{display:none!important\}/);
    assert.equal(run(`documentOutputBlocked(fixture({status:'draft'}))`), false);
  });
  await probe('voided unpaid invoice still classified overdue and included by report filter', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{const d=fixture({type:'invoice',status:'sent',dueDate:'2020-01-01',issueDate:todayISO(),voidedAt:'2026-09-24T00:00:00Z'});DB.documents=[d];return effectiveStatus(d)==='overdue' && activeDocs().filter(x=>x.type==='invoice' && docCurrency(x)==='THB' && new Date(x.issueDate).getFullYear()===new Date().getFullYear() && ['sent','overdue'].includes(effectiveStatus(x))).length===1;})()`), true);
  });
  await probe('legacy tax-invoice draft still reaches tax-labelled paper output', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{DB=migrate({...DB,documents:[fixture({type:'tax_invoice',status:'draft',vatRate:7})]});const d=DB.documents[0];const paper=renderPaper(d,DB.clients[0],compute(d));return !documentOutputBlocked(d) && !d.legacy_review_required && paper.includes('class="paper"') && paper.includes('tax-stamp');})()`), true);
  });
  await probe('legacy missing currency is silently treated as THB', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{DB.business.currency='USD';const d=fixture();delete d.currency;DB=migrate({...DB,documents:[d]});return !('currency' in DB.documents[0]) && docCurrency(DB.documents[0])==='THB' && reportFxRate(DB.documents[0])===1;})()`), true);
  });
  await probe('imported document ID becomes executable inline-handler code', () => {
    const {run} = setup();
    const injectedId = "x');globalThis.auditMarker=42;//";
    const table = run(`docTable([fixture({id:${JSON.stringify(injectedId)}})])`);
    const handler = table.match(/<tr onclick="([^"]+)"/)[1];
    run(`viewDoc=()=>{};globalThis.auditMarker=0;`);
    run(handler);
    assert.equal(run('globalThis.auditMarker'), 42);
  });
  await probe('report CSV replaces frozen buyer with current client identity', () => {
    const {run} = setup();
    run(`frozen({incomeCategory:'40(2)'});DB.clients[0].name='Changed current buyer';DB.clients[0].taxId='9999999999999';`);
    const csv = run('buildReportCSV(2026)');
    assert.match(csv, /Changed current buyer/);
    assert.match(csv, /9999999999999/);
    assert.doesNotMatch(csv, /Original buyer/);
    assert.equal(run(`DB.documents[0].issuedSnapshot.buyer.name`), 'Original buyer');
  });
  await probe('nested invalid data passes main schema but crashes renderer migration', () => {
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const fn = main.slice(main.indexOf('function validateData('), main.indexOf('async function readDataFile('));
    const validate = new Function(fn + ';return validateData;')();
    const invalid = {business:{},documents:[],clients:[null],recurring:[]};
    assert.deepEqual(validate(JSON.stringify(invalid)), invalid);
    const {run} = setup();
    assert.throws(() => run(`migrate(${JSON.stringify(invalid)})`), /updatedAt/);
  });
  await probe('recurring generation advances state and reports success after save failure', async () => {
    const {run} = setup();
    run(`DB.documents=[];DB.recurring=[{id:'rec1',clientId:'buyer',nextDate:'2026-01-01',frequency:'monthly',currency:'THB',vatRate:0,whtRate:0,items:[{description:'Synthetic',qty:1,price:100}],deletedAt:null}];persist=async()=>false;viewDoc=()=>{};var capturedToast='';toast=(s,k)=>{capturedToast=k};generateRecurring('rec1');`);
    assert.equal(run('DB.documents.length'), 1);
    assert.equal(run('DB.recurring[0].nextDate'), '2026-02-01');
    assert.equal(run('capturedToast'), 'ok');
  });
  await probe('monthly recurrence skips February from January 31', () => {
    const {run} = setup();
    assert.equal(run(`advanceDate('2026-01-31','monthly')`), '2026-03-03');
  });
  await probe('split progress counts unissued drafts as fully billed', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{const q=fixture({id:'q',type:'quotation',status:'sent',vatRate:0,whtRate:0});DB.documents=[q,fixture({id:'i',parentId:'q',type:'invoice',status:'draft',vatRate:0,whtRate:0})];const p=splitProgress(q);return p.billed===10000 && p.remaining===0 && p.fullyBilled;})()`), true);
  });
  await probe('archive review export omits available linked buyer context', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{DB=migrate({...DB,documents:[fixture()]});let out;downloadFile=text=>out=JSON.parse(text);exportDocumentArchive();return out.documents[0].clientId==='buyer' && !JSON.stringify(out).includes('Original buyer');})()`), true);
  });
  await probe('settings form announces saved even when persistence returns false', () => {
    const {run} = setup();
    run(`document.getElementById=id=>id==='s_name'?{value:'Unsaved synthetic issuer'}:null;persist=async()=>false;applyTheme=()=>{};var resultKind='';toast=(s,k)=>{resultKind=k};saveSettings(false);`);
    assert.equal(run('DB.business.businessName'), 'Unsaved synthetic issuer');
    assert.equal(run('resultKind'), 'ok');
  });
  await probe('invalid February payment date is allocated to March despite warning', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{DB.documents=[fixture({paidDate:'2026-02-31',incomeCategory:'40(2)'})];const s=taxYearAgg(2026);return s.missingDate===1 && s.byMonth[2]===10000;})()`), true);
  });
  await probe('distinct historical child payment IDs collapse into one invoice group', () => {
    const {run} = setup();
    assert.equal(run(`(()=>{DB.documents=[fixture({id:'p1',paymentId:'pay1',parentId:'old-invoice'}),fixture({id:'p2',paymentId:'pay2',parentId:'old-invoice'})];const p=paymentReview();return p.docs.length===1 && p.duplicateCount===1;})()`), true);
  });
  await probe('before-quit acknowledgement quits before local queued save completes', async () => {
    const vm = require('node:vm');
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const lock = main.slice(main.indexOf('function withDataLock('), main.indexOf('function validateData('));
    const quit = main.slice(main.indexOf('let quitFlushDone = false;'), main.indexOf("app.on('window-all-closed'"));
    const trace = [], events = {};
    let ack, release;
    const gate = new Promise(resolve => { release = resolve; });
    const ctx = vm.createContext({trace,gate,app:{on:(name,fn)=>{events[name]=fn},quit:()=>trace.push('app.quit')},
      ipcMain:{once:(name,fn)=>{ack=fn}},setTimeout:()=>0,win:{isDestroyed:()=>false,webContents:{send:()=>ack()}}});
    vm.runInContext('let dataQueue=Promise.resolve();' + lock + quit, ctx);
    const queued = vm.runInContext(`withDataLock(async()=>{trace.push('save started');await gate;trace.push('save completed');})`,ctx);
    await Promise.resolve();
    events['before-quit']({preventDefault(){}});
    assert.deepEqual(trace, ['save started','app.quit']);
    release(); await queued;
    assert.deepEqual(trace, ['save started','app.quit','save completed']);
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
