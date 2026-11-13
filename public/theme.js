const themeStorageKey='an-tin-workspace-theme';
let themeChangeTimer;
let themeTransition=null,themeRevision=0;
function themeRevealOrigin(){
  const width=typeof window==='undefined'?0:window.innerWidth;
  const height=typeof window==='undefined'?0:window.innerHeight;
  const button=document.getElementById('themeToggle');
  const control=button?.querySelector?.('.theme-switch') || button;
  const rect=control?.getBoundingClientRect?.();
  const x=rect?rect.left+rect.width/2:width/2,y=rect?rect.top+rect.height/2:height/2;
  const visible=x>=0 && x<=width && y>=0 && y<=height;
  const origin={x:visible?x:width/2,y:visible?y:height/2};
  return {...origin,radius:Math.ceil(Math.hypot(Math.max(origin.x,width-origin.x),Math.max(origin.y,height-origin.y)))+2};
}
function preferredTheme(){
  try{const saved=localStorage.getItem(themeStorageKey);if(saved==='light'||saved==='dark')return saved;}catch{}
  return typeof matchMedia==='function' && matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
}
function syncThemeControl(){
  const button=document.getElementById('themeToggle');if(!button)return;
  const dark=document.documentElement.dataset.theme==='dark';
  button.setAttribute('aria-checked',String(dark));
  button.title=dark?'Chuyển sang chế độ sáng':'Chuyển sang chế độ tối';
  const status=document.getElementById('themeStatus');if(status)status.textContent=dark?'Đang bật':'Đang tắt';
}
function applyWorkspaceTheme(theme,{persist=false,animate=false}={}){
  const root=document.documentElement;
  if(theme!=='dark' && theme!=='light')return;
  const changed=root.dataset.theme!==theme,revision=++themeRevision;
  clearTimeout(themeChangeTimer);
  themeTransition?.skipTransition();themeTransition=null;
  root.classList.remove('theme-revealing','theme-changing');
  const reduced=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
  const moving=animate && changed && !reduced;
  const commit=()=>{
    if(revision!==themeRevision)return;
    root.dataset.theme=theme;root.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111214':'#e9e8e6');
    if(persist)try{localStorage.setItem(themeStorageKey,theme);}catch{}
    syncThemeControl();
  };
  if(moving && typeof document.startViewTransition==='function' && typeof root.animate==='function'){
    const {x,y,radius}=themeRevealOrigin();
    root.classList.add('theme-revealing');
    try{
      const transition=document.startViewTransition(commit);themeTransition=transition;
      transition.ready.then(()=>{
        if(revision!==themeRevision)return;
        root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
          {duration:1100,easing:'cubic-bezier(.45,0,.2,1)',pseudoElement:'::view-transition-new(root)'});
      }).catch(()=>transition.skipTransition());
      return transition.finished.catch(commit).finally(()=>{
        if(revision!==themeRevision)return;
        themeTransition=null;root.classList.remove('theme-revealing');
      });
    }catch{root.classList.remove('theme-revealing');themeTransition=null;}
  }
  root.classList.toggle('theme-changing',moving);
  commit();
  if(moving)themeChangeTimer=setTimeout(()=>root.classList.remove('theme-changing'),1000);
}
function initThemeControls(){
  syncThemeControl();
  const button=document.getElementById('themeToggle');if(!button)return;
  button.onclick=()=>{
    if(themeTransition)return;
    return applyWorkspaceTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:true,animate:true});
  };
}
applyWorkspaceTheme(preferredTheme());
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
  if(event.key===themeStorageKey || event.key===null)applyWorkspaceTheme(preferredTheme(),{animate:true});
});

/**
 * ==============================================================================
 * HỆ THỐNG THÔNG BÁO NỔI (TOAST NOTIFICATION) & COPY CLIPBOARD
 * ==============================================================================
 */
window.showToast = function (message, type = 'success', duration = 3000) {
  if (typeof document === 'undefined') return;
  let container = document.querySelector('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fading');
    setTimeout(() => toast.remove(), 280);
  }, duration);
};

window.copyToClipboard = async function (text, successMsg = 'Đã sao chép vào bộ nhớ tạm!') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    if (typeof window.showToast === 'function') {
      window.showToast(successMsg, 'success');
    }
    return true;
  } catch (err) {
    console.warn('Copy failed:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Không thể tự động sao chép. Vui lòng chọn và copy thủ công.', 'info');
    }
    return false;
  }
};

