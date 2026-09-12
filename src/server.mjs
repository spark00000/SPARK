import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { APP_NAME, APP_VERSION, MAX_REQUEST_BYTES, MCP_PROTOCOL_VERSION } from './constants.mjs';
import { createOperationLedger } from './ledger.mjs';
import { createMcpDispatcher, validateModernRequest } from './mcp.mjs';
import { createOperationRuntime } from './operation-runtime.mjs';
import { createPathPolicy } from './path-policy.mjs';
import { runProcess } from './command-runner.mjs';
import { createToolRuntime } from './tools.mjs';

function isLoopbackHost(value){if(!value)return true;let host=String(value).toLowerCase();try{if(host.includes(':')&&!host.startsWith('[')&&host!=='::1')host=new URL(`http://${host}`).hostname;else if(host.startsWith('['))host=new URL(`http://${host}`).hostname;}catch{return false;}host=host.replace(/^\[/,'').replace(/\]$/,'');return host==='127.0.0.1'||host==='localhost'||host==='::1';}
function validateOrigin(req){const host=req.headers.host;if(host&&!isLoopbackHost(host))return false;const origin=req.headers.origin;if(!origin)return true;try{return isLoopbackHost(new URL(origin).hostname);}catch{return false;}}
function sendJson(res,status,payload){const body=JSON.stringify(payload);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body);}
async function readJsonBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_REQUEST_BYTES){const e=new Error('request too large');e.code='REQUEST_TOO_LARGE';throw e;}chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export async function createSparkTransportServer(config,injections={}){
  if(!['127.0.0.1','localhost','::1'].includes(config.host))throw new Error('server must bind to a loopback host');
  const policy=await createPathPolicy(config.root);
  const {ledger:injectedLedger,runner:injectedRunner,...toolInjections}=injections;
  const ledger=injectedLedger??createOperationLedger({stateDir:config.stateDir});
  const runner=injectedRunner??((options)=>runProcess({...options,maxOutputBytes:config.maxCommandOutputBytes}));
  const rawToolRuntime=createToolRuntime({policy,maxReadBytes:config.maxReadBytes,stateDir:config.stateDir,commandTimeoutMs:config.commandTimeoutMs,recycleBin:config.recycleBin,runner,...toolInjections});
  const toolRuntime=createOperationRuntime({toolRuntime:rawToolRuntime,ledger});
  const dispatcher=createMcpDispatcher({toolRuntime});
  const server=http.createServer(async(req,res)=>{
    if(!validateOrigin(req)){sendJson(res,403,{error:'invalid host/origin'});return;}
    const url=new URL(req.url??'/',`http://${req.headers.host??'127.0.0.1'}`);
    if(url.pathname===config.healthPath){
      if(req.method!=='GET'){res.writeHead(405,{allow:'GET'});res.end();return;}
      sendJson(res,200,{status:'ok',name:APP_NAME,version:APP_VERSION,protocol:MCP_PROTOCOL_VERSION,mode:'mutation-execution'});return;
    }
    if(url.pathname!==config.mcpPath){res.writeHead(404);res.end();return;}
    if(req.method!=='POST'){res.writeHead(405,{allow:'POST'});res.end();return;}
    const contentType=String(req.headers['content-type']??'').toLowerCase();
    if(!contentType.startsWith('application/json')){sendJson(res,415,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Content-Type must be application/json'}});return;}
    let body;
    try{body=await readJsonBody(req);}catch(error){sendJson(res,error?.code==='REQUEST_TOO_LARGE'?413:400,{jsonrpc:'2.0',id:null,error:{code:error?.code==='REQUEST_TOO_LARGE'?-32600:-32700,message:error?.code==='REQUEST_TOO_LARGE'?'Request body too large':'Parse error'}});return;}
    const headers=Object.fromEntries(Object.entries(req.headers).map(([k,v])=>[k.toLowerCase(),Array.isArray(v)?v[0]:v]));
    const validation=validateModernRequest({headers,body});
    if(validation.notification){res.writeHead(202);res.end();return;}
    if(!validation.ok){sendJson(res,validation.status??400,validation.error);return;}
    try{const result=await dispatcher.dispatch(body);sendJson(res,result?.error?.code===-32601?404:200,result);}catch{sendJson(res,200,{jsonrpc:'2.0',id:body.id??null,error:{code:-32603,message:'Internal error'}});}
  });
  return{policy,rawToolRuntime,toolRuntime,ledger,server,async listen(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.off('error',reject);resolve();});});return server.address();},async close(){if(!server.listening)return;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}

export async function ensureStateDir(config){await fs.mkdir(config.stateDir,{recursive:true});return{pidFile:path.join(config.stateDir,'spark-transport.pid'),logFile:path.join(config.stateDir,'spark-transport.log')};}
