const toolsDialog=document.querySelector('#toolsDialog');
const toolsDialogContent=document.querySelector('#toolsDialogContent');
let toolsSource=null, toolsOrigin=null, toolsStep=null;
const mobileSidebar=typeof matchMedia==='function' ? matchMedia('(max-width:900px)') : null;
let workspaceAnimation=null;
function animateWorkspaceTransition(previous,next,target=stageEl) {
  workspaceAnimation?.cancel();workspaceAnimation=null;
  if(typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  if(typeof target?.animate!=='function')return;
  workspaceAnimation=target.animate([
    {opacity:.94},
    {opacity:1}
  ],{duration:180,easing:'ease-out'});
}

function updateWorkspaceChrome() {
  const busy=state.processing || state.uploading;
  const reviewing=[3,4].includes(state.step) && !!state.analysis;
  const labels={1:'01 / Nạp dữ liệu',2:'02 / Duyệt dữ liệu',3:'03 / Phân tích',4:'04 / Duyệt kết quả',audit:'Nhật ký Agent',dashboard:'Dashboard / Biểu đồ'};
  document.querySelector('#currentStageLabel').textContent=labels[state.step];
  document.querySelector('#sidebarCharts').disabled=busy;
  document.querySelector('#sidebarCharts').classList.toggle('active',state.step==='dashboard');
  if(state.step==='dashboard')document.querySelector('#sidebarCharts').setAttribute('aria-current','page');else document.querySelector('#sidebarCharts').removeAttribute('aria-current');
  const tools=document.querySelector('#sidebarTools');
  tools.disabled=busy || ![2,3,4].includes(state.step);
  tools.title=tools.disabled?'Mở bước có dữ liệu để phản hồi hoặc điều chỉnh tham số.':'Mở cửa sổ phản hồi và chạy lại cho bước hiện tại.';
  const approved=(state.analysis?.rows || []).filter(row=>reviewState.approved.has(reviewKey(row))).length;
  document.querySelector('#sidebarApprovedCount').textContent=fmtNum(approved);
  document.querySelector('#sidebarApproved').disabled=busy || !state.analysis;
  const overview=document.querySelector('#overviewPanel'), overviewButton=document.querySelector('#sidebarOverview');
  overviewButton.innerHTML=`<span>◫</span> ${overview.open?'Ẩn':'Hiện'} thống kê`;
  overviewButton.setAttribute('aria-expanded',String(overview.open));
  const filters=document.querySelector('#sidebarFilters');
  if (filters) {
    filters.hidden = true;
    filters.innerHTML = '';
  }
  const primary=document.querySelector('#sidebarPrimary');
  let target='',text='',available=!busy;
  if(state.step===1){target='browseUpload';text='＋ Chọn tệp';}
  else if(state.step===2){target=state.clean?.canAnalyze===false?'downloadCleaned':'approveClean';text=state.clean?.canAnalyze===false?'↓ Tải bản làm sạch':'Dữ liệu đạt → Phân tích';}
  else if(reviewing){
    const selected=selectedReviewRows().length;
    if(state.step===3){target='reviewOutput';text=`Chuyển duyệt ${fmtNum(selected)} hồ sơ →`;available=available && selected>0 && reviewState.view==='pending';}
    else {target=reviewState.view==='approved'?'exportCsv':'approveSelected';text=reviewState.view==='approved'?`↓ Tải ${fmtNum(selected)} hồ sơ đã duyệt`:`✓ Duyệt ${fmtNum(selected)} hồ sơ`;available=available && selected>0;}
  } else {text='← Về quy trình';target='workflow';}
  primary.dataset.target=target;primary.textContent=text;primary.disabled=!available;
}
function setSidebarOpen(open) {
  document.querySelector('#workspaceSidebar').classList.toggle('is-open',open);
  document.querySelector('#workspaceSidebar').inert=!!mobileSidebar?.matches && !open;
  document.querySelector('#sidebarBackdrop').hidden=!open || !mobileSidebar?.matches;
  document.querySelector('#toggleSidebar').setAttribute('aria-expanded',String(open));
}
function openWorkspaceTools() {
  if(state.processing || state.uploading || ![2,3,4].includes(state.step) || toolsDialog.open) return false;
  const source=document.querySelector('#stage .stage-tools');
  if(!source?.parentElement) return false;
  toolsSource=source;toolsOrigin=source.parentElement;toolsStep=state.step;
  document.querySelector('#toolsDialogTitle').textContent=({2:'Phản hồi dữ liệu',3:'Phản hồi và tham số',4:'Phản hồi duyệt cuối'})[state.step];
  toolsDialogContent.appendChild(source);toolsDialog.showModal();setSidebarOpen(false);
  return true;
}
function restoreWorkspaceTools() {
  if(toolsSource){
    if(toolsOrigin?.isConnected && state.step===toolsStep){saveStepDraft();toolsOrigin.appendChild(toolsSource);}
    else toolsSource.remove();
  }
  toolsSource=null;toolsOrigin=null;toolsStep=null;toolsDialogContent.innerHTML='';
}
function openApprovedFromSidebar() {
  if(state.processing || state.uploading || !state.analysis) return;
  saveStepDraft();
  if(![3,4].includes(state.step)) setStep(3);
  setReviewView('approved');setSidebarOpen(false);
}

document.querySelector('#sidebarPrimary').onclick=()=>{
  const button=document.querySelector('#sidebarPrimary');
  if(button.disabled || state.processing || state.uploading) return;
  if(button.dataset.target==='workflow') navigateStep(state.lastWorkflowStep);
  else document.getElementById(button.dataset.target)?.click();
  setSidebarOpen(false);
};
document.querySelector('#sidebarFilters').addEventListener('click',event=>{
  const button=event.target.closest('[data-side-review-filter]');
  if(button && !button.disabled){setReviewFilter(button.dataset.sideReviewFilter);setSidebarOpen(false);}
});
document.querySelector('#sidebarTools').onclick=openWorkspaceTools;
document.querySelector('#sidebarCharts').onclick=()=>{if(state.processing || state.uploading)return;saveStepDraft();setStep('dashboard');setSidebarOpen(false);};
document.querySelector('#sidebarApproved').onclick=openApprovedFromSidebar;
document.querySelector('#sidebarOverview').onclick=()=>{const panel=document.querySelector('#overviewPanel');panel.open=!panel.open;updateWorkspaceChrome();};
document.querySelector('#overviewPanel').addEventListener('toggle',updateWorkspaceChrome);
document.querySelector('#closeTools').onclick=()=>toolsDialog.close();
toolsDialog.addEventListener('close',restoreWorkspaceTools);
toolsDialog.addEventListener('click',event=>{if(event.target.closest('[data-tools-run]'))toolsDialog.close();});
document.querySelector('#aboutBtn').onclick=()=>{document.querySelector('#aboutDialog').showModal();setSidebarOpen(false);};
document.querySelector('#closeAbout').onclick=()=>document.querySelector('#aboutDialog').close();
document.querySelector('#toggleSidebar').onclick=()=>setSidebarOpen(true);
document.querySelector('#closeSidebar').onclick=()=>setSidebarOpen(false);
document.querySelector('#sidebarBackdrop').onclick=()=>setSidebarOpen(false);
document.querySelector('#workspaceSidebar').addEventListener('keydown',event=>{if(event.key==='Escape'){setSidebarOpen(false);document.querySelector('#toggleSidebar').focus();}});
document.querySelector('#steps').addEventListener('click',event=>{if(event.target.closest('button[data-step]:not(:disabled)'))setSidebarOpen(false);});
document.querySelectorAll('.main-nav a').forEach(link=>link.addEventListener('click',()=>setSidebarOpen(false)));
mobileSidebar?.addEventListener('change',()=>setSidebarOpen(false));
setSidebarOpen(false);
updateWorkspaceChrome();
if(typeof initThemeControls==='function')initThemeControls();
