import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { freePort, makeFixture } from './helpers.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const CLI=path.join(ROOT,'src','cli.mjs');function run(command,env){return new Promise(resolve=>{const c=spawn(process.execPath,[CLI,command],{cwd:ROOT,env:{...process.env,...env}});let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.on('exit',code=>resolve({code,out:out.trim(),err:err.trim()}));});}
test('daemon start/status/stop/restart',async(t)=>{const f=await makeFixture();const port=await freePort();const env={SPARK_TRANSPORT_ROOT:f.root,SPARK_TRANSPORT_PORT:String(port),SPARK_TRANSPORT_STATE_DIR:path.join(f.base,'state')};t.after(async()=>{await run('stop',env).catch(()=>{});await f.cleanup();});let r=await run('start',env);assert.equal(r.code,0,r.err);assert.equal(JSON.parse(r.out).status,'started');r=await run('status',env);assert.equal(r.code,0,r.err);assert.equal(JSON.parse(r.out).status,'running');r=await run('stop',env);assert.equal(r.code,0,r.err);r=await run('start',env);assert.equal(r.code,0,r.err);r=await run('stop',env);assert.equal(r.code,0,r.err);});
