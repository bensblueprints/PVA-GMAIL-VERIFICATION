import { setTimeout as delay } from 'node:timers/promises';
export const captchaProviders = [
  { id: 'manual', label: 'Manual checkpoint' },
  { id: '2captcha', label: '2Captcha' },
  { id: 'anticaptcha', label: 'Anti-Captcha' },
];
const endpoints = {
  '2captcha': 'https://api.2captcha.com',
  anticaptcha: 'https://api.anti-captcha.com',
};
export async function solveImage(
  { provider, keyEnv, image, signal },
  { fetcher = fetch, wait = delay } = {},
) {
  const endpoint = endpoints[provider];
  if (!endpoint) throw new Error('CAPTCHA provider is not supported.');
  if (
    !/^HYPERACCOUNTS_SECRET_[A-Z0-9_]+$/.test(keyEnv || '') ||
    !process.env[keyEnv]
  )
    throw new Error(
      'Configure the secret environment variable for the CAPTCHA provider.',
    );
  if (!Buffer.isBuffer(image) || !image.length || image.length > 100000)
    throw new Error('CAPTCHA image must be smaller than 100 kB.');
  const clientKey = process.env[keyEnv];
  async function request(route, data) {
    signal?.throwIfAborted();
    let response;
    try {
      response = await fetcher(endpoint + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey, ...data }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        'CAPTCHA provider did not respond. A submitted task may still be billed; inspect the provider before retrying.',
      );
    }
    if (!response.ok)
      throw new Error('CAPTCHA provider returned an HTTP error.');
    const body = await response.json();
    if (body.errorId)
      throw new Error(
        'CAPTCHA provider rejected the request. Check your provider balance and API credentials.',
      );
    return body;
  }
  const created = await request('/createTask', {
    task: { type: 'ImageToTextTask', body: image.toString('base64') },
  });
  if (!created.taskId)
    throw new Error('CAPTCHA provider did not return a task ID.');
  for (let attempt = 0; attempt < 36; attempt++) {
    await wait(5000, undefined, { signal });
    const result = await request('/getTaskResult', { taskId: created.taskId });
    if (result.status === 'ready') {
      if (typeof result.solution?.text !== 'string' || !result.solution.text)
        throw new Error('CAPTCHA provider returned no text solution.');
      return result.solution.text;
    }
    if (result.status !== 'processing')
      throw new Error('CAPTCHA provider returned an unexpected task state.');
  }
  throw new Error(
    'CAPTCHA task timed out. Inspect its outcome before retrying.',
  );
}
