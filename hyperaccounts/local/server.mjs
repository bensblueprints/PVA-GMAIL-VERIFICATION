import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalog,
  capabilities,
  estimate,
  validateAccount,
} from './catalog.mjs';
import { openapi } from './openapi.mjs';
import { StepEngine, demoWorkflow, demoHtml } from './engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.rsc': 'text/x-component',
};
const QR = 'Gmail_Bypass_QR_Code';
export function publicAccount(a, campaign, platform) {
  return {
    id: String(a.Id || ''),
    username: String(a.Username || ''),
    campaign,
    platform,
    status: String(a.AccountStatus || 'NotRegister'),
  };
}
export function validName(name) {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= 80 &&
    !/[\x00-\x1f<>:"/\\|?*]/.test(name)
  );
}
export function buildServer(options = {}) {
  const port = options.port ?? 4371;
  const engine =
    options.engine ?? process.env.PVA_API_URL ?? 'http://127.0.0.1:52636/api';
  const engineUrl = new URL(engine);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(engineUrl.hostname) ||
    engineUrl.protocol !== 'http:'
  )
    throw new Error('The PVACreator engine must be a local HTTP service.');
  const pvaDir =
    options.pvaDir ?? process.env.PVA_DIRECTORY ?? 'E:\\PVACreator';
  const stateDir = options.stateDir ?? path.join(root, '.studio');
  const clientDir = options.clientDir ?? path.join(root, 'dist', 'client');
  const token = randomBytes(32).toString('hex');
  const stepEngine = new StepEngine({
    stateDir,
    ...(options.browserFactory
      ? { browserFactory: options.browserFactory }
      : {}),
  });
  let state = { campaigns: [], events: [] };
  let mutationQueue = Promise.resolve();
  const initialized = readFile(path.join(stateDir, 'workspace.json'), 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.campaigns) && Array.isArray(parsed.events))
        state = parsed;
    })
    .catch((e) => {
      if (e.code !== 'ENOENT')
        throw new Error(
          'Cannot read HyperAccounts workspace history. Repair or restore .studio/workspace.json before continuing.',
        );
    });
  async function persist() {
    await mkdir(stateDir, { recursive: true });
    const target = path.join(stateDir, 'workspace.json');
    await writeFile(target + '.tmp', JSON.stringify(state, null, 2), {
      mode: 0o600,
    });
    await rename(target + '.tmp', target);
  }
  async function record(title, detail) {
    state.events.unshift({
      at: new Date().toISOString(),
      title,
      detail,
      type: 'info',
    });
    state.events = state.events.slice(0, 500);
    await persist();
  }
  async function request(route, body, method) {
    let response;
    try {
      response = await fetch(engine.replace(/\/$/, '') + route, {
        method: method || (body ? 'POST' : 'GET'),
        headers: body
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {},
        ...(body ? { body: new URLSearchParams(body) } : {}),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error(
        'PVACreator is not responding. Open the Windows app, then refresh.',
      );
    }
    if (!response.ok)
      throw new Error(`PVACreator returned HTTP ${response.status}.`);
    const result = await response.json();
    if (!result.isSuccess)
      throw new Error(
        route.startsWith('/account/')
          ? 'This campaign’s accounts are not exposed by the supported PVACreator account API.'
          : 'PVACreator did not complete this action. Check the campaign and module status in the Windows app.',
      );
    return result;
  }
  async function platforms() {
    return ((await request('/platform/list')).data || []).map((p) => ({
      name: p.Name,
      label: p.DisplayName,
      status: p.Status,
    }));
  }
  async function details(name) {
    const c = (
      await request('/campaign/details?name=' + encodeURIComponent(name))
    ).data;
    if (!c?.Name) throw new Error('Campaign not found.');
    return {
      name: c.Name,
      platform: c.Platform,
      status: c.Status,
      total: null,
      completed: null,
      failed: null,
      accountAccess: c.Platform === QR,
    };
  }
  async function accounts(name) {
    const campaign = await details(name);
    if (campaign.platform !== QR)
      throw new Error(
        'This is a legacy ' +
          campaign.platform +
          ' campaign. Its accounts must be managed in PVACreator; the published account API currently supports Gmail QR only.',
      );
    let rows = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const result = await request(
        '/account/list?campaignName=' +
          encodeURIComponent(name) +
          '&page=' +
          page,
      );
      const count = Number(result.pageCount ?? 1);
      if (!Number.isSafeInteger(count) || count < 0 || count > 1000)
        throw new Error('The engine returned an invalid account page count.');
      pages = Math.max(count, 1);
      if (!Array.isArray(result.data))
        throw new Error('The engine returned an invalid account list.');
      rows.push(
        ...result.data.map((a) => publicAccount(a, name, campaign.platform)),
      );
    }
    return rows;
  }
  async function providers() {
    let content = '';
    try {
      content = await readFile(path.join(pvaDir, 'Settings.ini'), 'utf8');
    } catch {
      return [];
    }
    const settings = Object.fromEntries(
      content
        .split(/\r?\n/)
        .filter((l) => l.includes('='))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()];
        }),
    );
    const sms = settings.defaultsmsservice || 'Not selected',
      captcha = settings.defaultcaptchaservice || 'Not selected';
    const smsKeys = {
      SMSPVA: 'smspvaapikey',
      _5Sim: '_5simapikey',
      SMSActivate: 'smsactivateapikey',
      DaisySMS: 'daisysmsapikey',
    };
    const captchaKeys = {
      _2Captcha: '_2captchaapikey',
      AntiCaptcha: 'anticaptchaapikey',
      AnyCaptcha: 'anycaptchaapikey',
      YesCaptcha: 'yescaptchaapikey',
    };
    return [
      {
        name: sms.replace(/^_/, ''),
        kind: 'SMS',
        configured: !!settings[smsKeys[sms] || ''],
      },
      {
        name: captcha.replace(/^_/, ''),
        kind: 'CAPTCHA',
        configured: !!settings[captchaKeys[captcha] || ''],
      },
    ];
  }
  async function snapshot() {
    await initialized;
    const available = await platforms();
    const listed = (await request('/campaign/list')).data || [];
    const names = new Set([...listed.map((c) => c.Name), ...state.campaigns]);
    try {
      for (const filename of await readdir(path.join(pvaDir, 'Compaigns'))) {
        if (filename.endsWith('.bin')) names.add(filename.slice(0, -4));
      }
    } catch {
      /* An installation can have no legacy campaigns. */
    }
    const campaigns = [],
      allAccounts = [],
      warnings = [];
    for (const name of names) {
      if (!validName(name)) continue;
      try {
        const c = await details(name);
        if (c.accountAccess) {
          try {
            const rows = await accounts(name);
            c.total = rows.length;
            c.completed = rows.filter((a) => a.status === 'Success').length;
            c.failed = rows.filter((a) => a.status === 'Fail').length;
            allAccounts.push(...rows);
          } catch (e) {
            warnings.push(name + ': ' + e.message);
          }
        } else
          warnings.push(
            name +
              ': legacy campaign; account records are not exposed by the published API.',
          );
        campaigns.push(c);
      } catch {
        warnings.push(
          name + ': saved campaign could not be read from PVACreator.',
        );
      }
    }
    return {
      mode: 'live',
      connected: true,
      campaigns,
      accounts: allAccounts,
      platforms: available,
      providers: await providers(),
      events: state.events,
      warnings,
      csrfToken: token,
    };
  }
  function send(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
  }
  async function payload(req) {
    let value = '';
    for await (const chunk of req) {
      value += chunk;
      if (Buffer.byteLength(value) > 32768)
        throw new Error('Request is too large.');
    }
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('Invalid JSON request.');
    }
  }
  function authorize(req) {
    const host = req.headers.host;
    const actualPort = server.address()?.port || port;
    const allowed = new Set([
      `127.0.0.1:${actualPort}`,
      `localhost:${actualPort}`,
      `[::1]:${actualPort}`,
    ]);
    if (!allowed.has(host)) return false;
    if (req.headers.origin && !allowed.has(new URL(req.headers.origin).host))
      return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    return true;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      if (!authorize(req))
        return send(res, 403, {
          error: 'Only the local HyperAccounts app can access this server.',
        });
      const url = new URL(req.url, 'http://127.0.0.1:' + port);
      const route = url.pathname.replace(/^\/api\/v1(?=\/|$)/, '/api/studio');
      if (req.method === 'GET' && route === '/engine-demo/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(demoHtml);
        return;
      }
      if (route.startsWith('/api/studio')) {
        if (req.method === 'GET' && route === '/api/studio/engine')
          return send(res, 200, await stepEngine.snapshot());
        if (req.method === 'GET' && route === '/api/studio/session')
          return send(res, 200, { csrfToken: token });
        if (req.method === 'GET' && route === '/api/studio/openapi.json')
          return send(res, 200, openapi);
        if (req.method === 'GET' && route === '/api/studio/capabilities')
          return send(res, 200, capabilities);
        if (req.method === 'GET' && route === '/api/studio/platforms')
          return send(res, 200, { platforms: await platforms() });
        if (req.method === 'GET' && route === '/api/studio/campaigns') {
          const s = await snapshot();
          return send(res, 200, {
            campaigns: s.campaigns,
            warnings: s.warnings,
          });
        }
        if (req.method === 'GET' && route === '/api/studio/campaigns/details') {
          const name = url.searchParams.get('name');
          if (!validName(name)) throw new Error('Choose a valid campaign.');
          return send(res, 200, await details(name));
        }
        if (req.method === 'GET' && route === '/api/studio/pricing') {
          const search = (url.searchParams.get('search') || '').toLowerCase();
          return send(res, 200, {
            currency: 'USD',
            services: catalog.services.filter((s) =>
              s.name.toLowerCase().includes(search),
            ),
          });
        }
        if (req.method === 'GET' && route === '/api/studio/pricing/estimate') {
          const count = url.searchParams.get('count');
          if (count === null || !/^\d+$/.test(count))
            throw new Error('A whole-number count is required.');
          return send(
            res,
            200,
            estimate(url.searchParams.get('serviceId'), Number(count)),
          );
        }
        if (
          req.method === 'GET' &&
          route === '/api/studio/integrations/mcp-config'
        )
          return send(res, 200, {
            mcpServers: {
              hyperaccounts: {
                command: process.execPath,
                args: [path.join(root, 'mcp', 'server.mjs')],
                env: {
                  HYPERACCOUNTS_URL: `http://127.0.0.1:${server.address().port}`,
                },
              },
            },
          });
        if (req.method === 'GET' && route === '/api/studio/diagnostics') {
          const checks = [];
          let supported = [];
          try {
            supported = await platforms();
            checks.push({
              name: 'Local engine',
              status: 'pass',
              detail: 'PVACreator API is responding.',
            });
          } catch {
            checks.push({
              name: 'Local engine',
              status: 'fail',
              detail: 'Open PVACreator and check its API on port 52636.',
            });
          }
          const qr = supported.find((p) => p.name === QR);
          checks.push({
            name: 'Gmail QR module',
            status: qr?.status === 'Available' ? 'pass' : 'attention',
            detail:
              qr?.status === 'Available'
                ? 'Available for account workflows.'
                : 'The connected engine has not made Gmail QR available.',
          });
          for (const p of await providers())
            checks.push({
              name: p.kind + ' provider',
              status: p.configured ? 'configured' : 'attention',
              detail:
                p.name +
                (p.configured
                  ? ' key is saved; service has not been tested.'
                  : ' needs configuration in PVACreator.'),
            });
          return send(res, 200, {
            application: 'HyperAccounts',
            version: capabilities.version,
            checks,
            features: capabilities.features,
          });
        }
        if (req.method === 'GET' && route === '/api/studio/health')
          return send(res, 200, { ok: true, application: 'HyperAccounts' });
        if (req.method === 'GET' && route === '/api/studio/snapshot')
          return send(res, 200, await snapshot());
        if (req.method === 'GET' && route === '/api/studio/accounts') {
          const name = url.searchParams.get('campaign');
          if (!validName(name))
            return send(res, 400, { error: 'Choose a valid campaign.' });
          return send(res, 200, { accounts: await accounts(name) });
        }
        if (req.method !== 'POST')
          return send(res, 404, { error: 'Unknown API route.' });
        const supplied = String(
          req.headers['x-hyperaccounts-token'] ||
            req.headers['x-studio-token'] ||
            '',
        );
        if (
          supplied.length !== token.length ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
        )
          return send(res, 403, {
            error: 'Refresh HyperAccounts before changing a campaign.',
          });
        const data = await payload(req);
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error('Request body must be an object.');
        await initialized;
        const task = mutationQueue.then(async () => {
          if (route === '/api/studio/engine/workflows')
            return { workflow: await stepEngine.createWorkflow(data) };
          if (route === '/api/studio/engine/demo')
            return {
              workflow: await stepEngine.createWorkflow(
                demoWorkflow(`http://127.0.0.1:${server.address().port}`),
              ),
            };
          if (route === '/api/studio/engine/rows')
            return {
              rows: await stepEngine.addRows(data.workflowId, data.rows),
            };
          if (route === '/api/studio/engine/rows/start')
            return stepEngine.start(data.rowIds, {
              restart: data.restart === true,
            });
          if (route === '/api/studio/engine/rows/pause')
            return stepEngine.pause(data.rowId);
          if (route === '/api/studio/engine/rows/resume')
            return stepEngine.resume(data.rowId);
          if (route === '/api/studio/engine/rows/cancel')
            return stepEngine.cancel(data.rowId);
          if (route === '/api/studio/campaigns/remove') {
            if (!validName(data.name))
              throw new Error('Choose a valid campaign.');
            const c = await details(data.name);
            if (c.status === 'Run')
              throw new Error('Stop the campaign before removing it.');
            await request('/campaign/remove', { name: data.name }, 'DELETE');
            state.campaigns = state.campaigns.filter(
              (name) => name !== data.name,
            );
            await record('Campaign removed', data.name);
            return { ok: true };
          }
          if (route === '/api/studio/accounts/remove') {
            if (
              !validName(data.campaignName) ||
              typeof data.accountId !== 'string' ||
              !data.accountId ||
              data.accountId.length > 200
            )
              throw new Error('Campaign name and account ID are required.');
            const c = await details(data.campaignName);
            if (c.status === 'Run')
              throw new Error('Stop the campaign before removing an account.');
            if (
              !(await accounts(data.campaignName)).some(
                (a) => a.id === data.accountId,
              )
            )
              throw new Error('Account ID was not found in this campaign.');
            await request(
              '/account/remove',
              { campaignName: data.campaignName, accountId: data.accountId },
              'DELETE',
            );
            await record('Account removed', data.campaignName);
            return { ok: true };
          }
          if (route === '/api/studio/campaigns') {
            if (!validName(data.name))
              throw new Error(
                'Use a campaign name of 1–80 characters without file-path characters.',
              );
            const p = (await platforms()).find((p) => p.name === data.platform);
            if (!p || p.status !== 'Available')
              throw new Error(
                'This module is not available in your PVACreator installation.',
              );
            const existing = (await request('/campaign/list')).data || [];
            if (
              existing.some((c) => c.Name === data.name) ||
              state.campaigns.includes(data.name)
            )
              throw new Error('A campaign with this name already exists.');
            await request('/campaign/create', {
              platform: data.platform,
              name: data.name,
            });
            state.campaigns.push(data.name);
            await record('Campaign created', data.name);
            return { ok: true };
          }
          if (
            route === '/api/studio/campaigns/start' ||
            route === '/api/studio/campaigns/stop'
          ) {
            if (!validName(data.name))
              throw new Error('Choose a valid campaign.');
            const c = await details(data.name);
            const start = route.endsWith('/start');
            if (start) {
              const p = (await platforms()).find((p) => p.name === c.platform);
              if (!p || p.status !== 'Available')
                throw new Error(
                  'This module is unavailable. Resolve its activation in PVACreator first.',
                );
              if (!c.accountAccess)
                throw new Error(
                  'Start this legacy campaign in PVACreator, where its account list can be reviewed.',
                );
              if (
                !(await accounts(data.name)).some(
                  (a) => a.status === 'NotRegister',
                )
              )
                throw new Error('This campaign has no queued accounts.');
            }
            await request(start ? '/campaign/start' : '/campaign/stop', {
              name: data.name,
            });
            await record(
              start ? 'Campaign started' : 'Campaign stopped',
              data.name,
            );
            return { ok: true };
          }
          if (route === '/api/studio/accounts/add') {
            if (!validName(data.campaignName))
              throw new Error('Choose a valid campaign.');
            const c = await details(data.campaignName);
            if (c.platform !== QR)
              throw new Error(
                'Account entry through this API is supported for Gmail QR only.',
              );
            if (
              !(await platforms()).some(
                (p) => p.name === QR && p.status === 'Available',
              )
            )
              throw new Error('Gmail QR is unavailable.');
            const safe = validateAccount(data.account);
            safe.CampaignName = data.campaignName;
            const added = await request('/account/add', {
              campaignName: data.campaignName,
              account: JSON.stringify(safe),
            });
            await record('Account added', data.campaignName);
            return {
              ok: true,
              account: publicAccount(
                added.data || {},
                data.campaignName,
                c.platform,
              ),
            };
          }
          throw new Error('Unknown action.');
        });
        mutationQueue = task.catch(() => {});
        return send(res, 200, await task);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return send(res, 405, { error: 'Method not allowed.' });
      const relative = decodeURIComponent(url.pathname);
      let file = path.resolve(clientDir, '.' + relative);
      const prefix = path.resolve(clientDir) + path.sep;
      if (file !== path.resolve(clientDir) && !file.startsWith(prefix))
        return send(res, 403, { error: 'Invalid path.' });
      try {
        if ((await stat(file)).isDirectory())
          file = path.join(file, 'index.html');
        const bytes = await readFile(file);
        res.writeHead(200, {
          'Content-Type':
            MIME[path.extname(file)] || 'application/octet-stream',
          'Cache-Control':
            path.extname(file) === '.html'
              ? 'no-cache'
              : 'public, max-age=3600',
        });
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch {
        return send(res, 404, {
          error:
            'The app build is missing. Build HyperAccounts, then launch it again.',
        });
      }
    } catch (e) {
      send(res, 400, {
        error: e.message || 'The request could not be completed.',
      });
    }
  });
  server.on('close', () => void stepEngine.close());
  server.stepEngine = stepEngine;
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = buildServer();
  server.listen(4371, '127.0.0.1', () =>
    console.log('HyperAccounts is ready at http://127.0.0.1:4371/'),
  );
  server.on('error', (e) => {
    console.error(
      e.code === 'EADDRINUSE'
        ? 'HyperAccounts is already running on port 4371.'
        : e.message,
    );
    process.exitCode = 1;
  });
}
