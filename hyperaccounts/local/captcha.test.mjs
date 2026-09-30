import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveImage } from './captcha.mjs';

test('image CAPTCHA adapters use the selected provider, poll results, and keep credentials out of errors', async () => {
  process.env.HYPERACCOUNTS_SECRET_CAPTCHA_TEST = 'LOCAL_TEST_SECRET';
  try {
    for (const provider of ['2captcha', 'anticaptcha']) {
      const requests = [];
      let polled = 0;
      const text = await solveImage(
        {
          provider,
          keyEnv: 'HYPERACCOUNTS_SECRET_CAPTCHA_TEST',
          image: Buffer.from('local test image'),
        },
        {
          wait: async () => {},
          fetcher: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            return {
              ok: true,
              json: async () =>
                url.endsWith('/createTask')
                  ? { errorId: 0, taskId: 123 }
                  : ++polled === 1
                    ? { errorId: 0, status: 'processing' }
                    : {
                        errorId: 0,
                        status: 'ready',
                        solution: { text: 'abcd' },
                      },
            };
          },
        },
      );
      assert.equal(text, 'abcd');
      assert.equal(
        requests[0].url,
        provider === '2captcha'
          ? 'https://api.2captcha.com/createTask'
          : 'https://api.anti-captcha.com/createTask',
      );
      assert.equal(requests[0].body.clientKey, 'LOCAL_TEST_SECRET');
      assert.equal(requests[0].body.task.type, 'ImageToTextTask');
      assert.equal(requests.length, 3);
    }
    await assert.rejects(
      solveImage(
        {
          provider: '2captcha',
          keyEnv: 'HYPERACCOUNTS_SECRET_CAPTCHA_TEST',
          image: Buffer.from('test'),
        },
        {
          fetcher: async () => ({
            ok: true,
            json: async () => ({
              errorId: 1,
              errorDescription: 'LOCAL_TEST_SECRET',
            }),
          }),
        },
      ),
      (error) =>
        /rejected/.test(error.message) &&
        !error.message.includes('LOCAL_TEST_SECRET'),
    );
    await assert.rejects(
      solveImage({
        provider: 'not-supported',
        keyEnv: 'X',
        image: Buffer.from('test'),
      }),
      /not supported/,
    );
  } finally {
    delete process.env.HYPERACCOUNTS_SECRET_CAPTCHA_TEST;
  }
});
