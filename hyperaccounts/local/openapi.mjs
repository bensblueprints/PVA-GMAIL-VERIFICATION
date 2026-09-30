import { accountFields } from './catalog.mjs';
const query = (name, type = 'string') => ({
  name,
  in: 'query',
  required: true,
  schema: { type },
});
const schema = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const string = { type: 'string' };
const response = {
  description: 'Operation result',
  content: { 'application/json': { schema: { type: 'object' } } },
};
const get = (summary, parameters = []) => ({
  get: {
    summary,
    parameters,
    responses: {
      200: response,
      400: { description: 'Invalid request or unavailable engine operation' },
    },
  },
});
const post = (summary, input) => ({
  post: {
    summary,
    security: [{ SessionToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: input } },
    },
    responses: {
      200: response,
      400: { description: 'Invalid request or unsupported action' },
      403: { description: 'Missing or invalid local session token' },
    },
  },
});
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'HyperAccounts API',
    version: '0.2.0',
    description:
      'Loopback-only account workspace API. Get a session token before writes. Engine routes run independent browser workflows; campaign routes use the optional PVACreator adapter. Never automatically retry a timed-out write: inspect its outcome first.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      SessionToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-HyperAccounts-Token',
      },
    },
  },
  paths: {
    '/engine': get('Independent step-engine workflows, row jobs, and progress'),
    '/engine/workflows': post(
      'Create an immutable workflow definition',
      schema(
        {
          id: string,
          name: string,
          platform: string,
          columns: { type: 'array', items: { type: 'object' } },
          steps: { type: 'array', items: { type: 'object' } },
          settings:{type:'object',properties:{captchaProvider:{type:'string',enum:['manual','2captcha','anticaptcha']},captchaKeyEnv:string},additionalProperties:false},
        },
        ['name', 'columns', 'steps'],
      ),
    ),
    '/engine/demo': post(
      'Create a local test workflow that makes no external accounts',
      schema({}),
    ),
    '/engine/rows': post(
      'Add table rows to a workflow',
      schema({
        workflowId: string,
        rows: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: { type: 'object', additionalProperties: { type: 'string' } },
        },
      }),
    ),
    '/engine/rows/start': post(
      'Queue rows for execution; actions may affect external services',
      schema(
        {
          rowIds: { type: 'array', minItems: 1, maxItems: 100, items: string },
          restart: { type: 'boolean' },
        },
        ['rowIds'],
      ),
    ),
    '/engine/rows/pause': post(
      'Pause the running row between steps',
      schema({ rowId: string }),
    ),
    '/engine/rows/resume': post(
      'Resume a paused row, confirming a completed human step when waiting',
      schema({ rowId: string }),
    ),
    '/engine/rows/cancel': post(
      'Cancel a row and close its workflow browser; completed actions remain',
      schema({ rowId: string }),
    ),
    '/health': get('Server health'),
    '/session': get(
      'Obtain a local session token; never send it to a remote service',
    ),
    '/snapshot': get(
      'Workspace snapshot with redacted account data and a session token',
    ),
    '/capabilities': get('Implementation status and engine dependencies'),
    '/diagnostics': get(
      'Engine and configuration diagnostics without credential values',
    ),
    '/platforms': get('Live engine module availability'),
    '/campaigns': {
      ...get('Campaign list, including discoverable legacy campaigns'),
      ...post(
        'Create an empty campaign',
        schema({
          name: { type: 'string', minLength: 1, maxLength: 80 },
          platform: string,
        }),
      ),
    },
    '/campaigns/details': get('Campaign detail', [query('name')]),
    '/campaigns/start': post(
      'Start all queued accounts; provider charges may occur',
      schema({ name: string }),
    ),
    '/campaigns/stop': post(
      'Stop the campaign without undoing completed work',
      schema({ name: string }),
    ),
    '/campaigns/remove': post(
      'Permanently remove a stopped campaign from the engine',
      schema({ name: string }),
    ),
    '/accounts': get(
      'All pages of supported Gmail QR accounts; credentials excluded',
      [query('campaign')],
    ),
    '/accounts/add': post(
      'Add a queued Gmail QR account without starting registration',
      schema({
        campaignName: string,
        account: schema(
          Object.fromEntries(
            accountFields.map((name) => [
              name,
              {
                type: 'string',
                maxLength: 512,
                ...(/Password|ApiKey|Proxy$/.test(name)
                  ? { writeOnly: true }
                  : {}),
              },
            ]),
          ),
          ['Username', 'PhoneService', 'PhoneApiKey'],
        ),
      }),
    ),
    '/accounts/remove': post(
      'Remove one account from a stopped campaign',
      schema({ campaignName: string, accountId: string }),
    ),
    '/pricing': get('Search the supplied catalog', [
      { ...query('search'), required: false },
    ]),
    '/pricing/estimate': get(
      'Estimate in integer USD cents; no live provider quote',
      [query('serviceId'), query('count', 'integer')],
    ),
    '/integrations/mcp-config': get(
      'Download MCP client configuration for this installation',
    ),
    '/openapi.json': get('OpenAPI definition'),
  },
};
