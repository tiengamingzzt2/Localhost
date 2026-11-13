const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function launcher(statuses){
  const calls=[],messages=[],taskProcess=new EventEmitter();taskProcess.execPath=process.execPath;
  const http={get(url,options,onResponse){
    const request=new EventEmitter();request.destroy=error=>request.emit('error',error || Error('aborted'));
    const status=statuses.shift();
    queueMicrotask(()=>{
      if(status==='offline'){request.emit('error',Object.assign(Error('offline'),{code:'ECONNREFUSED'}));return;}
      const response=new EventEmitter();response.setEncoding=()=>{};response.statusCode=200;
      onResponse(response);response.emit('data',status==='ready'?'<main id="workflow"><script src="/app.js"></script>':'Another application');response.emit('end');
    });
    return request;
  }};
  const spawn=(command,args,options)=>{
    const child=new EventEmitter();child.unref=()=>{};child.kill=()=>{child.killed=true;};
    calls.push({command,args,options,child,ready:messages.some(line=>line.includes('Agent đã sẵn sàng'))});
    if(command===process.execPath)setTimeout(()=>child.emit('exit',0),20);
    return child;
  };
  const module={exports:{}};
  const ctx={require:name=>name==='node:http'?http:name==='node:child_process'?{spawn}:require(name),module,__dirname:path.resolve(__dirname,'../scripts'),process:taskProcess,setTimeout,console:{log:message=>messages.push(message),error:()=>{}}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../scripts/start-agent.cjs'),'utf8'),ctx);
  return {...module.exports,calls};
}

test('launcher reuses the existing Agent and never terminates or duplicates it',async()=>{
  const app=launcher(['ready']);await app.startAgent({openBrowser:false});assert.equal(app.calls.length,0);
});
test('launcher does not replace an unrelated service on port 4173',async()=>{
  const app=launcher(['occupied']);await assert.rejects(app.startAgent({openBrowser:false}),/4173/);assert.equal(app.calls.length,0);
});
test('launcher starts from its own folder and opens the browser only after readiness',async()=>{
  const app=launcher(['offline','ready']);await app.startAgent();
  assert.equal(app.calls.length,2);
  assert.equal(app.calls[0].command,process.execPath);
  assert.equal(app.calls[0].args[0],path.resolve(__dirname,'../server.js'));
  assert.equal(app.calls[0].options.cwd,path.resolve(__dirname,'..'));
  assert.equal(app.calls[0].child.killed,undefined);
  assert.equal(app.calls[1].command,'cmd.exe');assert.equal(app.calls[1].ready,true);
  assert.equal(app.calls[1].args[2],'start "" "http://127.0.0.1:4173/"');
  assert.equal(app.calls[1].options.windowsHide,true);
});
