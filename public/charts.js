const chartState={config:null,saved:[],nextId:1,builderOpen:true};
const chartColors=['#6b9986','#709ec8','#d4ae6c','#c78374','#9d8fb8','#88afa6','#b7bd83','#98b7d1','#bc9c88','#7f9b69','#b99ab7','#9ca9a3'];
const chartLabels={customer_id:'Mã khách hàng',contract_id:'Mã hợp đồng',customer_name:'Khách hàng',expiration_date:'Ngày hết hạn',outreach_date:'Ngày cần liên hệ',plan:'Gói dịch vụ',licensed_users:'Tài khoản được cấp',active_users:'Người dùng hoạt động',adoption_rate:'Tỷ lệ sử dụng (%)',open_tickets:'Ticket mở',renewal_value:'Giá trị gia hạn (VND)',price:'Giá (VND)',discount:'Chiết khấu',snapshot_date:'Ngày đối chiếu',status:'Tình trạng',recommendation:'Đề xuất',__proposal:'Nhóm đề xuất',__approval:'Trạng thái duyệt',__adoption_band:'Nhóm mức sử dụng'};
function resetChartWorkspace(){chartState.config=null;chartState.saved=[];chartState.builderOpen=true;}
function chartSources(){
  const sources=[];
  if(state.analysis?.rows?.length){
    const rows=state.analysis.rows;
    sources.push({id:'analysis:all',label:'Toàn bộ kết quả phân tích',rows});
    sources.push({id:'analysis:pending',label:'Hồ sơ chờ duyệt',schemaRows:rows,rows:rows.filter(r=>!reviewState.approved.has(reviewKey(r)))});
    sources.push({id:'analysis:approved',label:'Hồ sơ đã duyệt',schemaRows:rows,rows:rows.filter(r=>reviewState.approved.has(reviewKey(r)))});
  }
  if(!state.clean?.blocked)(state.clean?.cleanedFiles||[]).forEach((file,i)=>sources.push({id:'clean:'+i,label:'Dữ liệu làm sạch · '+file.name,rows:file.rows,headers:file.headers}));
  return sources;
}
function chartNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(value==null || typeof value==='boolean')return null;
  const text=String(value).trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) && Number.isFinite(Number(text))?Number(text):null;
}
function chartDate(value){
  const text=String(value??'').trim();
  const iso=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/),local=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!iso && !local)return null;
  const [year,month,day]=iso?iso.slice(1).map(Number):[Number(local[3]),Number(local[2]),Number(local[1])];
  const d=new Date(0);d.setUTCFullYear(year,month-1,day);d.setUTCHours(0,0,0,0);
  return d.getUTCFullYear()===year && d.getUTCMonth()===month-1 && d.getUTCDate()===day?d.toISOString().slice(0,10):null;
}
function chartFields(source){
  const headers=source.headers || Object.keys(source.rows[0] || source.schemaRows?.[0] || {});
  const sample=(source.rows.length?source.rows:source.schemaRows || []).slice(0,200);
  const fields=headers.filter(h=>!h.startsWith('_')).map(key=>{
    const values=sample.map(r=>r[key]).filter(v=>v!=null && String(v).trim()!=='');
    const date=values.length>0 && values.every(v=>chartDate(v)!=null);
    const numeric=!date && values.length>0 && values.filter(v=>chartNumber(v)!=null).length/values.length>=.6 && !/(?:^|_)(?:id|code)(?:$|_)/i.test(key);
    return {key,label:chartLabels[key] || key,type:date?'date':numeric?'number':'category'};
  });
  if(source.id.startsWith('analysis:'))fields.unshift(...['__proposal','__approval','__adoption_band'].map(key=>({key,label:chartLabels[key],type:'category'})));
  return fields;
}
function chartFieldValue(row,field){
  if(field==='__proposal')return reviewGroups[reviewGroup(row)].label;
  if(field==='__approval')return reviewState.approved.has(reviewKey(row))?'Đã duyệt':'Chờ duyệt';
  if(field==='__adoption_band'){
    const value=chartNumber(row.adoption_rate);
    return value==null?'Chưa có dữ liệu':value===0?'0%':value<50?'1–49%':value<70?'50–69%':value<90?'70–89%':value<=100?'90–100%':'Trên 100%';
  }
  return row[field];
}
function defaultChartConfig(source=chartSources()[0]){
  if(!source)return null;
  const fields=chartFields(source),group=fields.find(f=>f.type==='category' && !/(?:^|_)id$/.test(f.key)) || fields[0];
  return {source:source.id,type:'pie',group:group?.key || '',metric:'count',value:fields.find(f=>f.type==='number')?.key || '',grain:'value',title:''};
}
function chartWorkspaceStats(){
  const sources=chartSources(),source=sources.find(s=>s.id===chartState.config?.source)||sources[0];
  return {overviewTotalLabel:'Dòng dữ liệu trong nguồn',overviewTotal:source?fmtNum(source.rows.length):'—',overviewTotalNote:source?.label || 'Tải tệp và làm sạch dữ liệu trước',overviewReviewLabel:'Biểu đồ trong dashboard',overviewReview:fmtNum(chartState.saved.length),overviewReviewNote:'Tối đa 6 biểu đồ trong phiên',overviewValueLabel:'Nguồn dữ liệu có thể vẽ',overviewValue:fmtNum(sources.length),overviewValueNote:'Dữ liệu lấy trực tiếp từ phiên làm việc'};
}
function aggregateChart(config){
  const source=chartSources().find(s=>s.id===config?.source);
  const result={series:[],totalRows:source?.rows.length||0,missingValues:0,missingDates:0,note:'',error:'',title:config?.title?.trim()||''};
  if(!source){result.error='Nguồn dữ liệu không còn khả dụng. Hãy chọn lại nguồn.';return result;}
  const fields=chartFields(source),group=fields.find(f=>f.key===config.group),value=fields.find(f=>f.key===config.value);
  if(!group || !['count','sum','avg'].includes(config.metric) || !['pie','bar','line'].includes(config.type)){result.error='Hãy chọn loại biểu đồ và trường dữ liệu phù hợp.';return result;}
  if(config.metric!=='count' && (!value || value.type!=='number')){result.error='Chọn một trường số để tính tổng hoặc trung bình.';return result;}
  result.groupLabel=group.label;result.valueLabel=config.metric==='count'?'Số bản ghi':`${config.metric==='sum'?'Tổng':'Trung bình'} ${value.label}`;
  result.title ||= `${result.valueLabel} theo ${group.label.toLowerCase()}`;
  const groups=new Map();
  for(const row of source.rows){
    let label=String(chartFieldValue(row,config.group)??'').trim() || '(Thiếu dữ liệu)';
    if(config.grain==='month' || config.grain==='day'){
      const date=chartDate(chartFieldValue(row,config.group));
      if(!date){result.missingDates++;continue;}
      label=config.grain==='month'?date.slice(0,7):date;
    }
    const bucket=groups.get(label)||{label,sum:0,valid:0,rows:0};bucket.rows++;
    if(config.metric==='count'){bucket.sum++;bucket.valid++;}
    else {const n=chartNumber(chartFieldValue(row,config.value));if(n==null)result.missingValues++;else {bucket.sum+=n;bucket.valid++;}}
    groups.set(label,bucket);
  }
  const evaluated=[...groups.values()].filter(g=>g.valid>0).map(g=>({...g,value:config.metric==='avg'?g.sum/g.valid:g.sum}));
  if(evaluated.some(g=>!Number.isFinite(g.value))){result.error='Giá trị tổng hợp quá lớn để vẽ. Hãy chọn phép tính hoặc dữ liệu khác.';return result;}
  if(config.type==='line'){
    evaluated.sort((a,b)=>a.label.localeCompare(b.label,'vi',{numeric:true}));
    result.series=evaluated.slice(-24);
    if(evaluated.length>24)result.note=`Hiển thị 24 nhóm cuối theo thứ tự trục X; ${evaluated.length-24} nhóm trước không hiển thị.`;
  } else {
    evaluated.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)||a.label.localeCompare(b.label,'vi'));
    if(evaluated.length>12){
      const rest=evaluated.slice(11),merged={label:`Nhóm còn lại (${rest.length})`,sum:0,valid:0,rows:0};
      rest.forEach(g=>{merged.sum+=g.sum;merged.valid+=g.valid;merged.rows+=g.rows;});
      merged.value=config.metric==='avg'?merged.sum/merged.valid:merged.sum;
      result.series=[...evaluated.slice(0,11),merged];result.note=`Gộp ${rest.length} nhóm nhỏ vào “Nhóm còn lại”.`;
    } else result.series=evaluated;
  }
  if(result.series.some(g=>!Number.isFinite(g.value))){result.error='Giá trị tổng hợp quá lớn để vẽ.';return result;}
  const values=result.series.map(g=>g.value),total=values.reduce((n,v)=>n+v,0);
  if((config.type==='pie' && !Number.isFinite(total)) || (values.length && !Number.isFinite(Math.max(0,...values)-Math.min(0,...values)))){result.error='Giá trị tổng hợp quá lớn để vẽ.';return result;}
  if(config.type==='pie' && config.metric==='avg')result.error='Biểu đồ tròn phù hợp với số lượng hoặc tổng. Hãy chọn biểu đồ cột/đường để so sánh trung bình.';
  else if(config.type==='pie' && (evaluated.some(g=>g.value<0) || total<=0) && result.series.length)result.error='Biểu đồ tròn cần các giá trị không âm và tổng lớn hơn 0. Hãy chọn biểu đồ cột hoặc đường cho dữ liệu này.';
  return result;
}
function chartCompact(n){return new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(n);}
function chartFormat(n){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n);}
function chartSvg(config,result){
  if(result.error || !result.series.length)return '';
  const W=640,H=320,series=result.series;
  const title=esc(result.title),desc=esc(`${result.valueLabel} theo ${result.groupLabel}. ${series.length} nhóm được hiển thị.`);
  let body='';
  if(config.type==='pie'){
    const total=series.reduce((n,g)=>n+g.value,0),r=91,circumference=2*Math.PI*r;let offset=0;
    series.forEach((g,i)=>{
      const length=g.value/total*circumference;
      body+=`<circle cx="174" cy="155" r="${r}" fill="none" stroke="${chartColors[i%chartColors.length]}" stroke-width="40" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 174 155)"><title>${esc(g.label)}: ${chartFormat(g.value)} (${(g.value/total*100).toFixed(1)}%)</title></circle>`;
      offset+=length;
      body+=`<circle cx="326" cy="${38+i*21}" r="4" fill="${chartColors[i%chartColors.length]}"/><text x="339" y="${42+i*21}" font-size="11" fill="#708464">${esc(g.label.length>23?g.label.slice(0,22)+'…':g.label)}</text><text x="617" y="${42+i*21}" text-anchor="end" font-size="11" fill="#536d44">${chartCompact(g.value)}</text>`;
    });
    body+=`<text x="174" y="155" text-anchor="middle" font-size="29" font-weight="600" fill="#526b43">${chartCompact(total)}</text><text x="174" y="176" text-anchor="middle" font-size="10" fill="#a0af93">${config.metric==='count'?'bản ghi':'tổng hiển thị'}</text>`;
  } else {
    const left=68,right=22,top=24,bottom=75,pw=W-left-right,ph=H-top-bottom;
    const min=Math.min(0,...series.map(g=>g.value));let max=Math.max(0,...series.map(g=>g.value));if(max===min)max=min+1;const range=max-min;
    const y=v=>top+(max-v)/range*ph,zero=y(0);
    const times=(config.grain==='month'||config.grain==='day')?series.map(g=>Date.parse(g.label+(config.grain==='month'?'-01':''))):null;
    const firstTime=times?.[0],span=times?times[times.length-1]-firstTime:0;
    const x=i=>config.type==='bar'?left+(i+.5)/series.length*pw:times && span>0?left+(times[i]-firstTime)/span*pw:left+(series.length===1?.5:i/(series.length-1))*pw;
    for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,py=y(v);body+=`<line x1="${left}" x2="${W-right}" y1="${py}" y2="${py}" stroke="#e6ecde"/><text x="${left-10}" y="${py+4}" text-anchor="end" font-size="10" fill="#9baa8e">${chartCompact(v)}</text>`;}
    body+=`<line x1="${left}" x2="${W-right}" y1="${zero}" y2="${zero}" stroke="#b7c7a7"/>`;
    if(config.type==='line')body+=`<path d="${series.map((g,i)=>`${i?'L':'M'}${x(i)},${y(g.value)}`).join(' ')}" fill="none" stroke="#709c86" stroke-width="3" stroke-linejoin="round"/>`;
    series.forEach((g,i)=>{
      const tooltip=`<title>${esc(g.label)}: ${chartFormat(g.value)}</title>`;
      if(config.type==='bar'){const width=pw/series.length*.6;body+=`<rect x="${x(i)-width/2}" y="${Math.min(y(g.value),zero)}" width="${width}" height="${Math.abs(y(g.value)-zero)}" rx="3" fill="${chartColors[i%chartColors.length]}">${tooltip}</rect>`;}
      else body+=`<circle cx="${x(i)}" cy="${y(g.value)}" r="4" fill="#fafcf7" stroke="#709c86" stroke-width="2">${tooltip}</circle>`;
      if(i%Math.ceil(series.length/8)===0 || i===series.length-1)body+=`<text x="${x(i)}" y="${H-bottom+22}" text-anchor="middle" font-size="10" fill="#8c9d7d">${esc(g.label.length>14?g.label.slice(0,13)+'…':g.label)}</text>`;
    });
    body+=`<text x="${left}" y="${H-9}" font-size="10" fill="#9aaa8c">${esc(result.groupLabel)}</text><text x="${left}" y="13" font-size="10" fill="#9aaa8c">${esc(result.valueLabel)}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}" style="font-family:Segoe UI,Arial,sans-serif;background:#fcfdf8"><title>${title}</title><desc>${desc}</desc>${body}</svg>`;
}
function chartResultMarkup(config){
  const result=aggregateChart(config);
  return `<h3>${esc(result.title || 'Xem trước biểu đồ')}</h3>${result.error?`<div class="alert warning">${esc(result.error)}</div>`:!result.series.length?'<div class="chart-empty">Không có dữ liệu phù hợp để vẽ. Thử đổi nguồn, trường hoặc phép tính.</div>':`<div class="chart-svg">${chartSvg(config,result)}</div>`}<p class="chart-note">${fmtNum(result.totalRows)} dòng nguồn. ${result.missingValues?`Bỏ qua ${fmtNum(result.missingValues)} giá trị thiếu/không phải số, không đổi thành 0. `:''}${result.missingDates?`Bỏ qua ${fmtNum(result.missingDates)} dòng không có ngày hợp lệ. `:''}${esc(result.note)}</p>${result.series.length&&!result.error?`<details class="chart-values"><summary>Xem bảng số liệu tổng hợp</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Nhóm</th><th>${esc(result.valueLabel)}</th><th>Số dòng nguồn</th></tr></thead><tbody>${result.series.map(g=>`<tr><td>${esc(g.label)}</td><td>${chartFormat(g.value)}</td><td>${fmtNum(g.rows)}</td></tr>`).join('')}</tbody></table></div></details>`:''}`;
}
function chartPresets(){
  const available=chartSources(),source=available.find(s=>s.id===chartState.config?.source)||available[0];if(!source)return [];
  const fields=chartFields(source),base=defaultChartConfig(source),date=fields.find(f=>f.type==='date'),number=fields.find(f=>f.type==='number');
  if(source.id.startsWith('analysis:'))return [
    {...base,type:'pie',group:'__proposal',title:'Cơ cấu đề xuất gia hạn'},
    {...base,type:'line',group:'expiration_date',grain:'month',metric:'sum',value:'renewal_value',title:'Giá trị gia hạn theo tháng hết hạn'},
    {...base,type:'bar',group:'__adoption_band',title:'Hợp đồng theo mức sử dụng'}
  ];
  return [{...base,title:'Số bản ghi theo nhóm'}, {...base,type:'bar',metric:number?'sum':'count',value:number?.key || '',title:number?`Tổng ${number.label.toLowerCase()} theo nhóm`:'So sánh số bản ghi theo nhóm'}, {...base,type:'line',group:date?.key || base.group,grain:date?'month':'value',title:date?'Số bản ghi theo tháng':'Số bản ghi theo nhóm (đường)'}];
}
function saveChartConfig(){
  if(chartState.saved.length>=6)return false;
  const result=aggregateChart(chartState.config);if(result.error || !result.series.length)return false;
  chartState.saved.push({...chartState.config,title:result.title,id:'chart-'+chartState.nextId++});chartState.builderOpen=false;return true;
}
function downloadChartSvg(config){
  const result=aggregateChart(config),svg=chartSvg(config,result);if(!svg)return false;
  download(svg,(result.title || 'bieu-do').replace(/[<>:"/\\|?*]/g,'_').slice(0,80)+'.svg','image/svg+xml;charset=utf-8');return true;
}
function renderChartWorkspace(){
  const sources=chartSources();
  if(!sources.length){stageEl.innerHTML=`${stageTitle('CÔNG CỤ · DASHBOARD','Dashboard / Biểu đồ','Trực quan hóa dữ liệu làm sạch và kết quả phân tích.')}<div class="empty-state"><div class="big">◫</div><b>Chưa có dữ liệu để vẽ</b><p>Tải tệp và hoàn tất làm sạch dữ liệu để tạo biểu đồ tròn, đường hoặc cột.</p><button class="btn btn-primary" data-chart-upload>＋ Tải dữ liệu</button></div>`;return;}
  if(!sources.some(s=>s.id===chartState.config?.source))chartState.config=defaultChartConfig(sources[0]);
  const c=chartState.config,source=sources.find(s=>s.id===c.source),fields=chartFields(source);
  stageEl.innerHTML=`${stageTitle('CÔNG CỤ · TRỰC QUAN HÓA','Dashboard / Biểu đồ','Chọn trường và phép tính để vẽ; các biểu đồ luôn lấy số liệu từ phiên hiện tại.',`${chartState.saved.length}/6 biểu đồ`)}
  <div class="chart-presets"><span>Tạo nhanh:</span>${chartPresets().map((p,i)=>`<button class="btn btn-light" data-chart-preset="${i}">${esc(p.title)}</button>`).join('')}<button class="btn btn-light" data-chart-suggest>Tạo dashboard gợi ý</button></div>
  <details class="chart-builder" id="chartBuilder" ${chartState.builderOpen?'open':''}><summary>＋ Tạo và tùy chỉnh biểu đồ</summary><div class="chart-controls">
    <label>Nguồn dữ liệu<select data-chart-field="source">${sources.map(s=>`<option value="${s.id}" ${s.id===c.source?'selected':''}>${esc(s.label)} (${fmtNum(s.rows.length)} dòng)</option>`).join('')}</select></label>
    <label>Loại biểu đồ<select data-chart-field="type">${[['pie','Biểu đồ tròn'],['line','Biểu đồ đường'],['bar','Biểu đồ cột']].map(([v,t])=>`<option value="${v}" ${c.type===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>Nhóm / trục X<select data-chart-field="group">${fields.map(f=>`<option value="${esc(f.key)}" ${c.group===f.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label>
    <label>Phép tính<select data-chart-field="metric">${[['count','Đếm số bản ghi'],['sum','Tổng'],['avg','Trung bình']].map(([v,t])=>`<option value="${v}" ${c.metric===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>Trường số / trục Y<select data-chart-field="value" ${c.metric==='count'?'disabled':''}><option value="">Chọn trường số</option>${fields.filter(f=>f.type==='number').map(f=>`<option value="${esc(f.key)}" ${c.value===f.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label>
    <label>Gộp thời gian<select data-chart-field="grain"><option value="value" ${c.grain==='value'?'selected':''}>Giữ từng giá trị</option><option value="month" ${c.grain==='month'?'selected':''}>Theo tháng</option><option value="day" ${c.grain==='day'?'selected':''}>Theo ngày</option></select></label>
    <label class="chart-title-input">Tiêu đề<input data-chart-field="title" maxlength="120" value="${esc(c.title)}" placeholder="Để trống để đặt tự động"></label>
  </div><article class="chart-preview" id="chartPreview">${chartResultMarkup(c)}</article><div class="chart-builder-actions"><button class="btn btn-primary" data-chart-save ${chartState.saved.length>=6?'disabled':''}>＋ Thêm vào dashboard</button><button class="btn btn-light" data-chart-export-preview>↓ Tải SVG xem trước</button><small id="chartBuilderStatus" role="status"></small></div></details>
  <div class="chart-grid">${chartState.saved.map(saved=>`<article class="dashboard-chart"><div class="chart-card-actions"><span>${{pie:'TRÒN',line:'ĐƯỜNG',bar:'CỘT'}[saved.type]}</span><button class="btn btn-light" data-chart-export="${saved.id}" aria-label="Tải biểu đồ ${esc(saved.title)}">↓ SVG</button><button class="btn btn-quiet" data-chart-remove="${saved.id}" aria-label="Bỏ biểu đồ ${esc(saved.title)}">✕</button></div>${chartResultMarkup(saved)}</article>`).join('')}</div><p class="chart-note">Di chuột lên phần biểu đồ để xem giá trị. Biểu đồ tròn/cột hiển thị tối đa 12 nhóm; nhóm còn lại được gộp và ghi rõ. Biểu đồ đường hiển thị tối đa 24 nhóm cuối theo trục X. Dashboard được giữ trong phiên; nạp và làm sạch bộ dữ liệu mới sẽ đặt lại các biểu đồ.</p>`;
  document.querySelector('#chartBuilder').ontoggle=e=>{chartState.builderOpen=e.target.open;};
  updateDashboard();
}
stageEl.addEventListener('change',event=>{
  if(state.step!=='dashboard' || !event.target.matches('[data-chart-field]'))return;
  const field=event.target.dataset.chartField;
  if(field==='title')return;
  if(field==='source')chartState.config=defaultChartConfig(chartSources().find(s=>s.id===event.target.value));
  else {chartState.config[field]=event.target.value;if(field==='group')chartState.config.grain='value';}
  chartState.builderOpen=true;renderChartWorkspace();
});
stageEl.addEventListener('input',event=>{
  if(state.step!=='dashboard' || event.target.dataset.chartField!=='title' || !chartState.config)return;
  chartState.config.title=event.target.value;
  document.querySelector('#chartPreview').innerHTML=chartResultMarkup(chartState.config);
});
stageEl.addEventListener('click',event=>{
  if(state.step!=='dashboard')return;
  const button=event.target.closest('[data-chart-preset],[data-chart-suggest],[data-chart-save],[data-chart-remove],[data-chart-export],[data-chart-export-preview],[data-chart-upload]');
  if(!button || button.disabled)return;
  if(button.hasAttribute('data-chart-upload')){navigateStep(1);return;}
  if(button.hasAttribute('data-chart-preset')){chartState.config=chartPresets()[Number(button.dataset.chartPreset)];chartState.builderOpen=true;}
  else if(button.hasAttribute('data-chart-suggest')){chartState.saved=chartPresets().map(c=>({...c,id:'chart-'+chartState.nextId++}));chartState.builderOpen=false;}
  else if(button.hasAttribute('data-chart-save')){if(!saveChartConfig()){document.querySelector('#chartBuilderStatus').textContent='Chọn dữ liệu có thể vẽ; dashboard chứa tối đa 6 biểu đồ.';return;}}
  else if(button.hasAttribute('data-chart-remove'))chartState.saved=chartState.saved.filter(c=>c.id!==button.dataset.chartRemove);
  else {const c=button.hasAttribute('data-chart-export-preview')?chartState.config:chartState.saved.find(c=>c.id===button.dataset.chartExport);if(c && !downloadChartSvg(c))document.querySelector('#chartBuilderStatus').textContent='Chưa có biểu đồ hợp lệ để tải.';return;}
  renderChartWorkspace();
});
