const http=require('node:http');
const path=require('node:path');
const {spawn}=require('node:child_process');
const projectDir=path.resolve(__dirname,'..');
const appUrl='http://127.0.0.1:4173/';

function probeApp(url=appUrl){
  return new Promise(resolve=>{
    const request=http.get(url,{timeout:1000},response=>{
      let html='';response.setEncoding('utf8');
      response.on('data',chunk=>{html+=chunk;if(html.length>100000)request.destroy();});
      response.on('end',()=>resolve(response.statusCode===200 && html.includes('/app.js') && html.includes('id="workflow"')?'ready':'occupied'));
      response.on('error',()=>resolve('occupied'));
    });
    request.on('timeout',()=>request.destroy(new Error('timeout')));
    request.on('error',error=>resolve(error.code==='ECONNREFUSED'?'offline':'occupied'));
  });
}
function openApp(){
  // Fixed localhost URL; no file names or user data are passed to the shell.
  const browser=spawn('cmd.exe',['/d','/c',`start "" "${appUrl}"`],{windowsHide:true,windowsVerbatimArguments:true,stdio:'ignore'});
  browser.once('error',()=>console.log(`Không mở được trình duyệt tự động. Mở ${appUrl}`));
  browser.unref();
}
async function startAgent({openBrowser=true}={}){
  console.log('\nAN TÍN · KHỞI ĐỘNG AGENT\n');
  const status=await probeApp();
  if(status==='ready'){
    console.log(`Server đang chạy: ${appUrl}\nĐã dùng lại server hiện có.`);
    if(openBrowser)openApp();return;
  }
  if(status==='occupied')throw new Error('Cổng 4173 đang được một ứng dụng khác sử dụng hoặc không phản hồi. Hãy đóng ứng dụng đó rồi mở lại file khởi động.');
  console.log('Đang khởi động server...');
  const server=spawn(process.execPath,[path.join(projectDir,'server.js')],{cwd:projectDir,windowsHide:true,stdio:'inherit'});
  let failure=null,stopping=false;
  const exited=new Promise(resolve=>{
    server.once('error',error=>{failure=error;resolve(1);});
    server.once('exit',code=>{if(!stopping)failure=new Error(`Server đã dừng (mã ${code ?? 'không xác định'}).`);resolve(code);});
  });
  const stop=()=>{stopping=true;server.kill();};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    const deadline=Date.now()+10000;
    let ready=false;
    while(Date.now()<deadline && !stopping){
      if(failure)throw failure;
      if(await probeApp()==='ready'){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(stopping)return;
    if(failure)throw failure;
    if(!ready)throw new Error('Server chưa sẵn sàng sau 10 giây. Kiểm tra thông báo trong cửa sổ này.');
    console.log(`\nAgent đã sẵn sàng: ${appUrl}`);
    console.log('Giữ cửa sổ này khi làm việc. Nhấn Ctrl+C để dừng server.\n');
    if(openBrowser)openApp();
    const code=await exited;
    if(!stopping && code!==0)throw failure || new Error('Server đã dừng bất thường.');
  }catch(error){server.kill();throw error;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
module.exports={probeApp,startAgent};
if(require.main===module)startAgent({openBrowser:!process.argv.includes('--no-open')}).catch(error=>{
  console.error(`\nKhông thể khởi động: ${error.message}`);process.exitCode=1;
});
