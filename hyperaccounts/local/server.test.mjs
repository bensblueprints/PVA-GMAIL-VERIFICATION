import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildServer, publicAccount, validName } from './server.mjs';
import {estimate,validateAccount} from './catalog.mjs';

test('local bridge protects credentials, honors module availability, and persists actions', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pva-studio-test-'));
  await mkdir(path.join(temp, 'Compaigns'));
  await writeFile(
    path.join(temp, 'Compaigns', 'Existing Gmail.bin'),
    'opaque campaign file',
  );
  await writeFile(
    path.join(temp, 'Settings.ini'),
    'DefaultSmsService=SMSPVA\nSmspvaApiKey=TOP_SECRET_SMS\nDefaultCaptchaService=_2Captcha\n_2CaptchaApiKey=TOP_SECRET_CAPTCHA',
  );
  await mkdir(path.join(temp, 'client'));
  await writeFile(
    path.join(temp, 'client', 'index.html'),
    '<h1>HyperAccounts</h1>',
  );
  const campaigns = new Map([
    [
      'Existing Gmail',
      { Name: 'Existing Gmail', Platform: 'Gmail', Status: 'Run' },
    ],
    [
      'QR Test',
      { Name: 'QR Test', Platform: 'Gmail_Bypass_QR_Code', Status: 'Stop' },
    ],
  ]);
  const mutations = [];
  let qrAvailable = false;
  const engine = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = new URLSearchParams(raw);
    let data;
    if (url.pathname === '/api/platform/list')
      data = [
        { Name: 'Outlook', DisplayName: 'Outlook', Status: 'Available' },
        {
          Name: 'Gmail_Bypass_QR_Code',
          DisplayName: 'Gmail QR',
          Status: qrAvailable ? 'Available' : 'Unvailable',
        },
      ];
    else if (url.pathname === '/api/campaign/list')
      data = [...campaigns.values()].filter((c) => c.Platform !== 'Gmail');
    else if (url.pathname === '/api/campaign/details')
      data = campaigns.get(url.searchParams.get('name'));
    else if (url.pathname === '/api/account/list') {
      const page = Number(url.searchParams.get('page'));
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          isSuccess: true,
          page,
          pageCount: 2,
          data: [
            {
              Id: String(page),
              Username: 'test' + page,
              AccountStatus: page === 1 ? 'Success' : 'NotRegister',
              Password: 'SECRET_PASSWORD',
              PhoneApiKey: 'SECRET_API_KEY',
              RecoveryEmail: 'private@example.test',
            },
          ],
        }),
      );
      return;
    } else if (url.pathname === '/api/campaign/create') {
      data = {
        Name: body.get('name'),
        Platform: body.get('platform'),
        Status: 'Stop',
      };
      campaigns.set(data.Name, data);
      mutations.push('create');
    } else if (url.pathname === '/api/campaign/start') {
      campaigns.get(body.get('name')).Status = 'Run';
      mutations.push('start');
      data = true;
    } else if (url.pathname === '/api/campaign/stop') {
      campaigns.get(body.get('name')).Status = 'Pause';
      mutations.push('stop');
      data = true;
    } else if (url.pathname === '/api/account/add') {
      mutations.push('add');
      data = { Id: '3', ...JSON.parse(body.get('account')) };
    } else if(url.pathname==='/api/campaign/remove'){
      assert.equal(req.method,'DELETE');campaigns.delete(body.get('name'));mutations.push('remove campaign');data=true;
    } else if(url.pathname==='/api/account/remove'){
      assert.equal(req.method,'DELETE');assert.equal(body.get('accountId'),'2');mutations.push('remove account');data=true;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ isSuccess: !!data, data: data || null }));
  });
  await new Promise((r) => engine.listen(0, '127.0.0.1', r));
  const app = buildServer({
    port: 0,
    engine: `http://127.0.0.1:${engine.address().port}/api`,
    pvaDir: temp,
    stateDir: path.join(temp, 'state'),
    clientDir: path.join(temp, 'client'),
  });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const snapshot = await (await fetch(url + '/api/studio/snapshot')).json();
    assert.equal(snapshot.connected, true);
    assert.equal(snapshot.campaigns.length, 2);
    assert.equal(snapshot.accounts.length, 2);
    assert.equal(
      snapshot.campaigns.find((c) => c.name === 'Existing Gmail').total,
      null,
    );
    assert.equal(snapshot.campaigns.find((c) => c.name === 'QR Test').total, 2);
    const text = JSON.stringify(snapshot);
    assert.ok(!text.includes('SECRET'));
    assert.ok(!text.includes('private@example.test'));
    assert.equal(snapshot.providers[0].configured, true);
    assert.equal(
      (
        await fetch(url + '/api/studio/snapshot', {
          headers: { Origin: 'https://untrusted.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      await new Promise((resolve) =>
        http.get(
          url + '/api/studio/snapshot',
          { headers: { Host: 'untrusted.example' } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        ),
      ),
      403,
    );
    assert.equal(
      (
        await fetch(url + '/api/studio/campaigns', {
          method: 'POST',
          body: '{}',
        })
      ).status,
      403,
    );
    const post = (route, data) =>
      fetch(url + '/api/studio' + route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Studio-Token': snapshot.csrfToken,
          Origin: url,
        },
        body: JSON.stringify(data),
      });
    assert.equal(
      (
        await post('/campaigns', {
          name: 'Unavailable QR',
          platform: 'Gmail_Bypass_QR_Code',
        })
      ).status,
      400,
    );
    assert.equal(mutations.length, 0);
    assert.equal(
      (await post('/campaigns/start', { name: 'QR Test' })).status,
      400,
    );
    assert.equal(mutations.length, 0);
    assert.equal(
      (await fetch(url + '/api/studio/accounts?campaign=Existing%20Gmail'))
        .status,
      400,
    );
    assert.equal(
      (await post('/campaigns', { name: 'New Outlook', platform: 'Outlook' }))
        .status,
      200,
    );
    assert.equal(
      (await post('/campaigns', { name: 'New Outlook', platform: 'Outlook' }))
        .status,
      400,
    );
    assert.equal(
      (await post('/campaigns/start', { name: 'Existing Gmail' })).status,
      400,
    );
    assert.equal(
      (await post('/campaigns/stop', { name: 'Existing Gmail' })).status,
      200,
    );
    qrAvailable = true;
    assert.equal(
      (
        await post('/accounts/add', {
          campaignName: 'QR Test',
          account: {
            Username: 'test3',
            PhoneService: '1',
            PhoneApiKey: 'ACCOUNT_KEY',
            PhoneCountry: '',
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post('/accounts/add', {
          campaignName: 'QR Test',
          account: {
            Username: 'test3',
            PhoneService: '1',
            PhoneApiKey: 'ACCOUNT_KEY',
            PhoneCountry: '35',
            Password: 'ACCOUNT_PASSWORD',
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await post('/campaigns/start', { name: 'QR Test' })).status,
      200,
    );
    const saved = await readFile(
      path.join(temp, 'state', 'workspace.json'),
      'utf8',
    );
    assert.ok(!saved.includes('ACCOUNT_KEY'));
    assert.ok(!saved.includes('ACCOUNT_PASSWORD'));
    assert.ok(saved.includes('New Outlook'));
    assert.equal((await fetch(url + '/')).status, 200);
    assert.equal((await fetch(url + '/api/studio/unknown')).status, 404);
    const get=async route=>await(await fetch(url+'/api/v1'+route)).json();
    assert.equal((await get('/health')).application,'HyperAccounts');
    assert.equal((await get('/session')).csrfToken,snapshot.csrfToken);
    assert.equal((await get('/pricing')).services.length,241);
    assert.equal((await get('/pricing/estimate?serviceId=google-youtube-gmail&count=10')).totalCents,1300);
    assert.equal((await fetch(url+'/api/v1/pricing/estimate?serviceId=google-youtube-gmail')).status,400);
    assert.equal((await get('/openapi.json')).openapi,'3.1.0');
    assert.ok((await get('/openapi.json')).paths['/accounts/remove']);
    assert.ok((await get('/integrations/mcp-config')).mcpServers.hyperaccounts.args[0].endsWith('server.mjs'));
    assert.equal((await get('/diagnostics')).checks[0].status,'pass');
    assert.ok(!JSON.stringify(await get('/diagnostics')).includes('SECRET'));
    assert.equal((await post('/campaigns/remove',{name:'QR Test'})).status,400);
    assert.equal((await post('/accounts/remove',{campaignName:'QR Test',accountId:'2'})).status,400);
    assert.equal((await post('/campaigns/stop',{name:'QR Test'})).status,200);
    assert.equal((await post('/accounts/remove',{campaignName:'QR Test',accountId:'unknown'})).status,400);
    assert.equal((await post('/accounts/remove',{campaignName:'QR Test',accountId:'2'})).status,200);
    assert.equal((await post('/campaigns/remove',{name:'New Outlook'})).status,200);
    assert.deepEqual(mutations, ['create', 'stop', 'add', 'start','stop','remove account','remove campaign']);
  } finally {
    await Promise.all([
      new Promise((r) => app.close(r)),
      new Promise((r) => engine.close(r)),
    ]);
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('pva-studio-test-'));
    await rm(temp, { recursive: true, force: true });
  }
});
test('input validation and account projection are explicit', () => {
  assert.equal(validName('../outside'), false);
  assert.equal(validName('a\\b'), false);
  assert.equal(validName(''), false);
  assert.equal(validName('Support Gmail'), true);
  assert.deepEqual(
    publicAccount(
      { Id: '1', Username: 'user', AccountStatus: 'Fail', Password: 'secret' },
      'Campaign',
      'Gmail',
    ),
    {
      id: '1',
      username: 'user',
      status: 'Fail',
      campaign: 'Campaign',
      platform: 'Gmail',
    },
  );
  assert.throws(
    () => buildServer({ engine: 'https://external.example/api' }),
    /local HTTP/,
  );
  assert.equal(estimate('google-youtube-gmail',3).totalCents,390);
  assert.throws(()=>estimate('google-youtube-gmail',0.5),/integer/);
  const account={Username:'owner',PhoneService:'1',PhoneApiKey:'key',PhoneCountry:'35'};
  assert.throws(()=>validateAccount({...account,Id:'invented'}),/read-only/);
  assert.throws(()=>validateAccount({...account,BirthYear:'2000',BirthMonth:'2',BirthDay:'30'}),/date of birth/);
  assert.equal(validateAccount({...account,BirthYear:'2000',BirthMonth:'2',BirthDay:'29',ProxyType:'SOCKS5',Proxy:'example.test:1080:user:pass'}).ProxyType,'SOCKS5');
});
