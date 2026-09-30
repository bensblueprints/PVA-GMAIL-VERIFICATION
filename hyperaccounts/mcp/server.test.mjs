import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {createApiClient} from './server.mjs';

test('MCP handshake, discovery, account forwarding, error handling, and redaction over stdio',async()=>{
 const calls=[];
 const api=http.createServer(async(req,res)=>{
   const route=new URL(req.url,'http://localhost').pathname;let body='';for await(const chunk of req)body+=chunk;
   res.setHeader('Content-Type','application/json');
   if(route==='/api/v1/session')return res.end(JSON.stringify({csrfToken:'SESSION_SECRET'}));
   if(route==='/api/v1/snapshot')return res.end(JSON.stringify({connected:true,csrfToken:'SESSION_SECRET',accounts:[]}));
   if(route==='/api/v1/pricing/estimate')return res.end(JSON.stringify({totalCents:1300,currency:'USD',estimated:true}));
   if(route==='/api/v1/platforms')return res.end(JSON.stringify({platforms:[{name:'Gmail_Bypass_QR_Code',status:'Available'}]}));
   if(route==='/api/v1/accounts/add'){
     assert.equal(req.headers['x-hyperaccounts-token'],'SESSION_SECRET');calls.push(JSON.parse(body));return res.end(JSON.stringify({ok:true,account:{id:'new-1',username:'owned-test',status:'NotRegister'}}));
   }
   if(route==='/api/v1/campaigns/start'){res.statusCode=400;return res.end(JSON.stringify({error:'Gmail QR is unavailable.'}));}
   res.statusCode=404;res.end(JSON.stringify({error:'Unknown test route.'}));
 });
 await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],env:{HYPERACCOUNTS_URL:`http://127.0.0.1:${api.address().port}`,HYPERACCOUNTS_SMS_API_KEY:'TEST_PROVIDER_SECRET'},stderr:'pipe'});
 const client=new Client({name:'hyperaccounts-test',version:'1.0.0'});
 try {
   await client.connect(transport);
   const {tools}=await client.listTools();assert.equal(tools.length,21);
   assert.equal(tools.find(t=>t.name==='remove_campaign').annotations.destructiveHint,true);
   assert.equal(tools.find(t=>t.name==='start_campaign').annotations.openWorldHint,true);
   assert.equal(tools.find(t=>t.name==='workspace_status').annotations.readOnlyHint,true);
   const status=await client.callTool({name:'workspace_status',arguments:{}});assert.equal(status.structuredContent.connected,true);assert.ok(!JSON.stringify(status).includes('SESSION_SECRET'));
   const cost=await client.callTool({name:'estimate_verification_cost',arguments:{serviceId:'google-youtube-gmail',count:10}});assert.equal(cost.structuredContent.totalCents,1300);
   const invalid=await client.callTool({name:'estimate_verification_cost',arguments:{serviceId:'google-youtube-gmail',count:-1}});assert.equal(invalid.isError,true);
   const account=await client.callTool({name:'add_account',arguments:{campaignName:'Test',account:{Username:'owned-test',PhoneService:'1',PhoneCountry:'35'}}});assert.equal(account.structuredContent.account.id,'new-1');assert.ok(!JSON.stringify(account).includes('TEST_PROVIDER_SECRET'));assert.equal(calls[0].account.PhoneApiKey,'TEST_PROVIDER_SECRET');
   const error=await client.callTool({name:'start_campaign',arguments:{name:'Test'}});assert.equal(error.isError,true);assert.match(error.content[0].text,/unavailable/);
   const resources=await client.listResources();assert.equal(resources.resources[0].uri,'hyperaccounts://capabilities');
   const resource=await client.readResource({uri:'hyperaccounts://capabilities'});assert.equal(JSON.parse(resource.contents[0].text).standaloneRegistrationEngine,false);
   const prompt=await client.getPrompt({name:'prepare_account_workflow',arguments:{campaignName:'Test'}});assert.match(prompt.messages[0].content.text,/30 seconds/);
   assert.throws(()=>createApiClient('https://external.example'),/local HTTP/);
 }finally{await client.close();await new Promise(r=>api.close(r));}
});
