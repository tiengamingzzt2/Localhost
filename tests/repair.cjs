const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const backend = { require: name => name === 'node:http' ? { createServer: () => ({ listen() {} }) } : require(name), __dirname: root, process, Buffer, console };
vm.createContext(backend);
vm.runInContext(fs.readFileSync(path.join(root, 'server.js'), 'utf8') + '\nglobalThis.api={prepareRepair,analyze,dateVal,csvRows,parseFile};', backend);
const { prepareRepair, analyze, dateVal, csvRows, parseFile } = backend.api;
const upload = (text, name = 'input.csv') => ({ name, data: Buffer.from(text).toString('base64') });

function frontend(options={}) {
  const elements = new Map();
  const element = key => {
    if (/^[a-zA-Z][\w-]*$/.test(key)) key = '#' + key;
    if (!elements.has(key)) elements.set(key, {
      innerHTML: '', textContent: '', style: {}, files: [], dataset: {}, disabled: false, open: false,
      classList: { toggle() {}, remove() {}, add() {} }, handlers: {},
      addEventListener(type, fn) { const previous = this.handlers[type]; this.handlers[type] = previous ? event => { previous(event); fn(event); } : fn; }, querySelectorAll() { return []; }, querySelector(selector) {return element(key+' '+selector);},
      showModal() { this.open = true; }, close() { this.open = false; this.handlers.close?.(); },
      click() { if(!this.disabled) this.onclick?.({preventDefault(){}}); }, focus() {},
      insertAdjacentHTML(where, text) { this.innerHTML += text; }, scrollIntoView() {}, removeAttribute(name) { if(this.attributes) delete this.attributes[name]; }, setAttribute(name,value) { (this.attributes ||= {})[name]=String(value); }
    });
    return elements.get(key);
  };
  const steps=Array.from({length:4},(_,i)=>{const button=element('#workflowStep'+(i+1));button.dataset.step=String(i+1);return button;});
  class Reader {
    readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = 'data:text/csv;base64,' + Buffer.from(buffer).toString('base64'); this.onload(); }).catch(e => this.onerror(e)); }
  }
  const storage=new Map(options.storage || []);
  const ctx = { document: {documentElement:element('html'), querySelector: element, getElementById: element, querySelectorAll: selector => selector==='.step'?steps:[] },
    localStorage: { getItem: key => storage.get(key)??null, setItem(key,value) {storage.set(key,value);} }, FileReader: Reader, Blob, console, setTimeout, clearTimeout,
    window:{addEventListener(){},getSelection:()=>({isCollapsed:true})},
    matchMedia: query=>({matches:query==='(prefers-color-scheme:dark)' && !!options.systemDark,addEventListener(){}}),
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      try { const result = url === '/api/repair' ? prepareRepair(body) : analyze(body); return { ok: true, json: async () => JSON.parse(JSON.stringify(result)) }; }
      catch (error) { return { ok: false, json: async () => ({ message: error.message }) }; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/input-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/input-guide.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/theme.js'), 'utf8'), ctx);
  ctx.window.showToast=()=>{};
  vm.runInContext(fs.readFileSync(path.join(root, 'public/app.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/review.js'), 'utf8') + '\nglobalThis.review=reviewState;', ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/email.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/repair.js'), 'utf8') + '\nglobalThis.appState=state;', ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/charts.js'), 'utf8') + '\nglobalThis.charts=chartState;', ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/workspace.js'), 'utf8'), ctx);
  return { ctx, element, steps, storage };
}

test('CSV separators, aliases and valid local dates normalize without inventing missing data', () => {
  const datasets = { contracts: [upload('Mã KH;Mã HĐ;Ngày hết hạn\nKH001;HD1;31/12/2026\n;HD2;31/02/2026')] };
  const original = JSON.stringify(datasets);
  const result = prepareRepair({ datasets, mode: 'auto' });
  assert.equal(result.report.renamed, 3);
  assert.equal(result.report.dates, 1);
  assert.equal(result.files[0].rows[0].expiration_date, '2026-12-31');
  assert.equal(result.files[0].rows[1].customer_id, '');
  assert.equal(result.files[0].rows[1].expiration_date, '31/02/2026');
  assert.equal(JSON.stringify(datasets), original);
  assert.equal(csvRows('customer_id\texpiration_date\nKH001\t2026-12-31')[0].customer_id, 'KH001');
  assert.equal(csvRows('customer_id,note,expiration_date\nKH001,"a;b",2026-12-31')[0].note, 'a;b');
  assert.equal(dateVal('01/02/2026'), '2026-02-01');
  assert.equal(dateVal('2026-02-30'), null);
  assert.equal(dateVal('29/02/2024'), '2024-02-29');
  assert.equal(dateVal('99999999999'), null);
});

test('manual mapping and minor cell edits pass revalidation while the missing required cell stays blocked', async () => {
  const { ctx, element } = frontend();
  ctx.appState.datasets = { contracts: [upload('customer_id,contract_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH001,HD1,31/12/2026,10,8,0,100\nKH002,HD2,31/12/2026,10,7,0,100')] };
  await ctx.openRepair('manual');
  const draft = ctx.appState.repair.files[0];
  draft.mapping.customer_id='';
  assert.throws(() => ctx.projectRepairFile(draft), /hãy ghép cột/);
  draft.mapping.customer_id='customer_id';
  draft.rows[0].customer_id = '';
  await ctx.applyRepair();
  assert.equal(ctx.appState.step, 1);
  assert.equal(ctx.appState.clean.blocked, true);
  assert.ok(element('#stage').innerHTML.includes('Tự sửa dữ liệu'));
  assert.ok(ctx.appState.datasets.contracts.length);
  await ctx.openRepair('manual');
  const corrected = ctx.appState.repair.files[0];
  corrected.rows[0].customer_id = 'KH001';
  await ctx.applyRepair();
  assert.equal(ctx.appState.step, 2);
  assert.equal(ctx.appState.clean.rows[0].expiration_date, '2026-12-31');
  assert.ok(element('#stage').innerHTML.includes('Dữ liệu đạt'));
});

test('Agent preview requires apply; exact duplicates are removed only when selected', async () => {
  const { ctx } = frontend();
  ctx.appState.datasets = { contracts: [upload('Mã KH,Mã HĐ,Ngày hết hạn,note\nKH1,HD1,31/12/2026,a\nKH1,HD1,31/12/2026,a\nKH1,HD1,31/12/2026,b')] };
  const original = JSON.stringify(ctx.appState.datasets);
  await ctx.openRepair('auto');
  assert.equal(JSON.stringify(ctx.appState.datasets), original);
  assert.equal(ctx.appState.repair.report.exactDuplicates, 1);
  let projected = ctx.projectRepairFile(ctx.appState.repair.files[0]);
  assert.equal(projected.removed, 0);
  ctx.appState.repair.dropExact = true;
  projected = ctx.projectRepairFile(ctx.appState.repair.files[0]);
  assert.equal(projected.removed, 1);
  const result = analyze({ stage: 'clean', datasets: { contracts: [upload(projected.csv)] } });
  assert.equal(result.blocked, true, 'Same ID with different contents still requires human review');
  assert.equal(result.errorCount, 1);
});

test('15,000 rows render only 20 editor rows and one error example; untrusted values are escaped', async () => {
  const { ctx, element } = frontend();
  ctx.appState.datasets = { auto: [upload('item,note\n' + Array.from({length:15000},(_,i)=>`${i},bad`).join('\n'))] };
  await ctx.openRepair('manual');
  assert.equal((element('#repairContent').innerHTML.match(/data-cell-row=/g) || []).length, 40);
  assert.ok(element('#repairContent').innerHTML.length < 30000);
  const result = analyze({ stage: 'clean', datasets: {contracts:[upload('customer_id,expiration_date\n' + Array(15000).fill(',bad').join('\n'))]} });
  assert.equal(result.errorCount, 44999);
  assert.equal(result.errors.length, 1);
  assert.equal(result.remediation.action,'reload');
  assert.ok(ctx.errorBox(result.errors, result.errorCount,result.remediation).length < 2400);
  ctx.appState.repair.files[0].rows[0].item = '<script>alert(1)</script>';
  ctx.renderRepair();
  assert.ok(!element('#repairContent').innerHTML.includes('<script>'));
  assert.ok(element('#repairContent').innerHTML.includes('&lt;script&gt;'));
});

test('XLSX shared/inline values are read while an incomplete analytical file requires reupload', () => {
  const filename = Buffer.from('xl/worksheets/sheet1.xml');
  const xml = Buffer.from('<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>customer_id</t></is></c><c r="B1" t="inlineStr"><is><t>expiration_date</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>KH1</t></is></c><c r="B2"><v>46022</v></c></row></sheetData></worksheet>');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt32LE(xml.length, 20); central.writeUInt16LE(filename.length, 28);
  const start = local.length + filename.length + xml.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 10); end.writeUInt32LE(start, 16);
  const bytes = Buffer.concat([local, filename, xml, central, filename, end]);
  const file={name:'input.xlsx',data:bytes.toString('base64')};
  const rows=parseFile(file);
  assert.equal(rows[0].customer_id,'KH1');assert.match(dateVal(rows[0].expiration_date),/^\d{4}-\d{2}-\d{2}$/);
  assert.throws(()=>prepareRepair({mode:'auto',datasets:{contracts:[file]}}),/file gốc/);
});

test('one upload area accepts multiple files and classifies their contents, regardless of names', () => {
  const result = analyze({ stage: 'clean', datasets: { auto: [
    upload('Mã KH,Ngày hết hạn,licensed_users,plan\nKH1,31/12/2026,10,Pro', 'arbitrary-a.csv'),
    upload('customer_id,active_users,snapshot_date\nKH1,7,01/11/2026', 'arbitrary-b.csv'),
    upload('customer_id,open_tickets\nKH1,0', 'arbitrary-c.csv'),
    upload('plan,price,discount\nPro,12000000,10', 'arbitrary-d.csv')
  ] } });
  assert.equal(result.blocked, false);
  assert.equal(result.canAnalyze, true);
  assert.equal(result.rows[0].active_users, 7);
  assert.equal(result.rows[0].open_tickets, 0);
  assert.equal(result.detectedFiles.map(f=>f.kind).join(','), 'contracts,usage,support,policies');
  assert.equal(result.cleanedFiles[0].rows[0].expiration_date, '2026-12-31');
  assert.equal(result.cleaningSummary.files, 4);
});

test('unrelated sales data returns a full cleaned table and does not fabricate renewal results', () => {
  const datasets = { auto: [upload('Product,Region,Quantity\n  Widget  ,  North  ,5\nOther,South,0', 'sales_data.csv')] };
  const result = analyze({ stage: 'clean', datasets });
  assert.equal(result.blocked, false);
  assert.equal(result.canAnalyze, false);
  assert.equal(result.detectedFiles[0].kind, 'generic');
  assert.equal(result.rows.length, 0);
  assert.equal(result.cleanedFiles[0].rows[0].Product, 'Widget');
  assert.equal(result.cleanedFiles[0].rows[1].Quantity, '0');
  assert.equal(result.cleanedFiles[0].headers.join(','), 'Product,Region,Quantity');
  const deeper = analyze({ stage: 'analyze', datasets });
  assert.equal(deeper.blocked, true);
});

test('a combined contract file retains usage, support and prices in deeper analysis', () => {
  const result = analyze({ stage: 'analyze', datasets: { auto: [upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,2026-12-31,10,8,2,12000000')] } });
  assert.equal(result.blocked, false);
  assert.equal(result.rows[0].status, 'Chặn upsell');
  assert.equal(result.rows[0].adoption_rate, 80);
  assert.equal(result.rows[0].renewal_value, 12000000);
});

test('file selection immediately runs cleaning; UI has one input and a paginated generic result', async () => {
  const { ctx, element } = frontend();
  assert.equal((element('#stage').innerHTML.match(/type="file"/g)||[]).length, 1);
  assert.ok(element('#stage').innerHTML.includes('Kéo thả tệp vào đây'));
  const file = Object.assign(new Blob(['Product,Region\n' + Array.from({length:15000},(_,i)=>`Product${i},North`).join('\n')]), {name:'sales_data.csv'});
  await ctx.queueUploadFiles([file]);
  assert.equal(ctx.appState.step, 2);
  assert.equal(ctx.appState.cleanFileIndex, 0);
  assert.equal(ctx.appState.processing, false);
  assert.equal(ctx.appState.uploading, false);
  assert.ok(element('#stage').innerHTML.includes('Tải CSV đã làm sạch'));
  assert.equal((element('#stage').innerHTML.match(/<tr>/g)||[]).length, 51);
  assert.equal(element('overviewTotal').textContent, '15.000');
  assert.ok(element('#stage').innerHTML.includes('disabled title="Cần dữ liệu hợp đồng'));
  let downloaded;
  ctx.download = (content, name) => { downloaded = { content, name }; };
  ctx.downloadCleanedFile();
  assert.equal(downloaded.name, 'sales_data_lam_sach.csv');
  assert.equal(downloaded.content.split('\r\n').length, 15001);
  assert.ok(downloaded.content.includes('"Product14999","North"'));
  ctx.setStep(1);
  const replacement = Object.assign(new Blob(['Product,Region\nNew,South']), {name:'sales_data.csv'});
  await ctx.queueUploadFiles([replacement]);
  assert.equal(ctx.appState.clean.cleaningSummary.totalRows, 1);
  assert.equal(ctx.queuedFiles().length, 1);
});

function reviewFixture(ctx, count = 125) {
  const rows = Array.from({length:count},(_,i)=>({
    customer_id: 'KH'+String(i+1).padStart(3,'0'), contract_id:'HD-2026-'+String(i+1).padStart(3,'0'),
    customer_name:'Công ty Hướng Dương '+(i+1), plan:'Pro', expiration_date:'2026-12-31', outreach_date:'2026-11-16',
    adoption_rate:i%4===1?25:80, open_tickets:i%4===2?1:i%4===3?null:0,
    status:i%4===2?'Chặn upsell':i%4===3?'Cần xác minh':'Đủ căn cứ sơ bộ',
    recommendation:i%4===0?'Xem xét nâng gói':'Gia hạn gói hiện tại', renewal_value:1000000+i,
    reason:'Dữ liệu sử dụng và tình trạng hỗ trợ cần được kiểm tra.', policy_status:'Cần người duyệt chính sách'
  }));
  ctx.appState.analysis={rows,warnings:[],summary:{total:count,blocked:rows.filter(r=>r.open_tickets>0).length,needs_review:rows.filter(r=>r.open_tickets==null).length,renewal_value:rows.reduce((n,r)=>n+r.renewal_value,0),value_count:count}};
  ctx.resetReview(); ctx.setStep(3); return rows;
}

test('review uses composite primary keys, searches both IDs and retains selection across pages and filters', () => {
  const {ctx,element}=frontend(), rows=reviewFixture(ctx);
  rows[1].customer_id=rows[0].customer_id;
  ctx.selectReviewRows([rows[0]],true);
  assert.equal(ctx.selectedReviewRows().length,1, 'Same customer with a different contract is a different selection');
  ctx.review.page=2;
  assert.equal(ctx.reviewPageRows().length,25);
  ctx.selectReviewRows([rows[120]],true);
  ctx.review.query=rows[0].customer_id.toLowerCase();
  assert.equal(ctx.reviewFilteredRows().length,2);
  ctx.review.query=rows[0].contract_id.toLowerCase();
  assert.equal(ctx.reviewFilteredRows().length,1);
  assert.equal(ctx.selectedReviewRows().length,2);
  assert.ok(ctx.reviewSelectionSummary().includes('1 hồ sơ đã chọn nằm ngoài bộ lọc'));
  ctx.review.query='HUONG DUONG'; ctx.review.filter='upgrade';
  assert.ok(ctx.reviewFilteredRows().every(r=>r.recommendation==='Xem xét nâng gói'));
  ctx.selectReviewRows(ctx.reviewFilteredRows(),true);
  const selectedKeys=new Set(ctx.selectedReviewRows().map(ctx.reviewKey));
  rows.reverse();
  assert.equal(ctx.selectedReviewRows().map(ctx.reviewKey).filter(k=>selectedKeys.has(k)).length,selectedKeys.size);
  ctx.refreshReviewTable();
  assert.ok(element('#reviewTableHost').innerHTML.includes('data-review-key='));
});

test('review shows distinct tiers, evidence and adoption bars, and caps each table at 50 rows', () => {
  const {ctx}=frontend(); reviewFixture(ctx);
  const html=ctx.reviewTable();
  for (const type of ['upgrade','renew','blocked','verify']) assert.ok(html.includes('proposal-'+type));
  assert.equal((html.match(/<tr[ >]/g)||[]).length,51);
  assert.ok(html.includes('adoption-track'));
  assert.ok(html.includes('Xem căn cứ'));
  assert.equal(ctx.reviewGroup({status:'Đủ căn cứ sơ bộ',adoption_rate:90,open_tickets:0,renewal_value:null,recommendation:'Xem xét nâng gói'}),'verify');
  ctx.review.query='<script>';
  assert.ok(ctx.reviewTable().includes('Không có hồ sơ khớp'));
  assert.ok(!ctx.reviewWorkspace().includes('value="<script>'));
});

test('final review and exports include only explicit selections, including hidden selected rows', () => {
  const {ctx,element}=frontend(), rows=reviewFixture(ctx,10);
  assert.equal(element('#reviewOutput').disabled,true);
  element('#analysisFeedback').value='Kiểm tra nhóm đã chọn';
  ctx.transferReviewSelection(); assert.equal(ctx.appState.step,3);
  ctx.selectReviewRows([rows[1],rows[5],rows[9]],true); ctx.syncReviewActions();
  assert.equal(element('#reviewOutput').disabled,false);
  ctx.transferReviewSelection();
  assert.equal(ctx.appState.step,4); assert.equal(ctx.reviewBaseRows().length,3);
  ctx.selectReviewRows([rows[5]],false);
  ctx.review.query=rows[1].contract_id;
  let exportedHtml;
  ctx.download=content=>{exportedHtml=content;};
  ctx.exportHtml(ctx.selectedReviewRows());
  assert.ok(exportedHtml.includes('<th>Hợp đồng</th>'));
  assert.ok(exportedHtml.includes('<td>'+rows[9].contract_id+'</td>'));
  assert.ok(!exportedHtml.includes('<td>'+rows[0].contract_id+'</td>'));
  let csvRows,htmlRows;
  ctx.exportCsv=rows=>{csvRows=rows.map(ctx.reviewKey);};
  ctx.exportHtml=rows=>{htmlRows=rows.map(ctx.reviewKey);};
  ctx.exportReviewSelection('csv');
  assert.equal(ctx.review.approved.size,2);
  assert.equal(ctx.reviewBaseRows().length,1);
  assert.equal(ctx.selectedReviewRows().length,0);
  ctx.setReviewView('approved');
  ctx.selectReviewRows(ctx.reviewBaseRows(),true);
  ctx.exportReviewSelection('html');
  assert.equal(csvRows.length,2); assert.equal(htmlRows.length,2);
  assert.ok(csvRows.includes(ctx.reviewKey(rows[9])), 'Selected records hidden by search are included as indicated');
  assert.ok(!csvRows.includes(ctx.reviewKey(rows[5])));
  assert.ok(!csvRows.includes(ctx.reviewKey(rows[0])));
  ctx.review.selected.clear(); ctx.syncReviewActions();
  assert.equal(element('#exportCsv').disabled,true); assert.equal(element('#exportHtml').disabled,true);
  csvRows=null; ctx.exportReviewSelection('csv'); assert.equal(csvRows,null);
});

test('a fresh analysis clears previous selections and approval scope', async () => {
  const {ctx}=frontend(), rows=reviewFixture(ctx,4);
  ctx.selectReviewRows([rows[0]],true); ctx.review.finalKeys=new Set([ctx.reviewKey(rows[0])]);
  ctx.review.approved.add(ctx.reviewKey(rows[0]));
  ctx.appState.datasets={auto:[upload('customer_id,contract_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,HD1,2026-12-31,10,8,0,12000000')]};
  await ctx.runAnalysis();
  assert.equal(ctx.appState.step,3);
  assert.equal(ctx.review.selected.size,0); assert.equal(ctx.review.finalKeys,null);
  assert.equal(ctx.review.approved.size,0); assert.equal(ctx.review.view,'pending');
});

test('clicking an active group toggles it off; all/reset buttons preserve selection and reset pagination', () => {
  const {ctx,element}=frontend(), rows=reviewFixture(ctx);
  ctx.selectReviewRows([rows[0],rows[120]],true);
  const click = attributes => {
    const button = { disabled:false, dataset:{}, hasAttribute:name=>Object.hasOwn(attributes,name) };
    for (const [name,value] of Object.entries(attributes)) button.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = value;
    element('#stage').handlers.click({ target:{ closest:selector=>Object.keys(attributes).some(name=>selector.includes('['+name+']')) ? button : null } });
  };
  for (const group of ['upgrade','renew','blocked','verify']) {
    ctx.review.page=2;
    click({'data-review-filter':group});
    assert.equal(ctx.review.filter,group); assert.equal(ctx.review.page,0);
    assert.ok(ctx.reviewFilteredRows().every(row=>ctx.reviewGroup(row)===group));
    click({'data-review-filter':group});
    assert.equal(ctx.review.filter,'all'); assert.equal(ctx.reviewFilteredRows().length,125);
    assert.equal(ctx.selectedReviewRows().length,2);
  }
  ctx.review.query='KH001';
  click({'data-review-filter':'upgrade'}); click({'data-review-filter':'upgrade'});
  assert.equal(ctx.review.query,'KH001', 'Toggle only removes the group filter');
  click({'data-review-filter':'blocked'}); click({'data-review-filter':'all'});
  assert.equal(ctx.review.filter,'all'); assert.equal(ctx.review.query,'KH001');
  click({'data-review-filter':'renew'}); click({'data-review-reset-filters':''});
  assert.equal(ctx.review.filter,'all'); assert.equal(ctx.review.query,''); assert.equal(ctx.selectedReviewRows().length,2);
  ctx.review.finalKeys=new Set(rows.slice(0,4).map(ctx.reviewKey)); ctx.setStep(4);
  click({'data-review-filter':'upgrade'}); click({'data-review-filter':'upgrade'});
  assert.equal(ctx.review.filter,'all'); assert.equal(ctx.reviewFilteredRows().length,4);
});

test('approval without export hides only approved composite keys from both pending queues', () => {
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,10);
  rows[1].customer_id=rows[0].customer_id;
  ctx.selectReviewRows([rows[0],rows[8]],true);
  element('#analysisFeedback').value='';
  ctx.transferReviewSelection();
  let downloads=0;ctx.download=()=>{downloads++;};
  ctx.approveReviewSelection();
  assert.equal(downloads,0);
  assert.equal(ctx.review.approved.size,2);
  assert.equal(ctx.reviewBaseRows().length,0);
  assert.ok(ctx.reviewTable().includes('Đã xử lý hết hồ sơ'));
  assert.ok(element('#reviewWorkspace').outerHTML.includes('✓ Đã duyệt <b>2</b>'));
  assert.equal(element('#approveSelected').disabled,true);
  element('#backAnalysis').onclick();
  assert.equal(ctx.appState.step,3);
  assert.equal(ctx.reviewBaseRows().length,8);
  assert.ok(ctx.reviewBaseRows().includes(rows[1]),'Another contract for the same customer remains pending');
  assert.ok(!ctx.reviewBaseRows().includes(rows[0]));
  ctx.setReviewView('approved');
  assert.equal(ctx.reviewBaseRows().length,2);
  ctx.selectReviewRows([rows[0]],true);
  ctx.exportCsv=records=>{downloads=records.length;};
  ctx.exportReviewSelection('csv');
  assert.equal(downloads,1);
  assert.equal(ctx.review.approved.size,2);
  ctx.setReviewView('pending');
  assert.equal(ctx.reviewBaseRows().length,8);
});

test('failed export does not approve or hide records; approval is scoped to selected final records', () => {
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,5);
  element('#analysisFeedback').value='';
  ctx.selectReviewRows([rows[0],rows[1],rows[2]],true);ctx.transferReviewSelection();
  ctx.selectReviewRows([rows[2]],false);
  ctx.exportCsv=()=>{throw new Error('Export unavailable');};
  assert.throws(()=>ctx.exportReviewSelection('csv'),/Export unavailable/);
  assert.equal(ctx.review.approved.size,0);assert.equal(ctx.reviewBaseRows().length,3);
  ctx.approveReviewSelection();
  assert.equal(ctx.review.approved.size,2);assert.equal(ctx.reviewBaseRows().length,1);
  assert.equal(ctx.reviewBaseRows()[0],rows[2]);
  element('#backAnalysis').onclick();
  assert.equal(ctx.reviewBaseRows().length,3);
});

test('dashboard counts, values and workflow progress follow 50 records through final approval and archive', () => {
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,50);
  assert.equal(element('#overviewTotal').textContent,'50');
  assert.equal(element('#overviewTotalLabel').textContent,'Hồ sơ chờ duyệt');
  assert.equal(element('#stepCount3').textContent,'50 chờ');
  assert.equal(element('#stepCount4').textContent,'👤 Cần duyệt (50)');
  assert.equal(element('#valueProgress').style.width,'0%');
  const seven=rows.slice(0,7);
  ctx.selectReviewRows(seven,true);ctx.syncReviewActions();
  assert.equal(element('#overviewTotal').textContent,'50','Selecting records is not yet a workflow transition');
  element('#analysisFeedback').value='';ctx.transferReviewSelection();
  assert.equal(element('#overviewTotal').textContent,'7');
  assert.equal(element('#overviewTotalLabel').textContent,'Hồ sơ chờ duyệt cuối');
  assert.equal(element('#overviewValue').textContent,ctx.money(seven.reduce((n,r)=>n+r.renewal_value,0)));
  ctx.approveReviewSelection();
  assert.equal(element('#overviewTotal').textContent,'0');
  assert.equal(element('#overviewValue').textContent,ctx.money(0));
  assert.ok(Math.abs(parseFloat(element('#valueProgress').style.width)-14)<1e-8);
  assert.equal(element('#overviewProgress').attributes['aria-valuenow'],'7');
  assert.equal(element('#overviewProgress').attributes['aria-valuemax'],'50');
  assert.equal(element('#stepCount4').textContent,'7/50 duyệt');
  element('#backAnalysis').onclick();
  assert.equal(element('#overviewTotal').textContent,'43');
  assert.equal(element('#stepCount3').textContent,'✓ Đã chuyển');
  assert.equal(element('#overviewValue').textContent,ctx.money(rows.slice(7).reduce((n,r)=>n+r.renewal_value,0)));
  assert.equal(element('#reviewContextTotal').textContent,'43 hồ sơ chờ duyệt');
  assert.equal(element('#overviewReview').textContent,String(rows.slice(7).filter(r=>ctx.reviewGroup(r)==='verify').length));
  ctx.setReviewView('approved');
  assert.equal(element('#overviewTotal').textContent,'7');
  assert.equal(element('#overviewTotalLabel').textContent,'Hồ sơ đã duyệt');
  assert.equal(element('#overviewValue').textContent,ctx.money(seven.reduce((n,r)=>n+r.renewal_value,0)));
  ctx.review.filter='upgrade';ctx.refreshReviewWorkspace();
  const filtered=seven.filter(r=>ctx.reviewGroup(r)==='upgrade');
  assert.equal(element('#overviewTotal').textContent,String(filtered.length));
  assert.ok(element('#overviewTotalNote').textContent.includes('Đang lọc'));
  assert.equal(element('#overviewValue').textContent,ctx.money(filtered.reduce((n,r)=>n+r.renewal_value,0)));
  assert.ok(Math.abs(parseFloat(element('#valueProgress').style.width)-14)<1e-8,'Filtering does not change approval progress');
});

test('dashboard uses clean-stage data, preserves zero prices and distinguishes prices that are missing', () => {
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,4);
  ctx.appState.datasets={auto:[upload('customer_id,expiration_date\nKH1,2026-12-31')]};
  ctx.appState.clean={blocked:false,rows:rows.slice(0,2),warnings:[{row:1,customer_id:rows[0].customer_id},{row:1,customer_id:rows[0].customer_id}],cleanedFiles:[],cleaningSummary:{files:1,totalRows:2}};
  ctx.setStep(2);
  assert.equal(element('#overviewTotal').textContent,'2');
  assert.equal(element('#overviewReview').textContent,'1');
  assert.equal(element('#overviewValue').textContent,'—','Returning to clean review does not reuse analysis metrics');
  assert.equal(element('#stepCount1').textContent,'✓ 1 tệp');
  assert.equal(element('#stepCount2').textContent,'👤 Cần duyệt (2)');
  rows[0].renewal_value=0;rows[1].renewal_value=null;
  ctx.setStep(3);ctx.review.query=rows[0].contract_id;ctx.refreshReviewTable();
  assert.equal(element('#overviewValue').textContent,ctx.money(0));
  assert.ok(element('#overviewValueNote').textContent.startsWith('1 / 1'));
  ctx.review.query=rows[1].contract_id;ctx.refreshReviewTable();
  assert.equal(element('#overviewValue').textContent,'Chưa đủ căn cứ');
  assert.equal(element('#overviewReview').textContent,'1');
});

test('workflow buttons enforce prerequisites and navigate stored results without rerunning the Agent', async () => {
  const {ctx,element,steps}=frontend();
  let calls=0;const fetch=ctx.fetch;ctx.fetch=async(...args)=>{calls++;return fetch(...args);};
  const click=step=>element('#steps').handlers.click({target:{closest:()=>steps[step-1]}});
  assert.equal(steps[0].disabled,false);assert.equal(steps[1].disabled,true);assert.equal(steps[2].disabled,true);assert.equal(steps[3].disabled,true);
  assert.equal(ctx.navigateStep(3),false);assert.equal(ctx.appState.step,1);
  const file=Object.assign(new Blob(['customer_id,contract_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,HD1,2026-12-31,10,8,0,12000000\nKH2,HD2,2026-12-31,10,5,0,6000000']),{name:'nav.csv'});
  await ctx.queueUploadFiles([file]);
  assert.equal(ctx.appState.step,2);assert.equal(steps[1].disabled,false);assert.equal(steps[2].disabled,true);
  click(3);assert.equal(ctx.appState.step,2);assert.equal(calls,1,'A step link does not bypass the data approval action');
  element('#cleanFeedback').value='Giữ lại trường gốc';
  click(1);assert.equal(ctx.appState.step,1);click(2);assert.equal(ctx.appState.step,2);
  assert.ok(element('#stage').innerHTML.includes('Giữ lại trường gốc'));
  await ctx.runAnalysis();assert.equal(calls,2);assert.equal(steps[2].disabled,false);assert.equal(steps[3].disabled,true);
  const rows=ctx.appState.analysis.rows;
  element('#analysisFeedback').value='Theo dõi hồ sơ này';element('#leadDays').value='30';element('#threshold').value='75';
  ctx.selectReviewRows(rows,true);ctx.syncReviewActions();assert.equal(steps[3].disabled,false);
  click(4);assert.equal(ctx.appState.step,4);assert.equal(ctx.review.finalKeys.size,2);
  assert.equal(ctx.appState.drafts.analysis,'Theo dõi hồ sơ này');
  element('#finalFeedback').value='Chưa chốt ưu đãi';
  ctx.selectReviewRows([rows[1]],false);
  click(1);click(2);click(3);
  assert.equal(ctx.review.approved.size,0);assert.equal(ctx.review.selected.size,1);
  assert.ok(element('#stage').innerHTML.includes('Theo dõi hồ sơ này'));
  assert.ok(element('#stage').innerHTML.includes('value="30"'));
  assert.equal(ctx.appState.leadDays,45,'Unapplied parameter drafts do not change calculated results');
  click(4);assert.equal(ctx.review.finalKeys.size,2,'Reopening a saved final queue does not shrink it to the current checkbox selection');
  assert.ok(element('#stage').innerHTML.includes('Chưa chốt ưu đãi'));
  ctx.approveReviewSelection();assert.equal(ctx.review.approved.size,1);
  click(1);click(3);assert.equal(ctx.reviewBaseRows().length,1);
  click(4);assert.equal(ctx.reviewBaseRows().length,1);ctx.selectReviewRows(ctx.reviewBaseRows(),true);ctx.approveReviewSelection();
  click(3);click(4);assert.equal(ctx.review.view,'approved');assert.equal(ctx.reviewBaseRows().length,2);
  assert.equal(calls,2,'Viewing existing steps does not invoke cleaning or analysis again');
  assert.equal(steps[3].attributes['aria-current'],'step');assert.equal(steps[2].attributes['aria-current'],undefined);
});

test('workflow navigation is locked during processing and cannot enter clean review after validation errors', () => {
  const {ctx,element,steps}=frontend();reviewFixture(ctx,5);
  ctx.appState.clean={blocked:true,errors:[{message:'Thiếu mã'}],errorCount:1};
  ctx.updateDashboard();assert.equal(steps[1].disabled,true);assert.equal(ctx.navigateStep(2),false);
  const previous=ctx.appState.step;
  ctx.appState.processing=true;ctx.updateDashboard();
  assert.ok(steps.every(step=>step.disabled));
  element('#steps').handlers.click({target:{closest:()=>steps[0]}});
  assert.equal(ctx.appState.step,previous);assert.equal(ctx.navigateStep(1),false);
  ctx.appState.processing=false;ctx.updateDashboard();assert.equal(steps[0].disabled,false);
});

test('top group filters toggle and sidebar primary actions use the same selected-record approval flow', () => {
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,12);
  assert.equal(element('#sidebarFilters').hidden,true);
  assert.ok(ctx.reviewWorkspace().includes('class="top-group-card upgrade'));
  const clickFilter=group=>ctx.setReviewFilter(group);
  clickFilter('upgrade');assert.equal(ctx.review.filter,'upgrade');
  clickFilter('upgrade');assert.equal(ctx.review.filter,'all');
  ctx.selectReviewRows([rows[0],rows[1]],true);ctx.syncReviewActions();
  assert.equal(element('#sidebarPrimary').dataset.target,'reviewOutput');
  assert.equal(element('#sidebarPrimary').disabled,false);
  element('#analysisFeedback').value='';element('#sidebarPrimary').click();
  assert.equal(ctx.appState.step,4);
  assert.equal(element('#sidebarPrimary').dataset.target,'approveSelected');
  element('#sidebarPrimary').click();assert.equal(ctx.review.approved.size,2);
  assert.equal(element('#sidebarApprovedCount').textContent,'2');
  element('#sidebarApproved').click();assert.equal(ctx.review.view,'approved');
  ctx.selectReviewRows([rows[0]],true);ctx.syncReviewActions();
  let downloaded;ctx.exportCsv=records=>{downloaded=records;};
  element('#sidebarPrimary').click();assert.equal(downloaded.length,1);
  assert.equal(ctx.review.approved.size,2);
});

test('compact workspace hides the hero, supports collapsible statistics and keeps audit navigation context', () => {
  const {ctx,element,steps}=frontend();reviewFixture(ctx,5);
  const page=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.ok(!page.includes('class="hero"'));
  assert.ok(page.indexOf('id="steps"')<page.indexOf('<main'));
  assert.ok(page.includes('/workspace.js'));
  element('#overviewPanel').open=true;ctx.updateWorkspaceChrome();
  element('#sidebarOverview').click();assert.equal(element('#overviewPanel').open,false);
  element('#sidebarOverview').click();assert.equal(element('#overviewPanel').open,true);
  element('#analysisFeedback').value='Lưu bản nháp trước khi xem nhật ký';
  element('.main-nav a[href="#audit"]').click();
  assert.equal(ctx.appState.step,'audit');assert.equal(ctx.appState.lastWorkflowStep,3);
  assert.equal(element('#steps').hidden,false);assert.equal(steps[2].disabled,false);
  assert.equal(ctx.appState.drafts.analysis,'Lưu bản nháp trước khi xem nhật ký');
  element('#sidebarPrimary').click();assert.equal(ctx.appState.step,3);
  assert.ok(element('#stage').innerHTML.includes('Lưu bản nháp trước khi xem nhật ký'));
});

test('feedback drawer moves existing inputs and restores their drafts without rerunning anything', () => {
  const {ctx,element}=frontend();reviewFixture(ctx,5);
  const source=element('#stage .stage-tools');let returned=false;
  const origin={isConnected:true,appendChild(node){returned=true;node.parentElement=this;}};
  source.parentElement=origin;source.remove=()=>{};
  element('#toolsDialogContent').appendChild=node=>{node.parentElement=element('#toolsDialogContent');};
  assert.equal(ctx.openWorkspaceTools(),true);assert.equal(element('#toolsDialog').open,true);
  element('#analysisFeedback').value='Kiểm tra nhóm sử dụng thấp';
  element('#leadDays').value='30';element('#threshold').value='75';
  element('#closeTools').click();
  assert.equal(returned,true);assert.equal(source.parentElement,origin);
  assert.equal(ctx.appState.drafts.analysis,'Kiểm tra nhóm sử dụng thấp');
  assert.equal(ctx.appState.drafts.analysisParams.leadDays,'30');
  assert.equal(ctx.appState.leadDays,45);
  assert.equal(ctx.appState.analysis.rows.length,5);
});

test('chart presets use actual analysis totals and approval sources update without altering review', () => {
  const {ctx}=frontend(),rows=reviewFixture(ctx,50);
  const presets=ctx.chartPresets();
  assert.equal(presets.length,3);
  const pie=ctx.aggregateChart(presets[0]);
  assert.equal(pie.error,'');assert.equal(pie.series.length,4);
  assert.equal(pie.series.reduce((n,g)=>n+g.value,0),50);
  const line=ctx.aggregateChart(presets[1]);
  assert.equal(line.error,'');assert.equal(line.series.length,1);
  assert.equal(line.series[0].value,rows.reduce((n,r)=>n+r.renewal_value,0));
  const approved={...presets[1],source:'analysis:approved'};
  assert.equal(ctx.aggregateChart(approved).error,'');assert.equal(ctx.aggregateChart(approved).series.length,0);
  ctx.review.approved.add(ctx.reviewKey(rows[0]));
  assert.equal(ctx.aggregateChart(approved).series[0].value,rows[0].renewal_value);
  assert.equal(ctx.chartSources().find(s=>s.id==='analysis:pending').rows.length,49);
  assert.equal(ctx.review.selected.size,0);
});

test('chart aggregation skips invalid numbers, keeps real zeros and computes weighted merged averages', () => {
  const {ctx}=frontend();
  ctx.appState.clean={cleanedFiles:[{name:'sales.csv',headers:['team','amount'],rows:[
    {team:'A',amount:0},{team:'A',amount:10},{team:'A',amount:''},{team:'B',amount:-4},{team:'B',amount:2},{team:'B',amount:'bad'}
  ]}]};
  const config={source:'clean:0',type:'bar',group:'team',metric:'avg',value:'amount',grain:'value'};
  let result=ctx.aggregateChart(config);
  assert.equal(result.error,'');assert.equal(result.missingValues,2);
  assert.equal(result.series.find(g=>g.label==='A').value,5);
  assert.equal(result.series.find(g=>g.label==='B').value,-1);
  for(const v of ['',null,true,Infinity,'1,200','<script>'])assert.equal(ctx.chartNumber(v),null);
  assert.ok(ctx.aggregateChart({...config,type:'pie'}).error);
  assert.ok(ctx.aggregateChart({...config,type:'pie',metric:'sum'}).error);
  const records=Array.from({length:15},(_,i)=>({team:'T'+i,amount:15-i}));
  records.push({team:'T14',amount:1});ctx.appState.clean.cleanedFiles[0].rows=records;
  result=ctx.aggregateChart(config);
  assert.equal(result.series.length,12);
  const other=result.series.at(-1);
  assert.equal(other.label,'Nhóm còn lại (4)');assert.equal(other.rows,5);assert.equal(other.value,11/5);
  const summed=ctx.aggregateChart({...config,metric:'sum'});
  assert.equal(summed.series.reduce((n,g)=>n+g.value,0),121);
  records.push({team:'Negative',amount:-0.5});
  assert.ok(ctx.aggregateChart({...config,type:'pie',metric:'sum'}).error,'Grouping small categories must not hide negative slices');
});

test('line charts sort valid dates, disclose truncation and produce finite escaped SVG', () => {
  const {ctx}=frontend();
  const rows=Array.from({length:28},(_,i)=>({date:'2026-01-'+String(i+1).padStart(2,'0'),amount:0})).reverse();
  rows.push({date:'31/02/2026',amount:8});
  ctx.appState.clean={cleanedFiles:[{name:'time.csv',headers:['date','amount'],rows}]};
  const config={source:'clean:0',type:'line',group:'date',metric:'sum',value:'amount',grain:'day',title:'<script>alert("x")</script>'};
  const result=ctx.aggregateChart(config);
  assert.equal(result.error,'');assert.equal(result.missingDates,1);assert.equal(result.series.length,24);
  assert.equal(result.series[0].label,'2026-01-05');assert.equal(result.series.at(-1).label,'2026-01-28');
  assert.ok(result.note.includes('4 nhóm trước'));
  const svg=ctx.chartSvg(config,result);
  assert.ok(svg.startsWith('<svg'));assert.ok(!/NaN|Infinity|<script>/.test(svg));assert.ok(svg.includes('&lt;script&gt;'));
  assert.equal(ctx.chartDate('29/02/2024'),'2024-02-29');assert.equal(ctx.chartDate('29/02/2026'),null);
  rows.splice(0,rows.length,{date:'A',amount:1e308},{date:'B',amount:-1e308});
  assert.ok(ctx.aggregateChart({...config,grain:'value'}).error);
});

test('dashboard saves independent charts, limits six and exports valid SVG', () => {
  const {ctx}=frontend();reviewFixture(ctx,8);
  ctx.charts.config=ctx.chartPresets()[0];
  assert.equal(ctx.saveChartConfig(),true);
  ctx.charts.config.type='bar';assert.equal(ctx.charts.saved[0].type,'pie');
  for(let i=0;i<5;i++)assert.equal(ctx.saveChartConfig(),true);
  assert.equal(ctx.saveChartConfig(),false);assert.equal(ctx.charts.saved.length,6);
  let downloaded;ctx.download=(...args)=>{downloaded=args;};
  assert.equal(ctx.downloadChartSvg({...ctx.charts.saved[0],title:'Test: / Dashboard'}),true);
  assert.ok(downloaded[0].includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(downloaded[1].endsWith('.svg'));assert.ok(!downloaded[1].includes('/'));
  assert.equal(downloaded[2],'image/svg+xml;charset=utf-8');
  ctx.resetChartWorkspace();assert.equal(ctx.charts.saved.length,0);assert.equal(ctx.charts.config,null);
});

test('dashboard sidebar preserves workflow drafts and offers upload when no data exists', () => {
  const {ctx,element}=frontend();
  element('#sidebarCharts').click();assert.equal(ctx.appState.step,'dashboard');
  assert.ok(element('#stage').innerHTML.includes('Chưa có dữ liệu để vẽ'));
  element('#sidebarPrimary').click();assert.equal(ctx.appState.step,1);
  reviewFixture(ctx,5);element('#analysisFeedback').value='Giữ bản nháp';
  element('#sidebarCharts').click();
  assert.equal(ctx.appState.lastWorkflowStep,3);assert.equal(ctx.appState.drafts.analysis,'Giữ bản nháp');
  assert.ok(element('#stage').innerHTML.includes('data-chart-field="type"'));
  assert.equal(element('#overviewTotal').textContent,'5');
  assert.equal(element('#overviewProgress').hidden,true);
  element('#sidebarPrimary').click();assert.equal(ctx.appState.step,3);
  assert.equal(element('#overviewProgress').hidden,false);
  assert.equal(ctx.appState.drafts.analysis,'Giữ bản nháp');
  ctx.appState.processing=true;ctx.updateDashboard();element('#sidebarCharts').click();assert.equal(ctx.appState.step,3);
});

test('theme control persists mode without rerendering workflow or losing selections and drafts',()=>{
  const {ctx,element,storage}=frontend(),rows=reviewFixture(ctx,5);
  element('#analysisFeedback').value='Giữ nội dung đang nhập';ctx.review.selected.add(ctx.reviewKey(rows[0]));
  const stage=element('#stage').innerHTML;
  assert.equal(element('html').dataset.theme,'light');
  element('#themeToggle').click();
  assert.equal(element('html').dataset.theme,'dark');assert.equal(element('html').style.colorScheme,'dark');
  assert.equal(element('#themeToggle').attributes['aria-checked'],'true');assert.equal(element('#themeStatus').textContent,'Đang bật');
  assert.equal(storage.get('an-tin-workspace-theme'),'dark');
  assert.equal(element('#stage').innerHTML,stage);assert.equal(ctx.appState.step,3);assert.equal(ctx.review.selected.size,1);
  assert.equal(element('#analysisFeedback').value,'Giữ nội dung đang nhập');
  const reload=frontend({storage:[...storage]});assert.equal(reload.element('html').dataset.theme,'dark');
  element('#themeToggle').click();assert.equal(element('html').dataset.theme,'light');
  assert.equal(element('#themeToggle').attributes['aria-checked'],'false');assert.equal(storage.get('an-tin-workspace-theme'),'light');
});

test('theme respects system preference, explicit choice, reduced motion and unavailable storage',()=>{
  assert.equal(frontend({systemDark:true}).element('html').dataset.theme,'dark');
  assert.equal(frontend({systemDark:true,storage:[['an-tin-workspace-theme','light']]}).element('html').dataset.theme,'light');
  const {ctx,element}=frontend({storage:[['an-tin-workspace-theme','invalid']]});
  assert.equal(element('html').dataset.theme,'light');
  const toggles=[];element('html').classList.toggle=(...args)=>toggles.push(args);
  ctx.matchMedia=()=>({matches:true});ctx.localStorage={getItem(){throw Error('Disabled');},setItem(){throw Error('Disabled');}};
  assert.doesNotThrow(()=>ctx.applyWorkspaceTheme('dark',{persist:true,animate:true}));
  assert.equal(element('html').dataset.theme,'dark');assert.equal(toggles.at(-1)[1],false);
  ctx.applyWorkspaceTheme('invalid');assert.equal(element('html').dataset.theme,'dark');
  const page=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.ok(page.indexOf('/theme.js')<page.indexOf('/styles.css'),'Theme preference applies before first paint');
  assert.ok(page.indexOf('id="themeToggle"')>page.indexOf('href="#audit"'),'Switch is last in the Tools menu');
});

test('clicking contract row selects once, keeps table nodes and respects nested controls and processing lock',()=>{
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,5),key=ctx.reviewKey(rows[0]);
  const stage=element('#stage'),table=element('#reviewTableHost'),originalTable=table.innerHTML;
  let selectedClass=false,clicks=0;
  const row={classList:{toggle(name,checked){selectedClass=checked;}},querySelector:()=>checkbox};
  const checkbox={checked:false,disabled:false,dataset:{reviewKey:key},
    matches:selector=>selector==='[data-review-key]',
    closest:selector=>selector==='tr.proposal-row'?row:selector.startsWith('input,')?checkbox:null,
    click(){clicks++;this.checked=!this.checked;stage.handlers.click({target:this,button:0});stage.handlers.change({target:this});}
  };
  const queryAll=ctx.document.querySelectorAll;
  ctx.document.querySelectorAll=selector=>selector==='.review-table [data-review-key]'?[checkbox]:queryAll(selector);
  const target={closest:selector=>selector==='tr.proposal-row'?row:null};
  const click=()=>stage.handlers.click({target,button:0});
  click();assert.equal(clicks,1);assert.equal(ctx.review.selected.has(key),true);assert.equal(checkbox.checked,true);assert.equal(selectedClass,true);
  assert.equal(table.innerHTML,originalTable,'Selecting must not rebuild the table or reset scroll/evidence');
  assert.ok(element('#reviewSelectionSummary').innerHTML.includes('Đã chọn 1 / 5'));
  assert.equal(element('#reviewSelectPage').indeterminate,true);
  click();assert.equal(clicks,2);assert.equal(ctx.review.selected.size,0);assert.equal(selectedClass,false);
  checkbox.click();assert.equal(clicks,3);assert.equal(ctx.review.selected.size,1,'Native checkbox must not be toggled again by row');
  for(const control of ['summary','details','button','a','label']){
    stage.handlers.click({target:{closest:selector=>selector==='tr.proposal-row'?row:selector.startsWith('input,')?{tagName:control}:null},button:0});
    assert.equal(clicks,3,control+' retains its own behavior');
  }
  ctx.appState.processing=true;click();assert.equal(clicks,3);ctx.appState.processing=false;
  ctx.appState.uploading=true;click();assert.equal(clicks,3);ctx.appState.uploading=false;
  ctx.window={getSelection:()=>({isCollapsed:false})};click();assert.equal(clicks,3,'Dragging to select text must not toggle a contract');
  delete ctx.window;
  ctx.selectReviewRows(rows,true);ctx.refreshReviewSelection();assert.equal(element('#reviewSelectPage').checked,true);assert.equal(element('#reviewSelectPage').indeterminate,false);
  ctx.selectReviewRows(rows,false);ctx.refreshReviewSelection();assert.equal(element('#reviewSelectPage').checked,false);
});

test('theme reveal starts at the switch, covers the viewport and changes data only inside the snapshot callback',async()=>{
  const {ctx,element,storage}=frontend(),root=element('html'),classes=new Set();
  root.classList.add=(...names)=>names.forEach(name=>classes.add(name));
  root.classList.remove=(...names)=>names.forEach(name=>classes.delete(name));
  ctx.window={innerWidth:1280,innerHeight:720};
  element('#themeToggle').querySelector=()=>({getBoundingClientRect:()=>({left:100,top:600,width:32,height:18})});
  let commit,finish,animation,starts=0;
  root.animate=(frames,options)=>{animation={frames,options};};
  ctx.document.startViewTransition=update=>{
    starts++;commit=update;
    return {ready:Promise.resolve(),finished:new Promise(resolve=>{finish=resolve;}),skipTransition(){}};
  };
  const stage=element('#stage').innerHTML;
  const done=ctx.applyWorkspaceTheme('dark',{persist:true,animate:true});
  assert.equal(root.dataset.theme,'light','Old screenshot keeps the old theme until captured');
  assert.equal(classes.has('theme-revealing'),true);
  element('#themeToggle').click();assert.equal(starts,1,'Repeated clicks do not start overlapping snapshots');
  commit();await Promise.resolve();
  assert.equal(root.dataset.theme,'dark');assert.equal(storage.get('an-tin-workspace-theme'),'dark');
  assert.equal(element('#stage').innerHTML,stage);
  assert.equal(animation.options.duration,1100);
  assert.equal(animation.options.pseudoElement,'::view-transition-new(root)');
  assert.equal(animation.frames.clipPath[0],'circle(0px at 116px 609px)');
  const radius=Number(animation.frames.clipPath[1].match(/circle\((\d+)px/)[1]);
  assert.ok(radius>Math.hypot(1280-116,609),'Reveal must reach the farthest viewport corner');
  finish();await done;
  assert.equal(classes.has('theme-revealing'),false);
});

test('interrupted and unavailable snapshot transitions still apply the newest theme',async()=>{
  const {ctx,element,storage}=frontend(),root=element('html');
  ctx.window={innerWidth:1000,innerHeight:600};root.animate=()=>{};
  let oldCommit,finish,skipped=0;
  ctx.document.startViewTransition=commit=>{oldCommit=commit;return {ready:Promise.resolve(),finished:new Promise(resolve=>finish=resolve),skipTransition(){skipped++;}};};
  const done=ctx.applyWorkspaceTheme('dark',{persist:true,animate:true});
  ctx.applyWorkspaceTheme('light',{persist:true});
  oldCommit();finish();await done;
  assert.equal(skipped,1);assert.equal(root.dataset.theme,'light');assert.equal(storage.get('an-tin-workspace-theme'),'light');
  ctx.document.startViewTransition=()=>{throw Error('Unavailable');};
  assert.doesNotThrow(()=>ctx.applyWorkspaceTheme('dark',{persist:true,animate:true}));
  assert.equal(root.dataset.theme,'dark');assert.equal(storage.get('an-tin-workspace-theme'),'dark');
  ctx.applyWorkspaceTheme('light');
});

test('review filters update only results and keep controls, focus context, selection and scroll stable',()=>{
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,12);
  const stage=element('#stage'),workspace=element('#reviewWorkspace'),search=element('#reviewSearch');
  workspace.outerHTML='Existing controls';search.value='Draft search';stage.scrollTop=215;
  const table=element('#reviewTableHost .review-table-wrap');table.scrollTop=140;table.scrollLeft=160;
  let content='',replaced=0;
  Object.defineProperty(element('#reviewTableHost'),'innerHTML',{get:()=>content,set:value=>{content=value;replaced++;stage.scrollTop=0;}});
  const buttons=['all','upgrade','renew','blocked','verify'].map(group=>{const button=element('#filter-'+group);button.dataset.reviewFilter=group;return button;});
  const urgency=['all','danger','warning','safe'].map(group=>{const button=element('#urgency-'+group);button.dataset.urgencyFilter=group;return button;});
  const queryAll=ctx.document.querySelectorAll;
  ctx.document.querySelectorAll=selector=>selector==='#reviewWorkspace [data-review-filter]'?buttons:selector==='#reviewWorkspace [data-urgency-filter]'?urgency:queryAll(selector);
  let animationCount=0;ctx.animateWorkspaceTransition=()=>animationCount++;
  ctx.review.selected.add(ctx.reviewKey(rows[1]));
  ctx.setReviewFilter('upgrade');
  assert.equal(replaced,1);assert.equal(workspace.outerHTML,'Existing controls');assert.equal(search.value,'Draft search');
  assert.equal(stage.scrollTop,215);assert.equal(table.scrollTop,0);assert.equal(table.scrollLeft,160);
  assert.equal(buttons[1].attributes['aria-pressed'],'true');assert.equal(buttons[0].attributes['aria-pressed'],'false');
  assert.equal(ctx.review.selected.size,1);assert.equal(ctx.reviewFilteredRows().length,3);assert.equal(animationCount,0);
  ctx.setUrgencyFilter('danger');assert.equal(urgency[1].attributes['aria-pressed'],'true');
  assert.equal(workspace.outerHTML,'Existing controls');assert.equal(stage.scrollTop,215);
  ctx.setReviewFilter('upgrade');ctx.setUrgencyFilter('all');
  assert.equal(ctx.reviewFilteredRows().length,12);assert.equal(ctx.review.selected.size,1);assert.equal(animationCount,0);
  table.scrollTop=85;ctx.refreshReviewTable();assert.equal(table.scrollTop,85);assert.equal(table.scrollLeft,160);
});

test('workspace transitions use a subtle fade without translating or dimming the page',()=>{
  const {ctx,element}=frontend();let animation,cancelled=0;
  element('#stage').animate=(frames,options)=>{animation={frames,options};return {cancel(){cancelled++;}};};
  ctx.animateWorkspaceTransition(2,3);
  assert.ok(animation.frames.every(frame=>!('transform' in frame)));
  assert.ok(animation.frames[0].opacity>=.9);assert.equal(animation.options.duration,180);
  ctx.animateWorkspaceTransition(3,2);assert.equal(cancelled,1);
  ctx.matchMedia=()=>({matches:true});animation=null;ctx.animateWorkspaceTransition(2,3);assert.equal(animation,null);
});

test('email opens an editable preview without copying and keeps drafts per composite contract key',async()=>{
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,4);rows[2].customer_id=rows[0].customer_id;
  let copies=0,content;ctx.window.copyToClipboard=async text=>{copies++;content=text;return true;};
  const first=ctx.reviewKey(rows[0]),second=ctx.reviewKey(rows[2]);
  assert.equal(ctx.openContractEmail(first),true);assert.equal(element('#emailDialog').open,true);assert.equal(copies,0);
  assert.ok(element('#emailContractContext').textContent.includes(rows[0].contract_id));
  element('#emailSubject').value='Tiêu đề do người dùng sửa';element('#emailBody').value='Bản người dùng kiểm tra trước khi sao chép.';ctx.saveOpenEmail();
  assert.equal(await ctx.copyOpenEmail(),true);assert.equal(copies,1);assert.equal(content,'Tiêu đề: Tiêu đề do người dùng sửa\n\nBản người dùng kiểm tra trước khi sao chép.');
  ctx.openContractEmail(second);assert.ok(!element('#emailBody').value.includes('Bản người dùng kiểm tra'));assert.ok(element('#emailBody').value.includes('ưu tiên'));
  ctx.openContractEmail(first);assert.equal(element('#emailBody').value,'Bản người dùng kiểm tra trước khi sao chép.');
  assert.equal(ctx.review.selected.size,0);assert.equal(ctx.review.approved.size,0);assert.equal(ctx.appState.step,3);
  ctx.resetReview();assert.equal(element('#emailDialog').open,false);
  ctx.openContractEmail(first);assert.notEqual(element('#emailSubject').value,'Tiêu đề do người dùng sửa');
});

test('email rewrite follows tone, length and supported instructions, supports undo and preserves unsupported requests',()=>{
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,5);
  ctx.openContractEmail(ctx.reviewKey(rows[0]));
  element('#emailBody').value='Bản sửa tay cần giữ để hoàn tác.';
  element('#emailInstruction').value='ngắn gọn hơn, thân thiện hơn, không nhắc giá';
  assert.equal(ctx.rewriteContractEmail(),true);
  assert.equal(element('#emailTone').value,'friendly');assert.equal(element('#emailLength').value,'short');assert.equal(element('#emailIncludePrice').checked,false);
  assert.ok(element('#emailBody').value.startsWith('Chào anh/chị'));assert.ok(!element('#emailBody').value.includes(ctx.money(rows[0].renewal_value)));
  ctx.undoContractEmail();assert.equal(element('#emailBody').value,'Bản sửa tay cần giữ để hoàn tác.');
  element('#emailInstruction').value='hứa giảm giá 50% và giao hàng ngày mai';
  assert.equal(ctx.rewriteContractEmail(),false);assert.equal(element('#emailBody').value,'Bản sửa tay cần giữ để hoàn tác.');
  assert.ok(element('#emailDialogStatus').textContent.includes('Chưa hỗ trợ'));
  element('#emailInstruction').value='trang trọng hơn; Thêm câu: Mong nhận được phản hồi vào thứ Sáu.';
  assert.equal(ctx.rewriteContractEmail(),true);assert.ok(element('#emailBody').value.includes('Mong nhận được phản hồi vào thứ Sáu.'));
  assert.equal(ctx.review.selected.size,0);assert.equal(ctx.review.approved.size,0);
});

test('email templates retain support blockers and unknown data without inventing policy commitments',async()=>{
  const {ctx,element}=frontend(),rows=reviewFixture(ctx,4);
  for(const tone of ['formal','friendly'])for(const length of ['short','standard','detailed']){
    const blocked=ctx.buildContractEmail(rows[2],{tone,length}).body;
    assert.ok(blocked.includes('ưu tiên'));assert.ok(!/khả năng nâng gói|đề nghị.*nâng gói|15%|24\/7|liên hệ trong ngày/i.test(blocked));
  }
  rows[0].renewal_value=0;
  assert.ok(ctx.buildContractEmail(rows[0]).body.includes(ctx.money(0)));
  const unknown=ctx.buildContractEmail({...rows[3],renewal_value:null}).body;
  assert.ok(unknown.includes('đối chiếu'));assert.ok(!unknown.includes('0%'));assert.ok(!unknown.includes('null'));
  ctx.openContractEmail(ctx.reviewKey(rows[0]));
  ctx.window.copyToClipboard=async()=>false;
  assert.equal(await ctx.copyOpenEmail(),false);assert.ok(element('#emailDialogStatus').textContent.includes('Chưa sao chép được'));
  assert.equal(element('#copyEmailDraft').disabled,false);
  element('#emailBody').value='';assert.equal(await ctx.copyOpenEmail(),false);
  assert.ok(element('#emailDialogStatus').textContent.includes('Bổ sung'));
  const page=fs.readFileSync(path.join(root,'public/index.html'),'utf8');assert.ok(page.includes('/email.js'));assert.ok(ctx.reviewTable().includes('✉ Xem email'));
});

test('input gate blocks missing required fields, invalid dates, duplicate keys and missing IDs for multi-contract customers',()=>{
  for(const csv of [
    'customer_id,contract_id\nKH1,HD1',
    'customer_id,expiration_date\n,2026-12-31',
    'customer_id,expiration_date\nKH1,31/02/2026',
    'customer_id,contract_id,expiration_date\nKH1,HD1,2026-12-31\nKH1,HD1,2027-01-31',
    'customer_id,contract_id,expiration_date\nKH1,,2026-12-31\nKH1,HD2,2027-01-31'
  ]){
    const result=analyze({stage:'clean',files:[upload(csv)]});
    assert.equal(result.blocked,true);assert.equal(result.inputQuality.status,'blocked');assert.ok(result.errorCount>0);assert.equal(result.errors.length,1);
  }
  const minimal=analyze({stage:'clean',files:[upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price\n00001,31/12/2026,10,0,0,100')]});
  assert.equal(minimal.blocked,false);assert.equal(minimal.rows[0].customer_id,'00001');assert.equal(minimal.canAnalyze,true);
});

test('missing harmless fields do not limit analysis while missing analytical data stays unknown',()=>{
  const full='customer_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,2026-12-31,10,0,0,0';
  const clean=analyze({stage:'clean',files:[upload(full)]});
  assert.equal(clean.blocked,false);assert.equal(clean.inputQuality.status,'ready');assert.equal(clean.inputQuality.readyCount,1);
  assert.equal(clean.warningCount,0);assert.equal(clean.rows[0].active_users,0);assert.equal(clean.rows[0].open_tickets,0);
  const deeper=analyze({stage:'analyze',files:[upload(full)]});assert.equal(deeper.rows[0].adoption_rate,0);assert.equal(deeper.rows[0].renewal_value,0);
  const mixed='customer_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH2,2026-12-31,,,,\nKH3,2026-12-31,10,8,0,100';
  const minimal=analyze({stage:'clean',files:[upload(mixed)]});
  assert.equal(minimal.inputQuality.status,'partial');assert.equal(minimal.inputQuality.limitedCount,1);assert.equal(minimal.canAnalyze,true);
  const limited=analyze({stage:'analyze',files:[upload(mixed)]});
  assert.equal(limited.rows[0].adoption_rate,null);assert.equal(limited.rows[0].open_tickets,null);assert.equal(limited.rows[0].renewal_value,null);assert.equal(limited.rows[0].status,'Cần xác minh');
});

test('invalid optional data is blanked in the cleaned copy and never coerced into safe ticket counts or valid prices',()=>{
  const file=upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price,discount,snapshot_date,status\nKH1,2026-12-31,0,80%,-1,not-a-price,150,31/02/2026,Resolved\nKH2,2026-12-31,10,8,0,100,0,2026-11-12,Resolved');
  const original=JSON.stringify(file),clean=analyze({stage:'clean',files:[file]});
  assert.equal(clean.blocked,false);assert.equal(clean.cleaningSummary.invalidOptional,6);
  for(const field of ['licensed_users','active_users','open_tickets','price','discount','snapshot_date'])assert.equal(clean.cleanedFiles[0].rows[0][field],'');
  assert.equal(JSON.stringify(file),original);assert.ok(clean.warningCount>=6);
  const result=analyze({stage:'analyze',files:[file]});assert.equal(result.rows[0].adoption_rate,null);assert.equal(result.rows[0].open_tickets,null);assert.equal(result.rows[0].renewal_value,null);
  assert.notEqual(result.rows[0].recommendation,'Xem xét nâng gói');
  const badDiscount=analyze({stage:'analyze',files:[upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price,discount\nKH2,2026-12-31,10,8,0,100000,150\nKH3,2026-12-31,10,8,0,100000,0')]});
  assert.equal(badDiscount.rows[0].renewal_value,null);assert.equal(badDiscount.rows[0].status,'Cần xác minh');
});

test('numeric normalization, percentage points and status inference match the declared input contract',()=>{
  const file=upload('Mã KH;Mã HĐ;Ngày hết hạn;licensed_users;active_users;price;discount;status\nKH1;HD1;31/12/2026;10;8;1.200.000;1%;Resolved');
  const clean=analyze({stage:'clean',files:[file]});assert.equal(clean.rows[0].open_tickets,0);assert.equal(clean.cleanedFiles[0].rows[0].price,'1200000');assert.equal(clean.cleanedFiles[0].rows[0].discount,'1');
  assert.equal(clean.cleanedFiles[0].rows[0].expiration_date,'2026-12-31');assert.ok(clean.cleaningSummary.numbers>=2);
  const result=analyze({stage:'analyze',files:[file]});assert.equal(result.rows[0].renewal_value,1188000);
  const conflict=analyze({stage:'analyze',files:[upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,2026-12-31,10,9,2,100'),upload('customer_id,open_tickets\nKH1,0','support.csv')]});
  assert.equal(conflict.rows[0].status,'Chặn upsell');assert.equal(conflict.rows[0].open_tickets,2);
});

test('ambiguous optional joins are reported instead of taking the last row, and warning payload stays bounded',()=>{
  const result=analyze({stage:'analyze',files:[upload('customer_id,expiration_date,licensed_users,active_users,open_tickets,price\nKH1,2026-12-31,10,,0,100000\nKH2,2026-12-31,10,8,0,100000'),upload('customer_id,active_users\nKH1,8\nKH1,9','usage.csv')]});
  assert.equal(result.rows[0].adoption_rate,null);assert.ok(result.warningGroups.some(g=>g.message.includes('nhiều dòng cùng khóa')));
  const csv='customer_id,expiration_date\n'+Array.from({length:100},(_,i)=>`KH${i},2026-12-31`).join('\n');
  const many=analyze({stage:'clean',files:[upload(csv)]});assert.equal(many.warningCount,400);assert.equal(many.warnings.length,8);assert.equal(many.inputQuality.limitedCount,100);
  assert.equal(many.blocked,true);assert.equal(many.remediation.action,'reload');
  for(const bad of ['customer_id,customer_id,expiration_date\nKH1,KH2,2026-12-31','customer_id,Mã KH,expiration_date\nKH1,KH2,2026-12-31','customer_id,expiration_date\nKH1,2026-12-31,extra'])assert.throws(()=>analyze({stage:'clean',files:[upload(bad)]}));
});

test('published Excel template round-trips through the actual parser with missing cells and namespaced XML',()=>{
  const data=fs.readFileSync(path.join(root,'public/templates/mau_du_lieu_gia_han.xlsx'));
  const result=analyze({stage:'clean',files:[{name:'sample.xlsx',data:data.toString('base64')}]});
  assert.equal(result.blocked,false);assert.equal(result.rows.length,6);assert.equal(result.inputQuality.readyCount,4);assert.equal(result.inputQuality.limitedCount,2);
  assert.equal(result.rows[0].expiration_date,'2026-12-20');assert.equal(result.rows[1].licensed_users,20);assert.equal(result.rows[1].active_users,8);assert.equal(result.rows[1].price,6000000);
  assert.equal(result.rows[4].contract_id,'—');assert.equal(result.rows[4].price,null);
  const {ctx,element}=frontend();assert.ok(element('#stage').innerHTML.includes('↓ Tải file mẫu XLSX'));assert.equal((element('#stage').innerHTML.match(/type="file"/g)||[]).length,1);
  ctx.openInputGuide();assert.equal(element('#inputGuideDialog').open,true);assert.ok(element('#inputGuideContent').innerHTML.includes('customer_id'));assert.ok(element('#inputGuideContent').innerHTML.includes('Theo điều kiện'));
  const report=ctx.inputQualityMarkup(JSON.parse(JSON.stringify(result.inputQuality)));assert.ok(report.includes('Được tiếp tục'));assert.ok(report.includes('còn giới hạn phân tích'));
  assert.ok(ctx.warningsBox(result.warnings,'Cảnh báo',result.warningCount).includes(String(result.warningCount)));
});

const completeHeader='customer_id,contract_id,expiration_date,licensed_users,active_users,open_tickets,price';
function gapFile(total,gaps,field='active_users'){
  const fields=completeHeader.split(',');
  return upload(completeHeader+'\n'+Array.from({length:total},(_,i)=>{
    const row=[`KH${i}`,`HD${i}`,'2026-12-31',10,8,0,100000];
    if(i<gaps)row[fields.indexOf(field)]='';
    return row.join(',');
  }).join('\n'));
}

test('source-wide required errors demand reupload; a few bad cells retain the manual repair path',()=>{
  for(const field of ['customer_id','expiration_date']){
    const file=gapFile(20,20,field),result=analyze({stage:'clean',files:[file]});
    assert.equal(result.blocked,true);assert.equal(result.remediation.action,'reload');
    assert.throws(()=>prepareRepair({datasets:{auto:[file]},mode:'auto'}),/file gốc/);
  }
  for(const [total,gaps,action] of [[10,5,'repair'],[60,6,'repair'],[59,6,'reload'],[50,6,'reload']]){
    const result=analyze({stage:'clean',files:[gapFile(total,gaps,'expiration_date')]});
    assert.equal(result.blocked,true);assert.equal(result.remediation.action,action,`${gaps}/${total}`);
    assert.equal(result.remediation.affectedRows,gaps);assert.equal(result.errors.length,1);
  }
});

test('analytical gaps are checked after joins and block on a whole field or widespread affected records',()=>{
  for(const field of ['licensed_users','active_users','open_tickets','price']){
    for(const stage of ['clean','analyze']){
      const result=analyze({stage,files:[gapFile(10,10,field)]});
      assert.equal(result.blocked,true,field);assert.equal(result.canAnalyze,false);assert.equal(result.remediation.action,'reload');assert.equal(result.rows,undefined);
    }
  }
  for(const [total,gaps,blocked] of [[10,5,false],[60,6,false],[50,6,true]]){
    const result=analyze({stage:'clean',files:[gapFile(total,gaps)]});
    assert.equal(result.blocked,blocked,`${gaps}/${total}`);
    if(!blocked){assert.equal(result.inputQuality.limitedCount,gaps);assert.equal(result.rows[0].active_users,null);}
  }
  const joined=analyze({stage:'clean',files:[upload('customer_id,expiration_date,licensed_users,plan,status\nKH1,2026-12-31,10,Pro,Resolved'),upload('customer_id,active_users\nKH1,0','usage.csv'),upload('plan,price\nPro,0','policy.csv')]});
  assert.equal(joined.blocked,false);assert.equal(joined.inputQuality.readyCount,1);assert.equal(joined.rows[0].open_tickets,0);assert.equal(joined.rows[0].price,0);
  const scattered=upload(completeHeader+'\n'+Array.from({length:20},(_,i)=>`KH${i},HD${i},2026-12-31,10,${i<3?'':8},${i>=3 && i<6?'':0},100`).join('\n'));
  assert.equal(analyze({stage:'clean',files:[scattered]}).remediation.action,'reload','combined affected rows matter even when each field has only three gaps');
});

test('reload UI hides both editors, persists its explanation and replaces files only after successful selection',async()=>{
  const {ctx,element,steps}=frontend();
  ctx.appState.datasets={auto:[gapFile(12,12)]};
  await ctx.runClean();
  const markup=element('#stage').innerHTML;
  assert.equal(ctx.appState.step,1);assert.equal(steps[1].disabled,true);assert.equal(steps[2].disabled,true);
  assert.ok(markup.includes('Chọn lại bộ tệp đã bổ sung'));assert.ok(!markup.includes('data-repair-mode'));assert.ok(markup.includes('Người dùng hoạt động'));
  ctx.renderUpload();assert.ok(element('#stage').innerHTML.includes('Cần kiểm tra file gốc'));
  await ctx.openRepair('manual');assert.equal(element('#repairDialog').open,false);
  const original=JSON.stringify(ctx.appState.datasets);
  await ctx.queueUploadFiles([],true);assert.equal(JSON.stringify(ctx.appState.datasets),original);
  const invalid=Object.assign(new Blob(['bad']),{name:'invalid.txt'});
  await ctx.queueUploadFiles([invalid],true);assert.equal(JSON.stringify(ctx.appState.datasets),original);
  const corrected=Object.assign(new Blob([Buffer.from(gapFile(12,0).data,'base64')]),{name:'corrected.csv'});
  await ctx.queueUploadFiles([corrected],true);
  assert.equal(ctx.appState.step,2);assert.equal(ctx.appState.datasets.auto.length,1);assert.equal(ctx.appState.datasets.auto[0].name,'corrected.csv');assert.equal(ctx.appState.clean.blocked,false);
});
