import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import { runProcess } from '../src/command-runner.mjs';
test('runProcess captures stdout/stderr/exit code',async()=>{const r=await runProcess({command:process.execPath,args:['-e','console.log("OUT");console.error("ERR")'],cwd:os.tmpdir(),timeoutMs:5000});assert.equal(r.ok,true);assert.match(r.stdout,/OUT/);assert.match(r.stderr,/ERR/);assert.equal(r.exitCode,0);});
test('runProcess reports nonzero and timeout',async()=>{let r=await runProcess({command:process.execPath,args:['-e','process.exit(7)'],cwd:os.tmpdir(),timeoutMs:5000});assert.equal(r.ok,false);assert.equal(r.exitCode,7);assert.equal(r.error.code,'COMMAND_FAILED');r=await runProcess({command:process.execPath,args:['-e','setTimeout(()=>{},5000)'],cwd:os.tmpdir(),timeoutMs:50});assert.equal(r.ok,false);assert.equal(r.error.code,'COMMAND_TIMEOUT');});
