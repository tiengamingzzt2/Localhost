const stageEl = document.querySelector('#stage');
const state = { step: 1, lastWorkflowStep: 1, tablePage: 0, datasets: {}, drafts: {}, detectedFiles: [], processing: false, uploading: false, cleanFileIndex: -1, clean: null, analysis: null, feedback: '', audit: [], leadDays: 45, adoptionThreshold: 70 };
const categories = [
  { id: 'contracts', title: 'Hợp đồng', detail: 'Mã khách hàng, mã hợp đồng, gói và ngày hết hạn', required: true, icon: '▤' },
  { id: 'usage', title: 'Nhật ký sử dụng', detail: 'Mã khách hàng, người dùng hoạt động và ngày đối chiếu', icon: '◷' },
  { id: 'support', title: 'Yêu cầu hỗ trợ', detail: 'Mã khách hàng, số ticket mở hoặc trạng thái', icon: '◉' },
  { id: 'policies', title: 'Gói & chính sách', detail: 'Mã khách hàng, giá và điều kiện ưu đãi', icon: '◇' }
];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function setStep(n) {
  const previous=state.step;
  state.step=n; if(Number.isInteger(n))state.lastWorkflowStep=n;
  state.tablePage=0;render();
  if(previous!==n && typeof animateWorkspaceTransition==='function')animateWorkspaceTransition(previous,n);
}
function stepAvailability(step) {
  if (state.processing || state.uploading) return { enabled:false, reason:'Agent đang xử lý dữ liệu. Vui lòng đợi hoàn tất.' };
  if (step===1) return { enabled:true, reason:'Mở khu vực tải và quản lý tệp.' };
  if (step===2) return state.clean && !state.clean.blocked && (state.clean.rows?.length || state.clean.cleanedFiles?.length)
    ? { enabled:true, reason:'Xem lại dữ liệu đã chuẩn hóa.' } : { enabled:false, reason:'Tải tệp và hoàn tất kiểm tra, làm sạch dữ liệu trước.' };
  if (!state.analysis || state.analysis.blocked || !state.analysis.rows?.length) return { enabled:false, reason:'Duyệt dữ liệu và chạy phân tích để mở bước này.' };
  if (step===3) return { enabled:true, reason:'Xem đề xuất và chọn hồ sơ để kiểm duyệt.' };
  if (step===4) {
    const savedScope = state.analysis.rows.some(row=>reviewState.finalKeys?.has(reviewKey(row)) || reviewState.approved.has(reviewKey(row)));
    const newSelection = reviewState.view==='pending' && selectedReviewRows().length>0;
    return savedScope || newSelection ? { enabled:true, reason:'Mở lượt duyệt cuối; các hồ sơ mới chọn sẽ được chuyển sang bước này.' } : { enabled:false, reason:'Chọn hồ sơ ở bước Phân tích rồi bấm Duyệt kết quả.' };
  }
  return { enabled:false, reason:'Bước không hợp lệ.' };
}
function saveStepDraft() {
  const field = ({2:'cleanFeedback',3:'analysisFeedback',4:'finalFeedback'})[state.step];
  const name = ({2:'clean',3:'analysis',4:'final'})[state.step];
  const input = field ? document.getElementById(field) : null;
  if (input && typeof input.value==='string') state.drafts[name]=input.value;
  if (state.step===3) {
    const lead=document.querySelector('#leadDays'), threshold=document.querySelector('#threshold');
    if (lead && threshold) state.drafts.analysisParams={leadDays:lead.value,threshold:threshold.value};
  }
}
function navigateStep(step) {
  step=Number(step);
  const access=stepAvailability(step);
  if (!access.enabled) { const hint=document.querySelector('#stepNavigationHint'); if (hint) hint.textContent=access.reason; return false; }
  if (state.step===step) return true;
  saveStepDraft();
  if (step===4) {
    const selected=reviewState.view==='pending' ? selectedReviewRows() : [];
    if (selected.length && (!reviewState.finalKeys || selected.some(row=>!reviewState.finalKeys.has(reviewKey(row))))) { transferReviewSelection(); return true; }
    const pending=state.analysis.rows.some(row=>reviewState.finalKeys?.has(reviewKey(row)) && !reviewState.approved.has(reviewKey(row)));
    if (!pending && reviewState.approved.size) reviewState.view='approved';
  }
  setStep(step);
  return true;
}
function dashboardSnapshot() {
  const clean = state.clean, cleanRows = clean?.blocked ? [] : clean?.rows || [];
  const analyzed = state.analysis?.rows || [];
  const reviewing = [3,4].includes(state.step) && !!state.analysis;
  const approvedCount = analyzed.filter(row=>reviewState.approved.has(reviewKey(row))).length;
  const files = queuedFiles().length;
  const generic = !cleanRows.length && clean?.cleanedFiles?.length && !clean.blocked;
  const warningRows = new Set((clean?.warnings || []).map(w=>w.row ?? w.customer_id));

  // Xác định trạng thái hoàn tất thực tế của từng bước
  const isStep1Done = Boolean(clean && !clean.blocked && (files > 0 || cleanRows.length || clean?.cleanedFiles?.length) && state.step > 1);
  const isStep2Done = Boolean(state.analysis && !state.analysis.blocked && analyzed.length > 0 && state.step >= 3);
  const isStep3Done = Boolean(state.analysis && !state.analysis.blocked && (state.step === 4 || (reviewState.approved.size > 0 && state.step >= 3)));
  const isStep4Done = Boolean(state.analysis && approvedCount > 0 && approvedCount >= analyzed.length);

  const content = {
    overviewTotalLabel: generic ? 'Dòng dữ liệu đã làm sạch' : 'Hồ sơ đã chuẩn hóa',
    overviewTotal: generic ? fmtNum(clean.cleaningSummary.totalRows) : clean && !clean.blocked ? fmtNum(cleanRows.length) : '—',
    overviewTotalNote: clean && !clean.blocked ? `${fmtNum(files)} tệp trong phiên · dữ liệu đã chuẩn hóa` : 'Bắt đầu bằng cách nạp dữ liệu',
    overviewReviewLabel: 'Cần xác minh', overviewReview: clean && !clean.blocked ? fmtNum(clean.inputQuality?.limitedCount ?? warningRows.size) : '—',
    overviewReviewNote: clean && !clean.blocked ? 'Hồ sơ còn thiếu dữ liệu nghiệp vụ' : 'Chưa có kết quả kiểm tra',
    overviewValueLabel: 'Giá trị gia hạn có căn cứ', overviewValue: '—', overviewValueNote: 'Hiển thị sau bước phân tích',
    workspaceStatus: ({1:'Sẵn sàng nhận dữ liệu',2:'Đang chờ duyệt dữ liệu',3:'Đã hoàn tất phân tích',4:'Đang chờ duyệt cuối',audit:'Lịch sử thực thi',dashboard:'Biểu đồ từ dữ liệu trong phiên'})[state.step],
    workspaceTitle: state.step === 'dashboard' ? 'Dashboard dữ liệu' : state.step === 'audit' ? 'Nhật ký Agent' : 'Quy trình gia hạn',
    stepCount1: files ? (isStep1Done ? `✓ ${fmtNum(files)} tệp` : `${fmtNum(files)} tệp`) : '—',
    stepCount2: clean?.blocked ? 'Cần sửa' : clean ? (isStep2Done ? '✓ Đã duyệt' : `👤 Cần duyệt (${fmtNum(generic ? clean.cleaningSummary.totalRows : cleanRows.length)})`) : '—',
    stepCount3: analyzed.length ? (isStep3Done ? '✓ Đã chuyển' : `${fmtNum(analyzed.length-approvedCount)} chờ`) : '—',
    stepCount4: analyzed.length ? (isStep4Done ? '✓ Hoàn tất' : approvedCount > 0 ? `${fmtNum(approvedCount)}/${fmtNum(analyzed.length)} duyệt` : `👤 Cần duyệt (${fmtNum(analyzed.length)})`) : '—'
  };
  if (state.step === 1 && clean?.blocked) {
    const readCount = (state.detectedFiles || []).reduce((sum,file)=>sum+file.rows,0);
    content.overviewTotalLabel = 'Dòng dữ liệu đã đọc'; content.overviewTotal = readCount ? fmtNum(readCount) : '—';
    content.overviewTotalNote = `${fmtNum(files)} tệp đang giữ · chờ sửa dữ liệu`;
    content.overviewReviewLabel = 'Lỗi cần sửa'; content.overviewReview = fmtNum(clean.errorCount ?? clean.errors?.length ?? 0);
    content.overviewReviewNote = 'Cần sửa trước khi chuyển bước'; content.workspaceStatus = 'Đang chờ sửa dữ liệu';
  }
  if (reviewing || (state.step === 'audit' && state.analysis)) {
    const base = reviewing ? reviewBaseRows() : analyzed;
    const scope = reviewing ? reviewFilteredRows() : analyzed;
    const priced = scope.filter(row=>Number.isFinite(row.renewal_value));
    const verifying = scope.filter(row=>reviewGroup(row)==='verify').length;
    const blocked = scope.filter(row=>reviewGroup(row)==='blocked').length;
    const approvedView = reviewing && reviewState.view==='approved';
    const label = !reviewing ? 'Hợp đồng trong phiên' : approvedView ? 'Hồ sơ đã duyệt' : state.step===4 ? 'Hồ sơ chờ duyệt cuối' : 'Hồ sơ chờ duyệt';
    content.overviewTotalLabel = label; content.overviewTotal = fmtNum(scope.length);
    content.overviewTotalNote = scope.length !== base.length ? `Đang lọc ${fmtNum(scope.length)} / ${fmtNum(base.length)} hồ sơ · ${fmtNum(analyzed.length)} hồ sơ trong phiên` : `${fmtNum(base.length)} hồ sơ ${approvedView?'đã duyệt':reviewing?'đang chờ':'trong phiên'} · ${fmtNum(analyzed.length)} hồ sơ toàn phiên`;
    content.overviewReview = fmtNum(verifying); content.overviewReviewNote = `${fmtNum(blocked)} hồ sơ chặn upsell trong nhóm đang xem`;
    content.overviewValueLabel = approvedView ? 'Giá trị đã duyệt có căn cứ' : reviewing ? 'Giá trị chờ duyệt có căn cứ' : 'Giá trị gia hạn có căn cứ';
    content.overviewValue = !priced.length && scope.length ? 'Chưa đủ căn cứ' : money(priced.reduce((sum,row)=>sum+row.renewal_value,0));
    content.overviewValueNote = `${fmtNum(priced.length)} / ${fmtNum(scope.length)} hồ sơ đang xem có giá đủ căn cứ tính`;
    content.reviewContextTotal = `${fmtNum(scope.length)} ${label.toLowerCase()}${scope.length!==base.length?' (đang lọc)':''}`;
    content.reviewContextValue = `Giá trị có căn cứ: ${content.overviewValue} · ${fmtNum(priced.length)} hồ sơ có giá`;
    content.workspaceStatus = approvedView ? `Đã duyệt ${fmtNum(approvedCount)} / ${fmtNum(analyzed.length)} hồ sơ` : state.step===4 ? `Còn ${fmtNum(base.length)} hồ sơ trong lượt duyệt cuối` : state.step===3 ? `Còn ${fmtNum(base.length)} hồ sơ chờ duyệt` : 'Lịch sử thực thi';
  }
  const progress = analyzed.length ? approvedCount / analyzed.length * 100 : 0;
  if(state.step==='dashboard' && typeof chartWorkspaceStats==='function') Object.assign(content,chartWorkspaceStats());
  content.valueProgressLabel = analyzed.length ? `Tiến độ duyệt: ${fmtNum(approvedCount)} / ${fmtNum(analyzed.length)} hồ sơ (${Math.round(progress)}%)` : 'Tiến độ duyệt xuất hiện sau bước phân tích';
  return { content, progress, approvedCount, total: analyzed.length, isStep1Done, isStep2Done, isStep3Done, isStep4Done };
}
function updateDashboard() {
  const {content,progress,approvedCount,total,isStep1Done,isStep2Done,isStep3Done,isStep4Done} = dashboardSnapshot();
  Object.entries(content).forEach(([id,value])=>{ const el=document.getElementById(id); if (el && el.textContent!==String(value)) el.textContent=value; });
  document.querySelector('#valueProgress').style.width = `${progress}%`;
  const track=document.querySelector('#overviewProgress');
  if (track) { track.setAttribute('aria-valuenow',approvedCount); track.setAttribute('aria-valuemax',total || 1); track.setAttribute('aria-valuetext',content.valueProgressLabel); }
  if(track) track.hidden=state.step==='dashboard';
  const progressLabel=document.querySelector('#valueProgressLabel');if(progressLabel)progressLabel.hidden=state.step==='dashboard';
  document.querySelector('#steps').hidden = false;

  const stepDoneMap = {
    1: isStep1Done,
    2: isStep2Done,
    3: isStep3Done,
    4: isStep4Done
  };

  document.querySelectorAll('.step').forEach(el => {
    const x = Number(el.dataset.step), access = stepAvailability(x);
    const isDone = Boolean(stepDoneMap[x]);
    const isHitl = (x === 2 || x === 4); // Chốt chặn con người (HITL)

    el.classList.toggle('active', x === state.step);
    el.classList.toggle('done', isDone);
    el.classList.toggle('hitl-step', isHitl);

    const isPendingHitl = isHitl && !isDone && access.enabled;
    el.classList.toggle('pending-hitl', isPendingHitl);

    const numEl = el.querySelector('.step-num');
    if (numEl) {
      if (isDone) {
        numEl.innerHTML = '<span class="step-check-icon">✓</span>';
        numEl.title = `Bước 0${x}: Đã hoàn tất`;
      } else {
        numEl.textContent = `0${x}`;
        numEl.title = isHitl ? `Bước 0${x}: Chốt chặn con người (HITL) - Cần kiểm tra và phê duyệt` : `Bước 0${x}`;
      }
    }

    el.disabled = !access.enabled;
    el.title = isHitl && !isDone && access.enabled ? `Chốt chặn con người: ${access.reason}` : access.reason;
    if (x === state.step) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  });
  const navigationHint=document.querySelector('#stepNavigationHint');
  if (navigationHint) navigationHint.textContent=state.processing || state.uploading ? 'Agent đang xử lý. Bạn có thể chuyển bước khi hoàn tất.' : 'Bấm trực tiếp vào bước đã mở để xem lại. Các lựa chọn và hồ sơ đã duyệt được giữ trong phiên.';
  document.querySelectorAll('.main-nav .nav-item').forEach(el => el.classList.toggle('active', el.hash === (state.step === 'audit' ? '#audit' : state.step==='dashboard' ? '#dashboard' : '#workflow')));
  if (typeof updateWorkspaceChrome==='function') updateWorkspaceChrome();
}
function fileToBase64(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); }); }
function kindLabel(kind) { return categories.find(c => c.id === kind)?.title || 'Dữ liệu dạng bảng'; }
function queuedFiles() { return Object.values(state.datasets).flat(); }
function refreshUploadBusy() {
  const busy = state.processing || state.uploading;
  for (const id of ['file-upload', 'browseUpload', 'startClean', 'clearUploads']) { const el = document.getElementById(id); if (el) el.disabled = busy; }
  const zone = document.querySelector('#uploadZone'); if (zone) zone.classList.toggle('is-processing', busy);
  const status = document.querySelector('#uploadStatus');
  if (status) status.textContent = state.processing ? 'Agent đang nhận diện và làm sạch dữ liệu…' : state.uploading ? 'Đang đọc tệp…' : 'Tự nhận diện nội dung · Không cần chọn nhóm dữ liệu';
  updateDashboard();
}
async function queueUploadFiles(incoming, replace = false) {
  if (state.processing || state.uploading || !incoming.length) return;
  const error = document.querySelector('#upload-error');
  const invalid = [...incoming].find(file => !/\.(csv|xlsx)$/i.test(file.name));
  if (invalid) { error.innerHTML = `<div class="alert error">${esc(invalid.name)}: hãy dùng tệp CSV hoặc XLSX.</div>`; return; }
  const names = new Set([...incoming].map(f => f.name));
  const retained = replace ? [] : queuedFiles().filter(f => !names.has(f.name));
  const bytes = retained.reduce((n, f) => n + f.data.length * .75, 0) + [...incoming].reduce((n, f) => n + f.size, 0);
  if (bytes > 20 * 1024 * 1024) { error.innerHTML = '<div class="alert error">Tổng dung lượng tối đa 20 MB. Hãy chia nhỏ hoặc bớt tệp.</div>'; return; }
  state.uploading = true; refreshUploadBusy();
  try {
    const files = await Promise.all([...incoming].map(async file => ({ name: file.name, data: await fileToBase64(file) })));
    const merged = new Map([...retained, ...files].map(f => [f.name, f]));
    state.datasets = { auto: [...merged.values()] }; state.detectedFiles = []; state.clean = null; state.analysis = null;
    await runClean();
  } catch (e) { error.innerHTML = `<div class="alert error">Không đọc được tệp: ${esc(e.message)}</div>`; }
  finally { state.uploading = false; refreshUploadBusy(); }
}
function inputs() { return { leadDays: state.leadDays, adoptionThreshold: state.adoptionThreshold, feedback: state.feedback }; }
async function agentRun(stage) {
  const res = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, datasets: state.datasets, ...inputs() }) });
  return await res.json();
}
function pushAudit(kind, detail) { state.audit.unshift({ time: new Date().toLocaleString('vi-VN'), kind, detail }); try { localStorage.setItem('renewal-agent-audit', JSON.stringify(state.audit)); } catch {} }
try { state.audit = JSON.parse(localStorage.getItem('renewal-agent-audit') || '[]'); } catch { state.audit = []; }
function fmtNum(n) { return n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n); }
function money(n) { return n == null ? 'Chưa đủ căn cứ' : new Intl.NumberFormat('vi-VN').format(n) + ' ₫'; }
function stageTitle(kicker, title, desc, tag = '') { return `<div class="stage-title"><div><div class="eyebrow">${kicker}</div><h2>${title}</h2><p>${desc}</p></div>${tag ? `<span class="stage-label">${tag}</span>` : ''}</div>`; }
function errorBox(errors = [], errorCount = errors.length, remediation = state.clean?.remediation) {
  const e = errors[0];
  const reload = remediation?.action === 'reload';
  const canRepair = !reload && Object.values(state.datasets).some(files => files.length);
  return `<div class="alert error" role="alert"><b>${reload?'Cần kiểm tra file gốc và tải lại — chưa thể phân tích.':`Phát hiện ${fmtNum(errorCount)} lỗi — cần sửa tệp trước khi tiếp tục.`}</b>${reload?`<p>${esc(remediation.reason)}</p>${remediation.issues?.length?`<ul>${remediation.issues.slice(0,6).map(issue=>`<li>${esc(issue.file)} · ${esc(issue.field)}: ${fmtNum(issue.count)}${issue.total?` / ${fmtNum(issue.total)} hồ sơ`:''} thiếu, sai hoặc trùng.</li>`).join('')}</ul>`:''}`:''}${e ? `<p style="margin:6px 0 0"><b>Ví dụ:</b> ${esc(e.file)}${e.row !== '-' ? ` · dòng ${esc(e.row)}` : ''} · ${esc(e.field)}: ${esc(e.message)}</p>` : ''}${reload?'<div class="error-actions"><button type="button" id="reuploadFiles" class="btn btn-primary">↑ Chọn lại bộ tệp đã bổ sung</button><a class="btn btn-light" href="/templates/mau_du_lieu_gia_han.xlsx" download>↓ Tải file mẫu</a><span>Chọn lại toàn bộ tệp cần dùng, gồm cả các nguồn bổ sung. Chỉ thay bộ tệp cũ sau khi đọc thành công.</span></div>':canRepair ? '<div class="error-actions"><button type="button" class="btn btn-light" data-repair-mode="manual">✎ Tự sửa dữ liệu</button><button type="button" class="btn btn-primary" data-repair-mode="auto">✦ Để Agent sửa định dạng</button><span>Tệp đã được giữ lại để chỉnh sửa vài ô; Agent không tự điền thông tin nghiệp vụ còn thiếu.</span></div>' : ''}</div>`;
}
function warningsBox(warnings, title='Cảnh báo cần theo dõi', warningCount=warnings?.length || 0) { return warnings?.length ? `<details class="alert warning warnings-panel"><summary><b>${esc(title)} (${fmtNum(warningCount)})</b><span>Xem chi tiết</span></summary><ul>${warnings.slice(0, 8).map(w => `<li>${esc(w.customer_id || '')}${w.field ? ` · ${esc(w.field)}` : ''}: ${esc(w.message)}</li>`).join('')}${warningCount > 8 ? `<li>… và ${fmtNum(warningCount - 8)} cảnh báo khác.</li>` : ''}</ul><div>Hồ sơ vẫn có thể tiếp tục; giá trị thiếu được giữ là “Chưa có dữ liệu”, không đổi thành 0.</div></details>` : ''; }
function toolsSection(content) { return `<details class="stage-tools-details"><summary>Phản hồi và tham số <small>Mở khi cần xử lý lại</small></summary><div class="tools-origin"><div class="stage-tools">${content}</div></div></details>`; }
function renderUpload() {
  const files = queuedFiles();
  stageEl.innerHTML = `${stageTitle('BƯỚC 01 · ĐẦU VÀO', 'Một nơi cho tất cả dữ liệu', 'Chọn một hoặc nhiều tệp. Agent tự nhận diện nội dung, chuẩn hóa và trả kết quả làm sạch để bạn kiểm duyệt.', 'CSV · XLSX')}
    ${inputGuideTeaser()}
    <div id="upload-error" aria-live="polite">${state.clean?.blocked?errorBox(state.clean.errors,state.clean.errorCount,state.clean.remediation):''}</div>
    <div id="uploadZone" class="unified-upload"><div class="drop-icon"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 21V5m0 0-6 6m6-6 6 6M5 21v5a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Kéo thả tệp vào đây</h3><p>Hợp đồng, sử dụng, hỗ trợ hay dữ liệu khác —<br>bạn chỉ cần tải lên, Agent sẽ tự đọc và làm sạch.</p><button type="button" id="browseUpload" class="btn btn-primary">Chọn tệp từ máy <span>↗</span></button><input id="file-upload" type="file" accept=".csv,.xlsx" multiple hidden aria-label="Tải lên một hoặc nhiều tệp CSV hoặc XLSX"><span class="upload-format-note">CSV, XLSX · Chọn nhiều tệp cùng lúc · Tổng tối đa 20 MB</span><div id="uploadStatus" class="upload-agent-status" role="status"></div></div>
    ${files.length ? `<div class="upload-queue"><div class="queue-heading"><b>${files.length} tệp đang giữ trong phiên</b><button id="clearUploads" class="btn btn-quiet">Bỏ tất cả</button></div>${files.slice(0,12).map((file, i) => { const detected = state.detectedFiles.find(f => f.name === file.name); return `<div class="queued-file"><span class="file-type-icon">${/\.xlsx$/i.test(file.name) ? 'XLSX' : 'CSV'}</span><div><strong>${esc(file.name)}</strong><small>${detected ? esc(kindLabel(detected.kind)) : 'Agent sẽ tự nhận diện'}</small></div><button type="button" class="remove-upload" data-remove-upload="${i}" aria-label="Bỏ tệp ${esc(file.name)}" ${state.processing ? 'disabled' : ''}>✕</button></div>`; }).join('')}${files.length > 12 ? `<p class="microcopy">Và ${files.length - 12} tệp khác trong phiên.</p>` : ''}</div>` : ''}
    <div class="upload-process"><span><b>01</b> Nhận diện tệp</span><i>→</i><span><b>02</b> Chuẩn hóa dữ liệu</span><i>→</i><span><b>03</b> Trả bản làm sạch</span></div>
    <div class="stage-footer"><span class="microcopy">Xử lý tại localhost · Tệp gốc được giữ nguyên</span>${files.length ? '<button id="startClean" class="btn btn-light">Chạy lại làm sạch →</button>' : ''}</div>`;
  document.querySelector('#browseUpload').onclick = () => { state.replaceUploads=false; document.querySelector('#file-upload').click(); };
  const reupload = document.querySelector('#reuploadFiles');
  if(reupload)reupload.onclick=()=>{if(state.processing || state.uploading)return;state.replaceUploads=true;const input=document.querySelector('#file-upload');input.value='';input.click();};
  document.querySelector('#file-upload').onchange = e => {const replace=state.replaceUploads;state.replaceUploads=false;queueUploadFiles([...e.target.files],replace);};
  const zone = document.querySelector('#uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); if (!state.processing && !state.uploading) zone.classList.add('is-dragging'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-dragging'); });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('is-dragging'); queueUploadFiles([...e.dataTransfer.files]); });
  if (files.length) document.querySelector('#clearUploads').onclick = () => { if (state.processing || state.uploading) return; state.datasets = {}; state.clean = null; state.analysis = null; state.detectedFiles = []; setStep(1); };
  const start = document.querySelector('#startClean'); if (start) start.onclick = () => runClean();
  refreshUploadBusy();
}
async function runClean(feedback = '') {
  if (state.processing) return;
  state.processing = true; refreshUploadBusy();
  const btn = document.querySelector('#startClean') || document.querySelector('#rerunClean');
  if (btn) { btn.disabled = true; btn.textContent = 'Agent đang kiểm tra…'; }
  try {
    state.analysis = null;
    resetReview();
    if(typeof resetChartWorkspace==='function')resetChartWorkspace();
    state.drafts={clean:feedback};
    state.feedback = feedback;
    const result = await agentRun('clean');
    state.detectedFiles = result.detectedFiles || [];
    state.clean = result; (result.log || []).forEach(item => pushAudit(item.skill, `${item.action}: ${item.detail}`));
    pushAudit('data_aggregator', feedback ? `Đã chạy lại kiểm tra dữ liệu theo phản hồi: ${feedback}` : `Đã đọc và kiểm tra ${Object.values(state.datasets).flat().length} tệp`);
    if (result.blocked) { setStep(1); return; }
    state.cleanFileIndex = result.canAnalyze === false ? 0 : -1;
    setStep(2);
  } catch (e) { (document.querySelector('#upload-error') || stageEl).insertAdjacentHTML('afterbegin', `<div class="alert error">Không gọi được Agent: ${esc(e.message)}. Hãy kiểm tra kết nối với localhost.</div>`); }
  finally { state.processing = false; refreshUploadBusy(); if (btn) { btn.disabled = false; btn.textContent = feedback ? 'Chạy lại bước chuẩn hóa' : 'Chạy lại làm sạch →'; } }
}
function dataTable(rows, mode) {
  const cleanCols = [['customer_id','Mã khách'],['contract_id','Hợp đồng'],['customer_name','Khách hàng'],['plan','Gói'],['expiration_date','Hết hạn'],['licensed_users','Seat cấp'],['active_users','Active users'],['open_tickets','Ticket mở'],['snapshot_date','Ngày đối chiếu']];
  const resultCols = [['customer_id','Mã khách'],['customer_name','Khách hàng'],['plan','Gói hiện tại'],['expiration_date','Hết hạn'],['outreach_date','Liên hệ từ'],['adoption_rate','Sử dụng'],['open_tickets','Ticket mở'],['recommendation','Đề xuất'],['renewal_value','Giá trị'],['status','Tình trạng']];
  const cols = mode === 'clean' ? cleanCols : resultCols;
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  state.tablePage = Math.max(0, Math.min(state.tablePage, pages - 1));
  const start = state.tablePage * 50;
  const pageRows = rows.slice(start, start + 50);
  return `<div class="data-table-shell" data-mode="${mode}"><div class="table-wrap"><table class="data-table"><thead><tr>${cols.map(c=>`<th scope="col">${c[1]}</th>`).join('')}</tr></thead><tbody>${pageRows.map(r=>`<tr>${cols.map(c=>`<td>${c[0]==='renewal_value'?esc(money(r[c[0]])):c[0]==='adoption_rate'?(r[c[0]]==null?'Chưa có dữ liệu':`${r[c[0]]}%`):c[0]==='status'?statusTag(r[c[0]]):esc(r[c[0]] ?? 'Chưa có dữ liệu')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-pagination"><span>${rows.length ? fmtNum(start + 1) : 0}–${fmtNum(Math.min(start + 50, rows.length))} / ${fmtNum(rows.length)} hồ sơ</span><div class="pagination-actions"><button class="btn btn-light" data-table-page="${state.tablePage - 1}" ${state.tablePage === 0 ? 'disabled' : ''} aria-label="Trang trước">←</button><button class="btn btn-light" data-table-page="${state.tablePage + 1}" ${state.tablePage >= pages - 1 ? 'disabled' : ''} aria-label="Trang sau">→</button></div></div></div>`;
}
function statusTag(s) { const klass = s === 'Đủ căn cứ sơ bộ' ? 'green' : s === 'Chặn upsell' ? 'red' : 'amber'; return `<span class="tag ${klass}">${esc(s)}</span>`; }
function sourceTable(index) {
  const file = state.clean.cleanedFiles[index];
  const pages = Math.max(1, Math.ceil(file.rows.length / 50)); state.tablePage = Math.max(0, Math.min(state.tablePage, pages - 1));
  const start = state.tablePage * 50;
  return `<div class="data-table-shell" data-mode="source" data-index="${index}"><div class="table-wrap"><table class="data-table"><thead><tr>${file.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${file.rows.slice(start,start+50).map(row => `<tr>${file.headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-pagination"><span>${file.rows.length ? fmtNum(start+1) : 0}–${fmtNum(Math.min(start+50,file.rows.length))} / ${fmtNum(file.rows.length)} dòng</span><div class="pagination-actions"><button class="btn btn-light" data-table-page="${state.tablePage-1}" ${state.tablePage===0?'disabled':''} aria-label="Trang trước">←</button><button class="btn btn-light" data-table-page="${state.tablePage+1}" ${state.tablePage>=pages-1?'disabled':''} aria-label="Trang sau">→</button></div></div></div>`;
}
function downloadCleanedFile() {
  const index = state.cleanFileIndex;
  if (index < 0) { exportCsv(state.clean.rows); return; }
  const file = state.clean.cleanedFiles[index];
  const quote = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const csv = [file.headers.map(quote).join(','), ...file.rows.map(row => file.headers.map(h=>quote(row[h])).join(','))].join('\r\n');
  download('\uFEFF'+csv,file.name.replace(/\.[^.]+$/,'')+'_lam_sach.csv','text/csv;charset=utf-8');
}
function renderClean() {
  const c = state.clean;
  const canAnalyze = c.canAnalyze !== false;
  const files = c.cleanedFiles || [];
  stageEl.innerHTML = `${stageTitle('BƯỚC 02 · KẾT QUẢ LÀM SẠCH', 'Agent đã làm sạch dữ liệu', 'Xem nội dung đã chuẩn hóa, tải bản làm sạch hoặc phản hồi để Agent xử lý lại.', 'Chờ người duyệt')}
    ${c.cleaningSummary ? `<div class="clean-report"><span><b>${fmtNum(c.cleaningSummary.files)}</b> tệp đã nhận diện</span><span><b>${fmtNum(c.cleaningSummary.totalRows)}</b> dòng đã xử lý</span><span><b>${fmtNum(c.cleaningSummary.renamed)}</b> tên cột chuẩn hóa</span><span><b>${fmtNum(c.cleaningSummary.dates)}</b> ô ngày chuẩn hóa</span></div>${c.cleaningSummary.duplicateRows ? `<div class="alert warning">Có ${fmtNum(c.cleaningSummary.duplicateRows)} dòng trùng hoàn toàn. Agent giữ lại để bạn kiểm tra; có thể dùng chức năng sửa dữ liệu để lựa chọn loại trùng.</div>` : ''}` : ''}
    ${!canAnalyze ? '<div class="alert warning">Đã làm sạch dữ liệu dạng bảng. Chưa nhận diện được hợp đồng có ngày hết hạn để phân tích gia hạn; bạn có thể tải kết quả dưới đây hoặc bổ sung tệp hợp đồng.</div>' : ''}
    ${inputQualityMarkup(c.inputQuality)}
    ${warningsBox(c.warnings,'Cảnh báo cần theo dõi',c.warningCount)}
    ${files.length ? `<div class="clean-file-toolbar"><label>Kết quả đang xem<select id="cleanFileSelect">${c.rows.length ? `<option value="-1" ${state.cleanFileIndex < 0?'selected':''}>Hồ sơ hợp đồng đã ghép (${c.rows.length})</option>` : ''}${files.map((f,i)=>`<option value="${i}" ${state.cleanFileIndex===i?'selected':''}>${esc(f.name)} · ${esc(kindLabel(f.kind))}</option>`).join('')}</select></label><button class="btn btn-light" id="downloadCleaned">↓ Tải CSV đã làm sạch</button></div>` : ''}
    <div id="cleanTableHost">${state.cleanFileIndex>=0 && files.length ? sourceTable(state.cleanFileIndex) : dataTable(c.rows || [], 'clean')}</div>
    ${toolsSection(`<div class="feedback-wrap"><label for="cleanFeedback">Phản hồi để AI làm sạch lại</label><textarea id="cleanFeedback" class="feedback" placeholder="Mô tả dữ liệu cần kiểm tra lại…">${esc(state.drafts.clean ?? '')}</textarea><small>AI tạo phiên bản mới; tệp gốc được giữ nguyên.</small></div><button id="rerunClean" data-tools-run class="btn btn-light">↻ Chạy lại chuẩn hóa</button>`)}
    <div class="stage-footer"><button id="backUpload" class="btn btn-quiet">← Bổ sung / đổi tệp</button><div class="result-actions"><button class="btn btn-light" data-repair-mode="manual">✎ Sửa dữ liệu</button><button id="approveClean" class="btn btn-primary" ${canAnalyze?'':'disabled title="Cần dữ liệu hợp đồng có ngày hết hạn"'}>Dữ liệu đạt　→</button></div></div>`;
  document.querySelector('#backUpload').onclick = () => setStep(1);
  document.querySelector('#rerunClean').onclick = () => runClean(document.querySelector('#cleanFeedback').value.trim());
  document.querySelector('#approveClean').onclick = () => runAnalysis();
  if (files.length) {
    document.querySelector('#downloadCleaned').onclick = downloadCleanedFile;
    document.querySelector('#cleanFileSelect').onchange = e => { state.cleanFileIndex = Number(e.target.value); state.tablePage = 0; document.querySelector('#cleanTableHost').innerHTML = state.cleanFileIndex < 0 ? dataTable(c.rows,'clean') : sourceTable(state.cleanFileIndex); };
  }
}
async function runAnalysis(feedback = '') {
  if (state.processing) return;
  state.processing = true;
  if ([3,4].includes(state.step)) syncReviewActions(); else updateDashboard();
  const lead = Number(document.querySelector('#leadDays')?.value ?? state.drafts.analysisParams?.leadDays ?? state.leadDays); const threshold = Number(document.querySelector('#threshold')?.value ?? state.drafts.analysisParams?.threshold ?? state.adoptionThreshold);
  state.leadDays = lead; state.adoptionThreshold = threshold; state.feedback = feedback;
  const button = document.querySelector('#approveClean') || document.querySelector('#rerunAnalysis'); if (button) { button.disabled = true; button.textContent = 'Agent đang phân tích…'; }
  try {
    const result = await agentRun('analyze'); state.analysis = result;
    if (result.blocked) { state.analysis = null; state.clean = result; setStep(1); return; }
    (result.log || []).forEach(item => pushAudit(item.skill, `${item.action}: ${item.detail}`));
    pushAudit('renewal_pipeline', feedback ? `Đã phân tích lại theo phản hồi: ${feedback}` : 'Đã chạy phân tích gia hạn và kiểm tra quy tắc chính sách');
    resetReview();
    state.drafts={...state.drafts,analysis:feedback,final:'',analysisParams:null};
    setStep(3);
  } catch (e) { stageEl.insertAdjacentHTML('afterbegin', `<div class="alert error">Agent gặp lỗi: ${esc(e.message)}</div>`); }
  finally { state.processing = false; if (button) { button.disabled = false; button.textContent = 'Dữ liệu đạt　→'; } syncReviewActions(); }
}
function renderAnalysis() {
  const a = state.analysis;
  stageEl.innerHTML = `${stageTitle('BƯỚC 03 · PHÂN TÍCH', 'Đề xuất gia hạn', 'Agent đã tính ngày liên hệ, mức sử dụng và kiểm tra chốt chặn ticket trước khi đề xuất.', 'Cần duyệt kết quả')}
    <div class="review-context"><strong id="reviewContextTotal"></strong><span id="reviewContextValue"></span></div>
    ${warningsBox(a.warnings,'Cần xác minh trước khi chốt',a.warningCount)}${reviewWorkspace()}
    <p class="microcopy" id="reviewExportNotice" role="status"></p>
    ${toolsSection(`<div class="feedback-wrap"><label for="analysisFeedback">Phản hồi hoặc điều chỉnh tham số</label><textarea id="analysisFeedback" class="feedback" placeholder="Mô tả điểm cần điều chỉnh…">${esc(state.drafts.analysis ?? state.feedback)}</textarea></div><div class="parameter-fields"><label for="leadDays">Liên hệ trước hạn</label><input id="leadDays" type="number" min="0" max="365" value="${esc(state.drafts.analysisParams?.leadDays ?? state.leadDays)}"><span class="microcopy">ngày</span><label for="threshold">Ngưỡng adoption upsell</label><input id="threshold" type="number" min="0" max="100" value="${esc(state.drafts.analysisParams?.threshold ?? state.adoptionThreshold)}"><span class="microcopy">%</span></div><p class="microcopy">Chạy lại tạo kết quả mới và cần duyệt lại.</p><button id="rerunAnalysis" data-tools-run class="btn btn-light">↻ Chạy lại phân tích</button>`)}
    <div class="stage-footer"><button id="backClean" class="btn btn-quiet">← Quay lại duyệt dữ liệu</button><div class="result-actions"><button id="reviewOutput" class="btn btn-primary" disabled>Chọn hồ sơ để chuyển duyệt →</button></div></div>`;
  document.querySelector('#backClean').onclick = () => setStep(2);
  document.querySelector('#rerunAnalysis').onclick = () => runAnalysis(document.querySelector('#analysisFeedback').value.trim());
  document.querySelector('#reviewOutput').onclick = transferReviewSelection;
  syncReviewActions();
}
function renderFinal() {
  const a = state.analysis;
  const reviewCustomers = new Set(reviewBaseRows().map(row=>row.customer_id));
  stageEl.innerHTML = `${stageTitle('BƯỚC 04 · DUYỆT CUỐI', 'Xem lại trước khi xuất', 'Kiểm tra hồ sơ, các giới hạn dữ liệu và quyết định phiên bản nào được bàn giao.', 'Chưa xuất kết quả')}
    <div class="alert success" id="finalSelectionSummary" role="status"></div>
    ${warningsBox((a.warnings || []).filter(w=>reviewCustomers.has(w.customer_id)),'Thông tin cần nêu rõ khi bàn giao')}${reviewWorkspace()}
    <p class="microcopy" id="reviewExportNotice" role="status"></p>
    ${toolsSection(`<div class="feedback-wrap"><label for="finalFeedback">Phản hồi cho Agent nếu cần chạy lại</label><textarea id="finalFeedback" class="feedback" placeholder="Ghi điểm chưa đạt…">${esc(state.drafts.final ?? state.feedback)}</textarea><small>Chạy lại tạo phiên bản mới cần duyệt lại.</small></div><button id="rerunFinal" data-tools-run class="btn btn-light">↻ Gửi phản hồi & chạy lại</button>`)}
    <div class="stage-footer"><button id="backAnalysis" class="btn btn-quiet">← Chọn thêm hồ sơ</button><div class="result-actions"><button id="approveSelected" class="btn btn-light" disabled>✓ Duyệt hồ sơ đã chọn</button><button id="exportHtml" class="btn btn-light" disabled>Duyệt & xuất HTML</button><button id="exportCsv" class="btn btn-primary" disabled>✓ Duyệt & xuất CSV</button></div></div><p class="microcopy">Hồ sơ đã duyệt được chuyển sang mục Đã duyệt trong phiên kết quả hiện tại.</p>`;
  document.querySelector('#backAnalysis').onclick = () => { reviewState.view='pending'; reviewState.selected.clear(); reviewState.query=''; reviewState.filter='all'; setStep(3); };
  document.querySelector('#rerunFinal').onclick = () => runAnalysis(document.querySelector('#finalFeedback').value.trim());
  document.querySelector('#exportCsv').onclick = () => exportReviewSelection('csv');
  document.querySelector('#exportHtml').onclick = () => exportReviewSelection('html');
  document.querySelector('#approveSelected').onclick = approveReviewSelection;
  syncReviewActions();
}
function renderAudit() {
  stageEl.innerHTML = `${stageTitle('TRUY VẾT · SKILL LOG', 'Nhật ký Agent', 'Lịch sử các kỹ năng đã chạy và các điểm người duyệt đã xác nhận.', 'Lưu trong trình duyệt')}
    ${state.audit.length ? `<div class="log-list">${state.audit.map(a=>`<div class="log-item"><b>${esc(a.kind)}</b><span>${esc(a.detail)}</span><small>${esc(a.time)}</small></div>`).join('')}</div>` : '<div class="empty-state"><div class="big">◷</div><b>Chưa có lượt chạy nào</b><p>Nhật ký sẽ xuất hiện sau khi Agent đọc dữ liệu.</p></div>'}
    <div class="stage-footer"><button id="backToFlow" class="btn btn-quiet">← Về quy trình</button><button id="clearAudit" class="btn btn-light">Xóa nhật ký</button></div>`;
  document.querySelector('#backToFlow').onclick = () => setStep(state.analysis ? 3 : state.clean ? 2 : 1);
  document.querySelector('#clearAudit').onclick = () => { state.audit = []; localStorage.removeItem('renewal-agent-audit'); renderAudit(); };
}
function render() { updateDashboard(); if(state.step==='dashboard'){renderChartWorkspace();return;} if (state.step === 'audit') { renderAudit(); return; } if (state.step === 1) renderUpload(); else if (state.step === 2) renderClean(); else if (state.step === 3) renderAnalysis(); else renderFinal(); }
function exportCsv(rows) {
  const cols = ['customer_id','contract_id','customer_name','plan','expiration_date','outreach_date','licensed_users','active_users','adoption_rate','open_tickets','recommendation','reason','renewal_value','policy_status','status'];
  const csv = [cols.join(','), ...rows.map(r=>cols.map(c=>`"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(','))].join('\r\n'); download('\uFEFF'+csv,'an-tin-de-xuat-gia-han.csv','text/csv;charset=utf-8');
}
function exportHtml(rows) {
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Báo cáo gia hạn An Tín</title><style>body{font:14px Arial;color:#18333a;margin:36px}h1{color:#167f75}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#edf6f3} .note{color:#61777d}</style><h1>Đề xuất gia hạn hợp đồng</h1><p class="note">Tạo bởi An Tín Renewal Agent · ${new Date().toLocaleString('vi-VN')}</p><table><thead><tr><th>Mã khách</th><th>Hợp đồng</th><th>Khách hàng</th><th>Hết hạn</th><th>Ngày liên hệ</th><th>Adoption</th><th>Ticket mở</th><th>Đề xuất</th><th>Căn cứ</th><th>Giá trị</th><th>Tình trạng</th></tr></thead><tbody>${rows.map(r=>`<tr>${[r.customer_id,r.contract_id,r.customer_name,r.expiration_date,r.outreach_date,r.adoption_rate==null?'Chưa có dữ liệu':r.adoption_rate+'%',r.open_tickets??'Chưa có dữ liệu',r.recommendation,r.reason,money(r.renewal_value),r.status].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">Thông tin thiếu được ghi rõ là chưa có dữ liệu. Ưu đãi và quyết định cuối cần người có thẩm quyền xác nhận.</p></html>`;
  download(html,'an-tin-de-xuat-gia-han.html','text/html;charset=utf-8');
}
function download(content, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
document.querySelector('#demoBtn').onclick = () => {
  const enc = s => btoa(unescape(encodeURIComponent(s)));
  state.datasets = {
    contracts: [{name:'hop-dong-mau.csv',data:enc('customer_id,contract_id,customer_name,plan,expiration_date,licensed_users\nKH001,HĐ-001,Công ty Minh An,Pro,2026-12-20,50\nKH002,HĐ-002,Công ty Sao Việt,Basic,2027-01-15,20\nKH003,HĐ-003,Công ty Hướng Dương,Pro,2026-12-05,30\nKH004,HĐ-004,Công ty Đại Phát,Team,2027-02-28,12')}],
    usage: [{name:'su-dung-mau.csv',data:enc('customer_id,active_users,snapshot_date\nKH001,44,2026-11-01\nKH002,5,2026-11-01\nKH003,18,2026-11-01')}],
    support: [{name:'ticket-mau.csv',data:enc('customer_id,open_tickets,status\nKH001,0,Resolved\nKH002,1,Open\nKH003,0,Resolved')}],
    policies: [{name:'chinh-sach-mau.csv',data:enc('customer_id,price,discount\nKH001,12000000,10\nKH002,6000000,0\nKH003,12000000,5')}]
  };
  state.feedback = ''; state.clean = null; state.analysis = null; state.audit = []; pushAudit('demo', 'Đã nạp 4 hồ sơ mẫu, gồm ticket mở và dữ liệu nghiệp vụ thiếu'); state.clean = null; runClean();
};
document.querySelector('.main-nav a[href="#audit"]').onclick = e => { e.preventDefault(); if(state.processing || state.uploading) return; saveStepDraft(); setStep('audit'); };
document.querySelectorAll('a[href="#workflow"]').forEach(link => { link.onclick = e => { e.preventDefault(); if (['audit','dashboard'].includes(state.step)) navigateStep(state.lastWorkflowStep); }; });
stageEl.addEventListener('click', e => {
  const remove = e.target.closest('[data-remove-upload]');
  if (remove) {
    if (state.processing || state.uploading) return;
    const files = queuedFiles(); files.splice(Number(remove.dataset.removeUpload),1);
    state.datasets = files.length ? { auto:files } : {}; state.clean = null; state.analysis = null; state.detectedFiles = []; setStep(1);
    if (files.length) runClean(); return;
  }
  const button = e.target.closest('[data-table-page]');
  if (!button || button.disabled) return;
  const table = button.closest('.data-table-shell');
  const mode = table.dataset.mode;
  state.tablePage = Number(button.dataset.tablePage);
  table.outerHTML = mode === 'source' ? sourceTable(Number(table.dataset.index)) : dataTable(mode === 'clean' ? state.clean.rows : state.analysis.rows, mode);
});
document.querySelector('#steps').addEventListener('click',event=>{
  const button=event.target.closest('button[data-step]');
  if (button && !button.disabled) navigateStep(button.dataset.step);
});
render();

