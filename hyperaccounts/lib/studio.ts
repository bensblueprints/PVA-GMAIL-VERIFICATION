export type Campaign = {
  name: string;
  platform: string;
  status: string;
  total: number | null;
  completed: number | null;
  failed: number | null;
  accountAccess: boolean;
};
export type Account = {
  id: string;
  username: string;
  campaign: string;
  platform: string;
  status: string;
};
export type Snapshot = {
  mode: 'demo' | 'live';
  connected: boolean;
  campaigns: Campaign[];
  accounts: Account[];
  platforms: { name: string; label: string; status: string }[];
  providers: { name: string; kind: string; configured: boolean }[];
  events: { at: string; title: string; detail: string; type: string }[];
  warnings?: string[];
};
export const DEMO: Snapshot = {
  mode: 'demo',
  connected: false,
  campaigns: [
    {
      name: 'Gmail · customer support',
      platform: 'Gmail',
      status: 'Run',
      total: 24,
      completed: 18,
      failed: 1,
      accountAccess: true,
    },
    {
      name: 'Outlook · operations',
      platform: 'Outlook',
      status: 'Run',
      total: 12,
      completed: 7,
      failed: 0,
      accountAccess: true,
    },
    {
      name: 'X · brand accounts',
      platform: 'Twitter',
      status: 'Pause',
      total: 8,
      completed: 3,
      failed: 0,
      accountAccess: true,
    },
    {
      name: 'Gmail · new workspace',
      platform: 'Gmail',
      status: 'Stop',
      total: 10,
      completed: 0,
      failed: 0,
      accountAccess: true,
    },
  ],
  platforms: [
    { name: 'Outlook', label: 'Outlook', status: 'Available' },
    { name: 'Twitter', label: 'X / Twitter', status: 'Available' },
    { name: 'Gmail_Bypass_QR_Code', label: 'Gmail QR', status: 'Unvailable' },
  ],
  accounts: [
    {
      id: 'demo-1',
      username: 'support.north@example.test',
      campaign: 'Gmail · customer support',
      platform: 'Gmail',
      status: 'Success',
    },
    {
      id: 'demo-2',
      username: 'support.west@example.test',
      campaign: 'Gmail · customer support',
      platform: 'Gmail',
      status: 'Success',
    },
    {
      id: 'demo-3',
      username: 'support.east@example.test',
      campaign: 'Gmail · customer support',
      platform: 'Gmail',
      status: 'Registing',
    },
    {
      id: 'demo-4',
      username: 'support.south@example.test',
      campaign: 'Gmail · customer support',
      platform: 'Gmail',
      status: 'Fail',
    },
    {
      id: 'demo-5',
      username: 'operations@example.test',
      campaign: 'Outlook · operations',
      platform: 'Outlook',
      status: 'Success',
    },
    {
      id: 'demo-6',
      username: 'brand.studio@example.test',
      campaign: 'X · brand accounts',
      platform: 'Twitter',
      status: 'NotRegister',
    },
  ],
  providers: [
    { name: 'SMSPVA', kind: 'SMS', configured: true },
    { name: '2Captcha', kind: 'CAPTCHA', configured: true },
  ],
  events: [
    {
      at: '2026-09-30T13:42:00Z',
      title: 'Account verification completed',
      detail: 'Gmail · customer support',
      type: 'success',
    },
    {
      at: '2026-09-30T13:38:00Z',
      title: 'Campaign paused',
      detail: 'X · brand accounts',
      type: 'info',
    },
    {
      at: '2026-09-30T13:31:00Z',
      title: 'Gmail QR is unavailable',
      detail: 'Check module activation in PVACreator',
      type: 'warning',
    },
  ],
};
export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
export function shortPlatform(name: string) {
  return (
    (
      {
        Gmail_Bypass_QR_Code: 'Gmail QR',
        Twitter: 'X / Twitter',
        Gmail: 'Gmail',
        Outlook: 'Outlook',
      } as Record<string, string>
    )[name] || name
  );
}
let csrfToken = '';
export async function api<T = Snapshot>(
  path: string,
  body?: unknown,
): Promise<T> {
  if (body !== undefined) {
    const session = await fetch('/api/v1/session', { cache: 'no-store' });
    if (!session.ok)
      throw new Error('The local HyperAccounts session is unavailable.');
    csrfToken = ((await session.json()) as {csrfToken:string}).csrfToken;
  }
  const response = await fetch('/api/v1' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(body === undefined ? {} : { 'X-HyperAccounts-Token': csrfToken }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => ({
    error: 'The local HyperAccounts server is unavailable.',
  }))) as T & { error?: string; csrfToken?: string };
  if (!response.ok)
    throw new Error(
      result.error || 'The engine could not complete this request.',
    );
  if (result.csrfToken) csrfToken = result.csrfToken;
  return result;
}
export function exportJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
