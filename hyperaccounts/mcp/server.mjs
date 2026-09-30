import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from '../local/catalog.mjs';

export function createApiClient(
  base = process.env.HYPERACCOUNTS_URL || 'http://127.0.0.1:4371',
) {
  const url = new URL(base);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('HyperAccounts must be a local HTTP service.');
  const origin = url.origin;
  async function fetchJson(route, options = {}) {
    let response;
    try {
      response = await fetch(origin + '/api/v1' + route, {
        ...options,
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new Error(
        'The local HyperAccounts server is unavailable or the request timed out. Check its state before retrying a write.',
      );
    }
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || 'The local API could not complete the request.',
      );
    return result;
  }
  return async (route, body) => {
    if (body === undefined) {
      const result = await fetchJson(route);
      delete result.csrfToken;
      return result;
    }
    const session = await fetchJson('/session');
    return fetchJson(route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HyperAccounts-Token': session.csrfToken,
      },
      body: JSON.stringify(body),
    });
  };
}

export function createMcpServer(api = createApiClient()) {
  const server = new McpServer({ name: 'hyperaccounts', version: '0.2.0' });
  const name = z.string().trim().min(1).max(80);
  const text = z.string().max(512);
  const account = z
    .object({
      Username: text.min(1),
      Password: text.optional(),
      FirstName: text.optional(),
      LastName: text.optional(),
      BirthMonth: text.optional(),
      BirthDay: text.optional(),
      BirthYear: text.optional(),
      Gender: z.enum(['1', '2']).optional(),
      RecoveryEmail: text.optional(),
      PhoneService: z.enum(['1', '2', '3', '7', '10', '11']),
      PhoneCountry: text.optional(),
      ProxyType: z.enum(['HTTP', 'SOCKS5']).optional(),
      Proxy: text.optional(),
      Enable_IMAP_POP3: text.optional(),
      _2StepVerification: text.optional(),
    })
    .strict();
  function tool(
    name,
    description,
    inputSchema,
    fn,
    { write = false, destructive = false, external = false } = {},
  ) {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: !write,
          destructiveHint: destructive,
          idempotentHint: !write,
          openWorldHint: external,
        },
      },
      async (input) => {
        try {
          const result = await fn(input);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              { type: 'text', text: error.message || 'Operation failed.' },
            ],
          };
        }
      },
    );
  }
  tool(
    'workspace_status',
    'Read live campaigns, accounts, module availability, and activity. Credential values are excluded.',
    z.object({}),
    () => api('/snapshot'),
  );
  tool(
    'list_platforms',
    'Check installed engine module availability before preparing accounts.',
    z.object({}),
    () => api('/platforms'),
  );
  tool(
    'list_campaigns',
    'List engine campaigns and discoverable legacy campaigns.',
    z.object({}),
    () => api('/campaigns'),
  );
  tool(
    'get_campaign',
    'Inspect a named campaign.',
    z.object({ name }),
    ({ name }) => api('/campaigns/details?name=' + encodeURIComponent(name)),
  );
  tool(
    'create_campaign',
    'Create an empty stopped campaign using an available platform.',
    z.object({ name, platform: z.string().min(1) }),
    (input) => api('/campaigns', input),
    { write: true },
  );
  tool(
    'list_accounts',
    'Read all account pages in a supported Gmail QR campaign. Use this to monitor progress after starting.',
    z.object({ campaignName: name }),
    ({ campaignName }) =>
      api('/accounts?campaign=' + encodeURIComponent(campaignName)),
  );
  tool(
    'add_account',
    'Queue one Gmail QR account without starting registration. SMS credentials are read from the named local environment variable, never returned. Optional proxy credentials remain local to the engine.',
    z.object({
      campaignName: name,
      account,
      smsKeyEnv: z
        .string()
        .regex(/^HYPERACCOUNTS_SMS_[A-Z0-9_]+$/)
        .default('HYPERACCOUNTS_SMS_API_KEY'),
    }),
    async (input) => {
      const key = process.env[input.smsKeyEnv];
      if (!key)
        throw new Error(
          'Configure the requested HYPERACCOUNTS_SMS_ environment variable in the MCP client before adding an account.',
        );
      return api('/accounts/add', {
        campaignName: input.campaignName,
        account: { ...input.account, PhoneApiKey: key },
      });
    },
    { write: true },
  );
  tool(
    'start_campaign',
    'Start every queued account in a supported campaign. This can incur SMS and CAPTCHA provider charges. Check the module, accounts, and user intent before starting.',
    z.object({ name }),
    (input) => api('/campaigns/start', input),
    { write: true, external: true },
  );
  tool(
    'stop_campaign',
    'Stop a campaign; completed accounts are retained.',
    z.object({ name }),
    (input) => api('/campaigns/stop', input),
    { write: true },
  );
  tool(
    'remove_campaign',
    'Permanently remove a stopped campaign from the engine. Use only when the user requests removal of this campaign.',
    z.object({ name }),
    (input) => api('/campaigns/remove', input),
    { write: true, destructive: true },
  );
  tool(
    'remove_account',
    'Remove the specified account record from a stopped campaign, not its external service account.',
    z.object({ campaignName: name, accountId: z.string().min(1).max(200) }),
    (input) => api('/accounts/remove', input),
    { write: true, destructive: true },
  );
  tool(
    'search_verification_prices',
    'Search the 241-entry supplied SMS price snapshot; these are estimates, not live provider quotes.',
    z.object({ search: z.string().max(100).default('') }),
    ({ search }) => api('/pricing?search=' + encodeURIComponent(search)),
  );
  tool(
    'estimate_verification_cost',
    'Calculate estimated USD cents for numbers receiving an SMS code.',
    z.object({
      serviceId: z.string(),
      count: z.number().int().min(0).max(1000000),
    }),
    ({ serviceId, count }) =>
      api(
        '/pricing/estimate?serviceId=' +
          encodeURIComponent(serviceId) +
          '&count=' +
          count,
      ),
  );
  tool(
    'diagnose_workspace',
    'Check engine connectivity, module availability, and configured providers without showing keys.',
    z.object({}),
    () => api('/diagnostics'),
  );
  const stepSchema = z.object({
    name: z.string(),
    action: z.enum([
      'navigate',
      'fill',
      'click',
      'select',
      'wait_for',
      'assert_visible',
      'human',
      'captcha_image',
    ]),
    selector: z.string().optional(),
    value: z.string().optional(),
    timeoutMs: z.number().int().min(100).max(60000).optional(),
    target: z.string().optional(),
    provider: z
      .enum(['default', 'manual', '2captcha', 'anticaptcha'])
      .optional(),
    keyEnv: z.string().optional(),
  });
  tool(
    'engine_status',
    'Read HyperAccounts independent workflows and table-row jobs. This does not depend on PVACreator.',
    z.object({}),
    () => api('/engine'),
  );
  tool(
    'engine_create_workflow',
    'Define an independent browser workflow. Begin with navigate and end with a visible success check. Human checkpoints pause for the operator.',
    z.object({
      id: z.string().optional(),
      name,
      platform: z.string().optional(),
      columns: z
        .array(
          z.object({
            key: z.string(),
            label: z.string().optional(),
            secret: z.boolean().optional(),
          }),
        )
        .min(1)
        .max(30),
      steps: z.array(stepSchema).min(1).max(50),
      settings: z
        .object({
          captchaProvider: z.enum(['manual', '2captcha', 'anticaptcha']),
          captchaKeyEnv: z.string().optional(),
        })
        .optional(),
    }),
    (input) => api('/engine/workflows', input),
    { write: true },
  );
  tool(
    'engine_add_rows',
    'Add input table rows. Secret columns must contain HYPERACCOUNTS_SECRET_ environment-variable names, never secret values.',
    z.object({
      workflowId: z.string(),
      rows: z.array(z.record(z.string(), z.string())).min(1).max(100),
    }),
    (input) => api('/engine/rows', input),
    { write: true },
  );
  tool(
    'engine_start_rows',
    'Queue independent browser jobs. Configured steps may submit to external sites and incur provider charges. Restart explicitly repeats steps from the beginning; inspect prior outcomes first.',
    z.object({
      rowIds: z.array(z.string()).min(1).max(100),
      restart: z.boolean().optional(),
    }),
    (input) => api('/engine/rows/start', input),
    { write: true, external: true },
  );
  tool(
    'engine_pause_row',
    'Pause an independent running row after its current step.',
    z.object({ rowId: z.string() }),
    (input) => api('/engine/rows/pause', input),
    { write: true },
  );
  tool(
    'engine_resume_row',
    'Resume a paused row. For a human checkpoint, call only after the operator has completed the requested action.',
    z.object({ rowId: z.string() }),
    (input) => api('/engine/rows/resume', input),
    { write: true, external: true },
  );
  tool(
    'engine_cancel_row',
    'Cancel a row and close its browser. Completed external actions are not undone.',
    z.object({ rowId: z.string() }),
    (input) => api('/engine/rows/cancel', input),
    { write: true },
  );
  server.registerResource(
    'capabilities',
    'hyperaccounts://capabilities',
    {
      mimeType: 'application/json',
      description: 'Implemented features and execution-engine dependencies',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(capabilities, null, 2),
        },
      ],
    }),
  );
  server.registerPrompt(
    'prepare_account_workflow',
    {
      description: 'Plan and run an account workflow with observable outcomes.',
      argsSchema: z.object({ campaignName: name }),
    },
    ({ campaignName }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Prepare the requested workflow in campaign ${JSON.stringify(campaignName)}. Check list_platforms and diagnose_workspace. Explain any unavailable module. Collect the intended username, provider, provider-specific country code, optional account fields, and a local SMS key environment-variable name. Do not invent user identity details. Estimate SMS costs using the appropriate service ID. Create an empty campaign or inspect an existing campaign the user selected, then add the requested accounts. Start only as authorized by the user; starting applies to every queued account and may incur provider fees. Monitor list_accounts approximately every 30 seconds when continued monitoring is requested. Report observed status, account IDs, and errors; do not claim verification or account creation succeeded without an engine result. Do not retry a timed-out write until its outcome is checked. Browser profiles, warm-up, and non-QR account entry require the original app.`,
          },
        },
      ],
    }),
  );
  return server;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  createMcpServer()
    .connect(new StdioServerTransport())
    .catch(() => {
      console.error(
        'HyperAccounts MCP failed to start. Check the local configuration.',
      );
      process.exitCode = 1;
    });
}
