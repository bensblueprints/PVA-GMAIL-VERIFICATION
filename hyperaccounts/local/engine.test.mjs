import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  StepEngine,
  demoWorkflow,
  demoHtml,
  validateWorkflow,
} from './engine.mjs';

async function until(engine, id, status) {
  for (let i = 0; i < 400; i++) {
    const row = (await engine.snapshot()).rows.find((r) => r.id === id);
    if (row?.status === status) return row;
    if (row?.status === 'failed') throw new Error(row.message);
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Expected row status ' + status);
}
async function cleanup(temp) {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith('hyperaccounts-engine-'));
  await rm(temp, { recursive: true, force: true });
}
test('independent rows execute steps, hold a human checkpoint, isolate sessions, and persist no secret values', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'hyperaccounts-engine-'));
  const calls = [];
  let closed = 0;
  const factory = async () => ({
    close: async () => {
      closed++;
    },
    page: {
      goto: async (url) => calls.push(['navigate', url]),
      locator: (selector) => ({
        fill: async (value) => calls.push(['fill', selector, value]),
        click: async () => calls.push(['click', selector]),
        selectOption: async (value) => calls.push(['select', selector, value]),
        waitFor: async () => calls.push(['visible', selector]),
      }),
    },
  });
  const engine = new StepEngine({ stateDir: temp, browserFactory: factory });
  process.env.HYPERACCOUNTS_SECRET_TEST = 'DO_NOT_PERSIST';
  try {
    const definition = demoWorkflow('http://127.0.0.1:1234');
    definition.columns.push({ key: 'password', secret: true });
    definition.steps.splice(
      2,
      0,
      {
        name: 'Fill private input',
        action: 'fill',
        selector: '#password',
        value: '$password',
      },
      {
        name: 'Operator verifies QR',
        action: 'human',
        value: 'Scan the QR in your browser.',
      },
    );
    const flow = await engine.createWorkflow(definition);
    await assert.rejects(
      engine.addRows(flow.id, [{ username: 'first', password: 'plaintext' }]),
      /environment-variable/,
    );
    const [one, two] = await engine.addRows(flow.id, [
      { username: 'first', password: 'HYPERACCOUNTS_SECRET_TEST' },
      { username: 'second', password: 'HYPERACCOUNTS_SECRET_TEST' },
    ]);
    await engine.start([one.id, two.id]);
    await until(engine, one.id, 'waiting');
    assert.equal(
      (await engine.snapshot()).rows.find((r) => r.id === two.id).status,
      'queued',
    );
    assert.ok(calls.some((c) => c[2] === 'DO_NOT_PERSIST'));
    await engine.resume(one.id);
    await until(engine, one.id, 'succeeded');
    await until(engine, two.id, 'waiting');
    await engine.cancel(two.id);
    assert.equal(
      (await engine.snapshot()).rows.find((r) => r.id === two.id).status,
      'cancelled',
    );
    assert.ok(
      !JSON.stringify(await engine.snapshot()).includes('DO_NOT_PERSIST'),
    );
    assert.ok(
      !(await readFile(path.join(temp, 'engine.json'), 'utf8')).includes(
        'DO_NOT_PERSIST',
      ),
    );
    const restored = new StepEngine({
      stateDir: temp,
      browserFactory: factory,
    });
    assert.equal((await restored.snapshot()).rows[0].status, 'succeeded');
    await restored.close();
    assert.ok(closed >= 2);
    assert.throws(() =>
      validateWorkflow({
        ...definition,
        steps: [{ action: 'navigate', value: 'file:///secret' }],
      }),
    );
    assert.throws(() =>
      validateWorkflow({ ...definition, columns: [{ key: '__proto__' }] }),
    );
  } finally {
    delete process.env.HYPERACCOUNTS_SECRET_TEST;
    await engine.close();
    await cleanup(temp);
  }
});

test('real Chrome worker completes an isolated local form with no external account or paid service', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'hyperaccounts-engine-'));
  const fixture = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(demoHtml);
  });
  await new Promise((r) => fixture.listen(0, '127.0.0.1', r));
  const { chromium } = await import('playwright');
  const engine = new StepEngine({
    stateDir: temp,
    browserFactory: async () => {
      const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
      });
      const context = await browser.newContext();
      return { page: await context.newPage(), close: () => browser.close() };
    },
  });
  try {
    const workflow = await engine.createWorkflow(
      demoWorkflow(`http://127.0.0.1:${fixture.address().port}`),
    );
    const [row] = await engine.addRows(workflow.id, [
      { username: 'local-test-only' },
    ]);
    await engine.start([row.id]);
    const result = await until(engine, row.id, 'succeeded');
    assert.equal(result.results.length, 4);
    assert.equal(result.nextStep, 4);
  } finally {
    await engine.close();
    await new Promise((r) => fixture.close(r));
    await cleanup(temp);
  }
});
