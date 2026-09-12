import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createSparkTransportServer } from '../src/server.mjs';
import { freePort, headersFor, makeFixture, requestEnvelope } from './helpers.mjs';

test('server discover/list/call smoke exposes Sprint-2 tool set',async(t)=>{
  const f=await makeFixture();
  t.after(f.cleanup);
  const port=await freePort();
  const config={root:f.root,host:'127.0.0.1',port,mcpPath:'/mcp',healthPath:'/health',maxReadBytes:1024*1024,commandTimeoutMs:1000,maxCommandOutputBytes:4096,stateDir:path.join(f.base,'state'),recycleBin:true};
  const runtime=await createSparkTransportServer(config,{recycle:async()=>{},runner:async()=>({ok:true,stdout:'',stderr:'',exitCode:0,durationMs:1})});
  await runtime.listen();
  t.after(()=>runtime.close());
  for(const body of [requestEnvelope('server/discover'),requestEnvelope('tools/list')]){
    const res=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:headersFor(body),body:JSON.stringify(body)});
    assert.equal(res.status,200);
    const json=await res.json();
    assert.equal(json.result.resultType,'complete');
    if(body.method==='tools/list')assert.equal(json.result.tools.length,10);
  }
  const call=requestEnvelope('tools/call',{name:'read_file',arguments:{path:'hello.txt'}});
  const res=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:headersFor(call),body:JSON.stringify(call)});
  const json=await res.json();
  const result=json.result.structuredContent;
  assert.equal(result.ok,true);
  assert.equal(result.operation,'read_file');
  assert.equal(result.changed,false);
  assert.match(result.operationId,/^op-/);
  assert.equal(result.data.text,'hello\n');
  const recent=await runtime.ledger.recent(5);
  assert.equal(recent.length,1);
  assert.equal(recent[0].operation,'read_file');
  assert.equal(recent[0].status,'success');
});

test('modern header mismatch rejected and GET SSE absent',async(t)=>{
  const f=await makeFixture();
  t.after(f.cleanup);
  const port=await freePort();
  const config={root:f.root,host:'127.0.0.1',port,mcpPath:'/mcp',healthPath:'/health',maxReadBytes:1024,stateDir:path.join(f.base,'state'),commandTimeoutMs:1000,maxCommandOutputBytes:4096,recycleBin:true};
  const rt=await createSparkTransportServer(config);
  await rt.listen();
  t.after(()=>rt.close());
  const body=requestEnvelope('tools/list');
  const h=headersFor(body);
  h['mcp-method']='tools/call';
  let res=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:h,body:JSON.stringify(body)});
  assert.equal(res.status,400);
  res=await fetch(`http://127.0.0.1:${port}/mcp`);
  assert.equal(res.status,405);
  assert.equal(res.headers.get('mcp-session-id'),null);
});
