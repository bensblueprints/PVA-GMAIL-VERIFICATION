import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { solveImage } from './captcha.mjs';

const actions = [
  'navigate',
  'fill',
  'click',
  'select',
  'wait_for',
  'assert_visible',
  'human',
  'captcha_image',
];
const activeStates = ['queued', 'running', 'waiting', 'paused'];
export function validateWorkflow(input) {
  if (
    !input ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 80
  )
    throw new Error('A workflow name of 1–80 characters is required.');
  if (
    !Array.isArray(input.columns) ||
    input.columns.length < 1 ||
    input.columns.length > 30
  )
    throw new Error('Define 1–30 input columns.');
  const seen = new Set();
  const columns = input.columns.map((c) => {
    if (
      !c ||
      !/^\w{1,40}$/.test(c.key) ||
      seen.has(c.key) ||
      ['__proto__', 'prototype', 'constructor'].includes(c.key)
    )
      throw new Error(
        'Column keys must be unique and use letters, numbers, or underscores.',
      );
    seen.add(c.key);
    return {
      key: c.key,
      label: String(c.label || c.key).slice(0, 80),
      secret: !!c.secret,
    };
  });
  if (
    !Array.isArray(input.steps) ||
    !input.steps.length ||
    input.steps.length > 50
  )
    throw new Error('Define 1–50 workflow steps.');
  const steps = input.steps.map((s, i) => {
    if (!s || !actions.includes(s.action))
      throw new Error('Unsupported workflow action.');
    const step = {
      id: String(i + 1),
      name: String(s.name || s.action).slice(0, 100),
      action: s.action,
      selector: String(s.selector || ''),
      value: String(s.value || ''),
      timeoutMs: Number(s.timeoutMs || 15000),
      target: String(s.target || ''),
      provider: String(s.provider || 'default'),
      keyEnv: String(s.keyEnv || ''),
    };
    if (
      step.selector.length > 500 ||
      step.value.length > 2048 ||
      !Number.isInteger(step.timeoutMs) ||
      step.timeoutMs < 100 ||
      step.timeoutMs > 60000
    )
      throw new Error('Step values or timeout are outside supported limits.');
    if (
      ['fill', 'click', 'select', 'wait_for', 'assert_visible'].includes(
        s.action,
      ) &&
      !step.selector.trim()
    )
      throw new Error('This action needs a selector.');
    if (
      ['fill', 'select'].includes(s.action) &&
      step.value.startsWith('$') &&
      !seen.has(step.value.slice(1))
    )
      throw new Error('Step references an unknown input column.');
    if (s.action === 'navigate') {
      const url = new URL(step.value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(
          'Navigation requires an HTTP or HTTPS URL without embedded credentials.',
        );
    }
    if (
      s.action === 'captcha_image' &&
      (!step.selector ||
        !step.target ||
        !['default', 'manual', '2captcha', 'anticaptcha'].includes(
          step.provider,
        ))
    )
      throw new Error(
        'Image CAPTCHA needs an image selector, answer-field selector, and a supported provider.',
      );
    if (step.target.length > 500 || step.keyEnv.length > 100)
      throw new Error('CAPTCHA settings are too long.');
    if (step.keyEnv && !/^HYPERACCOUNTS_SECRET_[A-Z0-9_]+$/.test(step.keyEnv))
      throw new Error('Use an environment-variable name for the provider key.');
    return step;
  });
  if (steps[0].action !== 'navigate')
    throw new Error('The first step must open a page.');
  if (!['assert_visible', 'wait_for'].includes(steps.at(-1).action))
    throw new Error('The final step must verify a visible success element.');
  const settings = {
    captchaProvider: input.settings?.captchaProvider || 'manual',
    captchaKeyEnv: input.settings?.captchaKeyEnv || '',
  };
  if (
    !['manual', '2captcha', 'anticaptcha'].includes(settings.captchaProvider) ||
    (settings.captchaKeyEnv &&
      !/^HYPERACCOUNTS_SECRET_[A-Z0-9_]+$/.test(settings.captchaKeyEnv))
  )
    throw new Error('Invalid default CAPTCHA settings.');
  return {
    id: randomUUID(),
    name: input.name.trim(),
    platform: String(input.platform || 'Custom').slice(0, 80),
    columns,
    steps,
    settings,
    createdAt: new Date().toISOString(),
  };
}

async function launchBrowser() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    channel: process.env.HYPERACCOUNTS_BROWSER_CHANNEL || 'chrome',
    headless: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { page, close: () => browser.close() };
}

export class StepEngine {
  constructor({ stateDir, browserFactory = launchBrowser } = {}) {
    this.stateDir = stateDir;
    this.browserFactory = browserFactory;
    this.state = { workflows: [], rows: [] };
    this.sessions = new Map();
    this.abortControllers = new Map();
    this.active = null;
    this.writeQueue = Promise.resolve();
    this.closed = false;
    this.runners = new Set();
    this.ready = readFile(path.join(stateDir, 'engine.json'), 'utf8')
      .then((raw) => {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.workflows) || !Array.isArray(parsed.rows))
          throw new Error('Invalid engine state.');
        this.state = parsed;
        for (const row of this.state.rows)
          if (activeStates.includes(row.status)) {
            row.status = 'interrupted';
            row.message =
              'Server restarted. Browser state is gone; inspect the external account before restarting this row.';
          }
      })
      .catch((e) => {
        if (e.code !== 'ENOENT')
          this.stateError =
            'Cannot read the saved step engine. Restore engine.json before continuing.';
      });
  }
  async initialized() {
    await this.ready;
    if (this.stateError) throw new Error(this.stateError);
    if (this.closed) throw new Error('Step engine is shutting down.');
  }
  async persist() {
    const data = JSON.stringify(this.state, null, 2);
    const task = this.writeQueue.then(async () => {
      await mkdir(this.stateDir, { recursive: true });
      const file = path.join(this.stateDir, 'engine.json');
      await writeFile(file + '.tmp', data, { mode: 0o600 });
      await rename(file + '.tmp', file);
    });
    this.writeQueue = task.catch(() => {});
    return task;
  }
  async snapshot() {
    await this.initialized();
    return structuredClone({
      ...this.state,
      activeRowId: this.active,
      engine: 'HyperAccounts step engine',
      independent: true,
    });
  }
  async createWorkflow(input) {
    await this.initialized();
    const workflow = validateWorkflow(input);
    if (input.id) {
      const index = this.state.workflows.findIndex((w) => w.id === input.id);
      if (index < 0) throw new Error('Workflow to edit was not found.');
      const previous = this.state.workflows[index];
      workflow.revision = (previous.revision || 1) + 1;
      if (this.state.rows.some((r) => r.workflowId === input.id)) {
        workflow.parentId = input.id;
        this.state.workflows.push(workflow);
      } else {
        workflow.id = previous.id;
        this.state.workflows[index] = workflow;
      }
    } else {
      workflow.revision = 1;
      this.state.workflows.push(workflow);
    }
    await this.persist();
    return workflow;
  }
  async addRows(workflowId, entries) {
    await this.initialized();
    const workflow = this.state.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error('Workflow not found.');
    if (!Array.isArray(entries) || !entries.length || entries.length > 100)
      throw new Error('Add 1–100 rows at a time.');
    const rows = entries.map((values) => {
      if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new Error('Each row must be an object.');
      if (
        Object.keys(values).some(
          (key) => !workflow.columns.some((c) => c.key === key),
        )
      )
        throw new Error('A row contains an unknown column.');
      const safe = {};
      for (const col of workflow.columns) {
        const value = values[col.key] ?? '';
        if (typeof value !== 'string' || value.length > 2048)
          throw new Error('Row values must be text up to 2,048 characters.');
        if (
          col.secret &&
          value &&
          !/^HYPERACCOUNTS_SECRET_[A-Z0-9_]+$/.test(value)
        )
          throw new Error(
            'Secret columns accept a HYPERACCOUNTS_SECRET_ environment-variable name, not its value.',
          );
        safe[col.key] = value;
      }
      return {
        id: randomUUID(),
        workflowId,
        values: safe,
        status: 'ready',
        nextStep: 0,
        results: [],
        message: '',
        createdAt: new Date().toISOString(),
      };
    });
    this.state.rows.push(...rows);
    await this.persist();
    return rows;
  }
  findRow(id) {
    const row = this.state.rows.find((r) => r.id === id);
    if (!row) throw new Error('Row not found.');
    return row;
  }
  async start(ids, { restart = false } = {}) {
    await this.initialized();
    if (!Array.isArray(ids) || !ids.length || ids.length > 100)
      throw new Error('Choose 1–100 rows.');
    const rows = [...new Set(ids)].map((id) => this.findRow(id));
    for (const row of rows)
      if (
        !(
          restart ? ['failed', 'cancelled', 'interrupted'] : ['ready']
        ).includes(row.status)
      )
        throw new Error(
          'This row cannot start in its current state. Use resume for a paused row, or explicitly restart a failed or interrupted row.',
        );
    for (const row of rows) {
      row.status = 'queued';
      row.nextStep = 0;
      row.results = [];
      row.message = 'Waiting for the browser worker.';
      row.pauseRequested = false;
    }
    await this.persist();
    this.pump();
    return { ok: true, rowIds: rows.map((r) => r.id) };
  }
  pump() {
    if (this.closed || this.active) return;
    const row = this.state.rows.find((r) => r.status === 'queued');
    if (!row) return;
    this.active = row.id;
    const task = this.run(row);
    this.runners.add(task);
    task.catch(() => {}).finally(() => this.runners.delete(task));
  }
  value(step, row, workflow) {
    if (!step.value.startsWith('$')) return step.value;
    const key = step.value.slice(1),
      column = workflow.columns.find((c) => c.key === key);
    if (!column) throw new Error('Missing input column.');
    const value = row.values[key] || '';
    if (column.secret) {
      const secret = process.env[value];
      if (!secret)
        throw new Error(
          'Configure the secret environment variable for this row.',
        );
      return secret;
    }
    return value;
  }
  async run(row) {
    const controller = new AbortController();
    this.abortControllers.set(row.id, controller);
    const workflow = this.state.workflows.find((w) => w.id === row.workflowId);
    try {
      row.status = 'running';
      row.message = 'Opening the workflow browser.';
      await this.persist();
      let session = this.sessions.get(row.id);
      if (!session) {
        session = await this.browserFactory();
        this.sessions.set(row.id, session);
      }
      if (row.status === 'cancelled' || this.closed) {
        await session.close();
        return;
      }
      while (row.nextStep < workflow.steps.length) {
        if (row.status === 'cancelled' || this.closed) return;
        if (row.pauseRequested) {
          row.status = 'paused';
          row.message = 'Paused between steps. The browser remains open.';
          await this.persist();
          return;
        }
        const step = workflow.steps[row.nextStep];
        row.message = step.name;
        await this.persist();
        const captchaProvider =
          step.provider && step.provider !== 'default'
            ? step.provider
            : row.values.captchaProvider ||
              workflow.settings?.captchaProvider ||
              'manual';
        if (
          step.action === 'human' ||
          (step.action === 'captcha_image' && captchaProvider === 'manual')
        ) {
          row.status = 'waiting';
          row.message =
            (step.action === 'captcha_image'
              ? 'Complete the CAPTCHA in the workflow browser, then resume.'
              : step.value) ||
            'Complete the required action in the workflow browser, then resume.';
          await this.persist();
          return;
        }
        const page = session.page;
        if (step.action === 'captcha_image') {
          const locator = page.locator(step.selector);
          const bounds = await locator.boundingBox({ timeout: step.timeoutMs });
          if (!bounds || bounds.width > 1000 || bounds.height > 1000)
            throw new Error(
              'CAPTCHA image must fit within 1000 by 1000 pixels.',
            );
          const image = await locator.screenshot({
            type: 'png',
            timeout: step.timeoutMs,
          });
          const text = await solveImage({
            provider: captchaProvider,
            keyEnv:
              step.keyEnv ||
              row.values.captchaKeyEnv ||
              workflow.settings?.captchaKeyEnv,
            image,
            signal: controller.signal,
          });
          await page
            .locator(step.target)
            .fill(text, { timeout: step.timeoutMs });
        } else if (step.action === 'navigate')
          await page.goto(step.value, {
            waitUntil: 'domcontentloaded',
            timeout: step.timeoutMs,
          });
        else {
          const locator = page.locator(step.selector);
          if (step.action === 'fill')
            await locator.fill(this.value(step, row, workflow), {
              timeout: step.timeoutMs,
            });
          else if (step.action === 'click')
            await locator.click({ timeout: step.timeoutMs });
          else if (step.action === 'select')
            await locator.selectOption(this.value(step, row, workflow), {
              timeout: step.timeoutMs,
            });
          else
            await locator.waitFor({
              state: 'visible',
              timeout: step.timeoutMs,
            });
        }
        if (row.status === 'cancelled' || this.closed) return;
        row.results.push({
          stepId: step.id,
          name: step.name,
          status: 'completed',
          at: new Date().toISOString(),
        });
        row.nextStep++;
        await this.persist();
      }
      row.status = 'succeeded';
      row.message =
        'All configured steps passed, including the final success check.';
      await this.persist();
    } catch (error) {
      if (row.status !== 'cancelled' && !this.closed) {
        row.status = 'failed';
        row.message = /^(Configure the secret|CAPTCHA )/.test(
          String(error.message),
        )
          ? error.message
          : 'The step failed or its target was not available. Inspect the workflow before restarting; earlier submissions may have succeeded.';
        row.results.push({
          stepId: workflow?.steps[row.nextStep]?.id || 'browser',
          name: workflow?.steps[row.nextStep]?.name || 'Open browser',
          status: 'failed',
          at: new Date().toISOString(),
        });
        await this.persist().catch(() => {});
      }
    } finally {
      this.abortControllers.delete(row.id);
      if (!['waiting', 'paused'].includes(row.status) || this.closed) {
        const session = this.sessions.get(row.id);
        this.sessions.delete(row.id);
        if (session) await session.close().catch(() => {});
        if (this.active === row.id) this.active = null;
        this.pump();
      }
    }
  }
  async pause(id) {
    await this.initialized();
    const row = this.findRow(id);
    if (row.status !== 'running')
      throw new Error('Only a running row can be paused.');
    row.pauseRequested = true;
    await this.persist();
    return { ok: true };
  }
  async resume(id) {
    await this.initialized();
    if (!['paused', 'waiting'].includes(this.findRow(id).status))
      throw new Error('This row is not paused at a checkpoint.');
    await Promise.allSettled([...this.runners]);
    const row = this.findRow(id);
    if (!['paused', 'waiting'].includes(row.status) || !this.sessions.has(id))
      throw new Error('This row has no paused browser session.');
    if (this.active !== id) throw new Error('Another browser job is active.');
    if (row.status === 'waiting') {
      const step = this.state.workflows.find((w) => w.id === row.workflowId)
        .steps[row.nextStep];
      row.results.push({
        stepId: step.id,
        name: step.name,
        status: 'confirmed',
        at: new Date().toISOString(),
      });
      row.nextStep++;
    }
    row.pauseRequested = false;
    row.status = 'running';
    const task = this.run(row);
    this.runners.add(task);
    task.catch(() => {}).finally(() => this.runners.delete(task));
    return { ok: true };
  }
  async cancel(id) {
    await this.initialized();
    const row = this.findRow(id);
    if (!activeStates.includes(row.status))
      throw new Error('Only queued, running, or paused rows can be cancelled.');
    const wasIdle = ['queued', 'waiting', 'paused'].includes(row.status);
    row.status = 'cancelled';
    row.message = 'Cancelled. Completed browser actions were not undone.';
    row.pauseRequested = false;
    await this.persist();
    this.abortControllers.get(id)?.abort();
    const session = this.sessions.get(id);
    if (session) await session.close().catch(() => {});
    if (wasIdle) {
      this.sessions.delete(id);
      if (this.active === id) this.active = null;
      this.pump();
    }
    return { ok: true };
  }
  async close() {
    this.closed = true;
    for (const controller of this.abortControllers.values()) controller.abort();
    await Promise.allSettled([...this.sessions.values()].map((s) => s.close()));
    await Promise.allSettled([...this.runners]);
    await this.writeQueue;
  }
}

export function demoWorkflow(base) {
  return {
    name: 'Local engine test',
    platform: 'Local test · no real accounts',
    columns: [{ key: 'username', label: 'Username', secret: false }],
    steps: [
      {
        name: 'Open local test form',
        action: 'navigate',
        value: base + '/engine-demo/',
      },
      {
        name: 'Enter username from row',
        action: 'fill',
        selector: '#username',
        value: '$username',
      },
      { name: 'Submit local test form', action: 'click', selector: '#create' },
      {
        name: 'Confirm local success marker',
        action: 'assert_visible',
        selector: '#success',
      },
    ],
  };
}
export const demoHtml =
  '<!doctype html><html><head><meta charset="utf-8"><title>HyperAccounts · Local engine test</title><style>body{font:16px system-ui;background:#f4f6f2;color:#173d30;max-width:520px;margin:80px auto}main{padding:40px;background:white;border-radius:20px}input,button{font:inherit;padding:12px;margin:12px 0;width:100%;box-sizing:border-box}button{background:#173d30;color:white;border:0;border-radius:8px}small{color:#6c786f}</style></head><body><main><small>HYPERACCOUNTS · LOCAL TEST</small><h1>Verify your step engine</h1><p>This form only tests the browser workflow. It does not create an external account.</p><form id="test"><label for="username">Test username</label><input id="username" required><button id="create">Complete local test</button></form><p id="success" hidden>Local workflow completed successfully.</p></main><script>document.querySelector("#test").addEventListener("submit",event=>{event.preventDefault();document.querySelector("#success").hidden=false})</script></body></html>';
