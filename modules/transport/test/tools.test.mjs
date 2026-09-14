import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createPathPolicy } from '../src/path-policy.mjs';
import { createToolRuntime, TOOL_DEFINITIONS } from '../src/tools.mjs';
import { makeFixture } from './helpers.mjs';

async function runtimeFixture(t){
  const f=await makeFixture();
  t.after(f.cleanup);
  const stateDir=path.join(f.base,'state');
  const recycled=[];
  const recycle=async(p,isDir)=>{recycled.push({p,isDir});await fs.rm(p,{recursive:isDir,force:true});};
  const runner=async({command,args,cwd,timeoutMs})=>({ok:true,stdout:`${command}:${args.join(',')}`,stderr:'',exitCode:0,signal:null,durationMs:1,cwdSeen:cwd,timeoutSeen:timeoutMs});
  const policy=await createPathPolicy(f.root);
  const runtime=createToolRuntime({policy,maxReadBytes:1024*1024,stateDir,commandTimeoutMs:1234,recycleBin:true,recycle,runner});
  return{f,runtime,recycled,stateDir};
}

async function names(dir){return (await fs.readdir(dir)).sort();}

async function walkFiles(dir){
  const out=[];
  async function walk(current){
    for(const e of await fs.readdir(current,{withFileTypes:true})){
      const p=path.join(current,e.name);
      if(e.isDirectory())await walk(p);else out.push(p);
    }
  }
  try{await walk(dir);}catch(error){if(error?.code!=='ENOENT')throw error;}
  return out;
}

test('tool definitions include Sprint-2 operations',()=>{
  assert.deepEqual(TOOL_DEFINITIONS.map(x=>x.name),['list_directory','read_file','create_file','write_file','modify_file','create_directory','copy_path','move_path','delete_path','run_command']);
});

test('recovery state is created lazily only when a recoverable mutation needs it',async(t)=>{
  const {runtime,stateDir}=await runtimeFixture(t);
  await assert.rejects(()=>fs.access(stateDir));
  let r=await runtime.createFile({path:'lazy.txt',text:'before'});
  assert.equal(r.ok,true);
  await assert.rejects(()=>fs.access(stateDir));
  r=await runtime.writeFile({path:'lazy.txt',text:'after'});
  assert.equal(r.ok,true);
  const recoveryFiles=await walkFiles(path.join(stateDir,'recovery'));
  assert.ok(recoveryFiles.some(p=>p.endsWith('content.bin')));
  assert.ok(recoveryFiles.some(p=>p.endsWith('metadata.json')));
});

test('CRUD works and recovery stays out of workspace',async(t)=>{
  const {f,runtime,recycled,stateDir}=await runtimeFixture(t);
  let r=await runtime.createFile({path:'new.txt',text:'alpha beta'});
  assert.equal(r.ok,true);
  assert.deepEqual(await names(f.root),['hello.txt','nested','new.txt']);

  r=await runtime.writeFile({path:'new.txt',text:'one target three'});
  assert.equal(r.ok,true);
  assert.equal(r.recovery.type,'pal-private-snapshot');
  assert.equal(r.recovery.visibility,'private-state');
  assert.deepEqual(await names(f.root),['hello.txt','nested','new.txt']);

  r=await runtime.modifyFile({path:'new.txt',search:'target',replace:'TWO'});
  assert.equal(r.ok,true);
  assert.equal(await fs.readFile(path.join(f.root,'new.txt'),'utf8'),'one TWO three');
  assert.deepEqual(await names(f.root),['hello.txt','nested','new.txt']);

  r=await runtime.createDirectory({path:'folder'});
  assert.equal(r.ok,true);
  r=await runtime.copyPath({source:'new.txt',destination:'folder/copy.txt'});
  assert.equal(r.ok,true);
  r=await runtime.movePath({source:'folder/copy.txt',destination:'folder/moved.txt'});
  assert.equal(r.ok,true);
  assert.deepEqual(await names(path.join(f.root,'folder')),['moved.txt']);

  r=await runtime.deletePath({path:'folder/moved.txt'});
  assert.equal(r.ok,true);
  assert.equal(recycled.length,1);
  await assert.rejects(()=>fs.access(path.join(f.root,'folder','moved.txt')));

  const recoveryFiles=await walkFiles(path.join(stateDir,'recovery'));
  assert.ok(recoveryFiles.some(p=>p.endsWith('content.bin')));
  assert.ok(recoveryFiles.some(p=>p.endsWith('metadata.json')));
  assert.equal((await walkFiles(f.root)).some(p=>/\.spark-(tmp|old)-|pre_rename_backup/i.test(p)),false);
});

test('move collision is fail-closed and creates no sidecar',async(t)=>{
  const {f,runtime}=await runtimeFixture(t);
  await fs.writeFile(path.join(f.root,'source.txt'),'SOURCE','utf8');
  await fs.writeFile(path.join(f.root,'dest.txt'),'DEST','utf8');
  const before=await names(f.root);
  const r=await runtime.movePath({source:'source.txt',destination:'dest.txt'});
  assert.equal(r.ok,false);
  assert.equal(r.error.code,'ALREADY_EXISTS');
  assert.equal(await fs.readFile(path.join(f.root,'source.txt'),'utf8'),'SOURCE');
  assert.equal(await fs.readFile(path.join(f.root,'dest.txt'),'utf8'),'DEST');
  assert.deepEqual(await names(f.root),before);
});

test('mutation path escapes and root delete fail closed',async(t)=>{
  const {runtime}=await runtimeFixture(t);
  assert.equal((await runtime.createFile({path:'../x.txt',text:'x'})).error.code,'PATH_TRAVERSAL');
  assert.equal((await runtime.deletePath({path:'.'})).error.code,'ROOT_DELETE_FORBIDDEN');
});

test('run_command uses confined cwd and structured runner result',async(t)=>{
  const {runtime}=await runtimeFixture(t);
  const r=await runtime.runCommand({command:'node',args:['-v'],cwd:'nested'});
  assert.equal(r.ok,true);
  assert.equal(r.cwd,'nested');
  assert.equal(r.elevated,false);
  assert.equal(r.timeoutSeen,1234);
  const bad=await runtime.runCommand({command:'node',cwd:'../outside'});
  assert.equal(bad.error.code,'PATH_TRAVERSAL');
});
