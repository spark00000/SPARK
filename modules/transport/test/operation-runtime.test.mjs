import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createOperationLedger } from '../src/ledger.mjs';
import { createOperationRuntime } from '../src/operation-runtime.mjs';

test('ledger state is created lazily when the runtime starts recording operations',async(t)=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'spark-ledger-lazy-'));
  const stateDir=path.join(base,'state');
  t.after(()=>fs.rm(base,{recursive:true,force:true}));
  await assert.rejects(()=>fs.access(stateDir));
  const ledger=createOperationLedger({stateDir});
  await ledger.record({operationId:ledger.nextOperationId(),operation:'read_file',status:'success',changed:false,summary:'lazy state test'});
  assert.equal(await fs.readFile(path.join(stateDir,'ledger','operations.jsonl'),'utf8').then(Boolean),true);
});

test('operation runtime normalizes success and persists ledger',async(t)=>{
  const stateDir=await fs.mkdtemp(path.join(os.tmpdir(),'spark-ledger-'));
  t.after(()=>fs.rm(stateDir,{recursive:true,force:true}));
  const ledger=createOperationLedger({stateDir});
  const toolRuntime={call:async(name)=>name==='create_file'?{ok:true,path:'a.txt',bytes:1}:{ok:true,path:'a.txt',text:'x'}};
  const runtime=createOperationRuntime({toolRuntime,ledger});
  const created=await runtime.call('create_file',{path:'a.txt'});
  assert.equal(created.ok,true);
  assert.equal(created.changed,true);
  assert.equal(created.operation,'create_file');
  assert.match(created.operationId,/^op-/);
  assert.equal(created.data.path,'a.txt');
  const read=await runtime.call('read_file',{path:'a.txt'});
  assert.equal(read.changed,false);
  const recent=await ledger.recent(10);
  assert.equal(recent.length,2);
  assert.equal(recent[0].operation,'read_file');
  assert.equal(recent[1].operation,'create_file');
});

test('operation runtime makes permission failure explicit',async(t)=>{
  const stateDir=await fs.mkdtemp(path.join(os.tmpdir(),'spark-ledger-'));
  t.after(()=>fs.rm(stateDir,{recursive:true,force:true}));
  const ledger=createOperationLedger({stateDir});
  const toolRuntime={call:async()=>({ok:false,error:{code:'ELEVATION_REQUIRED_OR_PERMISSION_DENIED',message:'denied'}})};
  const runtime=createOperationRuntime({toolRuntime,ledger});
  const result=await runtime.call('run_command',{command:'restricted.exe'});
  assert.equal(result.ok,false);
  assert.equal(result.changed,false);
  assert.equal(result.requiresElevation,true);
  assert.equal(result.error.code,'ELEVATION_REQUIRED_OR_PERMISSION_DENIED');
  const [entry]=await ledger.recent(1);
  assert.equal(entry.status,'failed');
  assert.equal(entry.errorCode,'ELEVATION_REQUIRED_OR_PERMISSION_DENIED');
});
