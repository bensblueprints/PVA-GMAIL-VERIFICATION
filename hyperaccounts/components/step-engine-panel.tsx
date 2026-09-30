'use client';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Code2,
  Copy,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, exportJson } from '@/lib/studio';

type Step = {
  id?: string;
  name: string;
  action: string;
  selector?: string;
  value?: string;
  target?: string;
  provider?: string;
  keyEnv?: string;
  timeoutMs?: number;
};
type Flow = {
  id: string;
  name: string;
  platform: string;
  columns: { key: string; label: string; secret: boolean }[];
  steps: Step[];
  settings?: { captchaProvider: string; captchaKeyEnv: string };
};
type Row = {
  id: string;
  workflowId: string;
  values: Record<string, string>;
  status: string;
  nextStep: number;
  message: string;
  results: { stepId: string; name: string; status: string; at: string }[];
};
type Engine = { workflows: Flow[]; rows: Row[]; activeRowId: string | null };
const actions = [
  ['navigate', 'Open page'],
  ['fill', 'Fill input'],
  ['click', 'Click element'],
  ['select', 'Select option'],
  ['wait_for', 'Wait for element'],
  ['assert_visible', 'Verify success'],
  ['human', 'Human checkpoint'],
  ['captcha_image', 'Solve image CAPTCHA'],
];
const demo: Flow = {
  id: 'sample-workflow',
  name: 'Local engine test',
  platform: 'Local test · no real accounts',
  columns: [{ key: 'username', label: 'Username', secret: false }],
  steps: [
    {
      id: '1',
      name: 'Open local test form',
      action: 'navigate',
      value: 'http://127.0.0.1:4371/engine-demo/',
    },
    {
      id: '2',
      name: 'Enter username from row',
      action: 'fill',
      selector: '#username',
      value: '$username',
    },
    {
      id: '3',
      name: 'Submit local test form',
      action: 'click',
      selector: '#create',
    },
    {
      id: '4',
      name: 'Confirm local success marker',
      action: 'assert_visible',
      selector: '#success',
    },
  ],
};
export function StepEnginePanel({ isLocal }: { isLocal: boolean }) {
  const [engine, setEngine] = useState<Engine>({
      workflows: isLocal ? [] : [demo],
      rows: [],
      activeRowId: null,
    }),
    [flowId, setFlowId] = useState(isLocal ? '' : 'sample-workflow');
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [newFlow, setNewFlow] = useState(false),
    [addRow, setAddRow] = useState(false),
    [detail, setDetail] = useState<Row | null>(null),
    [restart, setRestart] = useState<Row | null>(null);
  const [name, setName] = useState(''),
    [platform, setPlatform] = useState(''),
    [columns, setColumns] = useState('username, password:secret'),
    [steps, setSteps] = useState<Step[]>([
      { name: 'Open registration page', action: 'navigate', value: '' },
      {
        name: 'Enter username',
        action: 'fill',
        selector: '',
        value: '$username',
      },
      { name: 'Verify completion', action: 'assert_visible', selector: '' },
    ]),
    [values, setValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | undefined>(),
    [inspectedStep, setInspectedStep] = useState<Step | null>(null);
  const [captchaProvider, setCaptchaProvider] = useState('manual'),
    [captchaKeyEnv, setCaptchaKeyEnv] = useState('');
  const flow =
    engine.workflows.find((w) => w.id === flowId) || engine.workflows[0];
  const rows = engine.rows.filter((r) => r.workflowId === flow?.id);
  const ready = rows.filter((r) => r.status === 'ready');
  async function refresh() {
    if (!isLocal) return;
    try {
      setEngine(await api<Engine>('/engine'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    if (!isLocal) return;
    let alive = true;
    const tick = () =>
      api<Engine>('/engine')
        .then((s) => {
          if (alive) setEngine(s);
        })
        .catch((e) => {
          if (alive) setMessage(e.message);
        });
    void tick();
    const timer = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isLocal]);
  async function action(route: string, body: unknown, success: string) {
    if (!isLocal) {
      setMessage(
        'Open HyperAccounts on this computer to execute browser jobs. This preview does not run accounts.',
      );
      return;
    }
    setBusy(true);
    try {
      await api(route, body);
      await refresh();
      setMessage(success);
      setSelected([]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createDemo() {
    setBusy(true);
    try {
      if (isLocal) {
        const result = await api<{ workflow: Flow }>('/engine/demo', {});
        await refresh();
        setFlowId(result.workflow.id);
      } else {
        setEngine((s) => ({
          ...s,
          workflows: [...s.workflows, { ...demo, id: crypto.randomUUID() }],
        }));
      }
      setMessage(
        'Local test workflow added. Add a test row, select it, and run it.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveFlow(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const input = {
        name,
        ...(editingId ? { id: editingId } : {}),
        platform,
        columns: columns
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => ({
            key: s.replace(/:secret$/, ''),
            label: s.replace(/:secret$/, ''),
            secret: s.endsWith(':secret'),
          })),
        steps,
        settings: { captchaProvider, captchaKeyEnv },
      };
      if (isLocal) {
        const result = await api<{ workflow: Flow }>(
          '/engine/workflows',
          input,
        );
        await refresh();
        setFlowId(result.workflow.id);
      } else {
        const sample = { ...input, id: crypto.randomUUID() };
        setEngine((s) => ({ ...s, workflows: [...s.workflows, sample] }));
        setFlowId(sample.id);
      }
      setNewFlow(false);
      setMessage(
        'Workflow saved. Existing rows keep their original workflow when a revision is created.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveRow(event: React.FormEvent) {
    event.preventDefault();
    if (!flow) return;
    setBusy(true);
    try {
      if (isLocal) {
        await api('/engine/rows', { workflowId: flow.id, rows: [values] });
        await refresh();
      } else
        setEngine((s) => ({
          ...s,
          rows: [
            ...s.rows,
            {
              id: crypto.randomUUID(),
              workflowId: flow.id,
              values,
              status: 'ready',
              nextStep: 0,
              message: 'Sample row · local app required to execute',
              results: [],
            },
          ],
        }));
      setAddRow(false);
      setValues({});
      setMessage('Row added to the table. Select Run to execute its workflow.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function editStep(index: number, patch: Partial<Step>) {
    setSteps((s) =>
      s.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }
  function openEditor() {
    if (!flow) return;
    setEditingId(flow.id);
    setName(flow.name);
    setPlatform(flow.platform);
    setCaptchaProvider(flow.settings?.captchaProvider || 'manual');
    setCaptchaKeyEnv(flow.settings?.captchaKeyEnv || '');
    setColumns(
      flow.columns.map((c) => c.key + (c.secret ? ':secret' : '')).join(', '),
    );
    setSteps(flow.steps);
    setInspectedStep(null);
    setNewFlow(true);
  }
  return (
    <div className="automation-stack">
      <div className="automation-hero">
        <span className="automation-symbol">
          <Workflow size={28} />
        </span>
        <div>
          <span className="eyebrow">HYPERACCOUNTS EXECUTION ENGINE</span>
          <h2>Define the steps. Run the rows.</h2>
          <p>
            Your own browser worker, independent of PVACreator. Inputs,
            checkpoints, and step results stay together.
          </p>
        </div>
        <span className="automation-badge">ONE ROW · ONE SESSION</span>
      </div>
      {message && (
        <div className="feedback" role="status">
          {message}
          <button onClick={() => setMessage('')}>Dismiss</button>
        </div>
      )}
      <div className="engine-workspace">
        <aside className="panel flow-sidebar">
          <div className="panel-heading">
            <div>
              <h2>Workflows</h2>
              <p>{engine.workflows.length} saved definitions</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="New workflow"
              onClick={() => {
                setName('');
                setEditingId(undefined);
                setNewFlow(true);
              }}
            >
              <Plus size={18} />
            </Button>
          </div>
          <div className="flow-list">
            {engine.workflows.map((w) => (
              <button
                className={flow?.id === w.id ? 'selected' : ''}
                key={w.id}
                onClick={() => {
                  setFlowId(w.id);
                  setSelected([]);
                }}
              >
                <Workflow size={17} />
                <span>
                  <strong>{w.name}</strong>
                  <small>
                    {w.steps.length} steps · {w.platform}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="flow-actions">
            <Button variant="outline" onClick={createDemo} disabled={busy}>
              <FlaskConical size={16} />
              Add local test
            </Button>
            <p>
              Try the engine on a local form. No external accounts or SMS
              charges.
            </p>
          </div>
        </aside>
        <div className="flow-main">
          {flow ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{flow.name}</h2>
                    <p>
                      {flow.platform} · {flow.steps.length} ordered steps
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit workflow steps and settings"
                    onClick={openEditor}
                  >
                    <Copy size={16} />
                  </Button>
                </div>
                <div className="flow-step-strip">
                  {flow.steps.map((step, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setInspectedStep(step)}
                    >
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <strong>{step.name}</strong>
                      <small>
                        {actions.find((a) => a[0] === step.action)?.[1]}
                      </small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="table-toolbar">
                  <div>
                    <strong>Input table</strong>
                    <p className="engine-table-subtitle">
                      {rows.length} rows · {ready.length} ready
                    </p>
                  </div>
                  <div className="integration-actions">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setValues({});
                        setAddRow(true);
                      }}
                    >
                      <Plus size={16} />
                      Add row
                    </Button>
                    <Button
                      className="primary-button"
                      disabled={busy || !selected.length}
                      onClick={() =>
                        action(
                          '/engine/rows/start',
                          { rowIds: selected },
                          'Selected rows queued. A workflow browser will open on this computer.',
                        )
                      }
                    >
                      <Play size={15} />
                      Run {selected.length || ''}
                    </Button>
                  </div>
                </div>
                <div className="engine-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <input
                            type="checkbox"
                            aria-label="Select all ready rows"
                            checked={
                              ready.length > 0 &&
                              ready.every((r) => selected.includes(r.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked ? ready.map((r) => r.id) : [],
                              )
                            }
                          />
                        </TableHead>
                        {flow.columns.map((c) => (
                          <TableHead key={c.key}>
                            {c.label}
                            {c.secret ? ' · secret ref' : ''}
                          </TableHead>
                        ))}
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Controls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select row ${row.id.slice(0, 8)}`}
                              disabled={row.status !== 'ready'}
                              checked={selected.includes(row.id)}
                              onChange={(e) =>
                                setSelected((s) =>
                                  e.target.checked
                                    ? [...s, row.id]
                                    : s.filter((id) => id !== row.id),
                                )
                              }
                            />
                          </TableCell>
                          {flow.columns.map((c) => (
                            <TableCell key={c.key}>
                              <span
                                className="engine-cell"
                                title={row.values[c.key]}
                              >
                                {row.values[c.key] || '—'}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell>
                            <button
                              className={`status ${row.status === 'succeeded' ? 'green' : ['failed', 'interrupted', 'waiting'].includes(row.status) ? 'amber' : 'neutral'}`}
                              onClick={() => setDetail(row)}
                            >
                              {row.status === 'running' ? (
                                <Loader2 className="spin" size={12} />
                              ) : null}
                              {row.status}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              className="text-button"
                              onClick={() => setDetail(row)}
                            >
                              {row.nextStep} / {flow.steps.length}
                              <ChevronRight size={13} />
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="row-controls">
                              {row.status === 'running' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Pause row"
                                  onClick={() =>
                                    action(
                                      '/engine/rows/pause',
                                      { rowId: row.id },
                                      'The row will pause after its current step.',
                                    )
                                  }
                                >
                                  <Pause size={15} />
                                </Button>
                              )}
                              {['paused', 'waiting'].includes(row.status) && (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    action(
                                      '/engine/rows/resume',
                                      { rowId: row.id },
                                      'Row resumed.',
                                    )
                                  }
                                >
                                  <Play size={14} />
                                  Resume
                                </Button>
                              )}
                              {[
                                'queued',
                                'running',
                                'waiting',
                                'paused',
                              ].includes(row.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Cancel row"
                                  onClick={() =>
                                    action(
                                      '/engine/rows/cancel',
                                      { rowId: row.id },
                                      'Row cancelled. Earlier browser actions remain.',
                                    )
                                  }
                                >
                                  <Square size={14} />
                                </Button>
                              )}
                              {['failed', 'interrupted', 'cancelled'].includes(
                                row.status,
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Restart row"
                                  onClick={() => setRestart(row)}
                                >
                                  <RefreshCw size={15} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length === 0 && (
                    <div className="empty-state">
                      <Code2 size={28} />
                      <h3>Your workflow is ready for inputs</h3>
                      <p>Add a table row to supply the values for each step.</p>
                    </div>
                  )}
                </div>
                <div className="panel-foot">
                  <span>
                    Human checkpoints keep the browser open until you resume.
                  </span>
                  <button
                    onClick={() =>
                      exportJson(
                        { workflow: flow, rows },
                        'hyperaccounts-workflow.json',
                      )
                    }
                  >
                    <ArrowDownToLine size={14} />
                    Export
                  </button>
                </div>
              </section>
            </>
          ) : (
            <section className="panel empty-state">
              <Workflow size={30} />
              <h3>Create your first workflow</h3>
              <p>
                Start with the local test, or define the steps for a verified
                account-creation flow.
              </p>
              <Button
                className="primary-button"
                onClick={() => {
                  setEditingId(undefined);
                  setNewFlow(true);
                }}
              >
                <Plus size={16} />
                New workflow
              </Button>
            </section>
          )}
          <div className="engine-scope-note">
            <Check size={17} />
            <p>
              The runner executes your configured steps. A successful row means
              its final check passed. Gmail QR integration still needs a
              verified workflow; no Gmail registration success is claimed here.
            </p>
          </div>
        </div>
      </div>
      <Dialog
        open={!!inspectedStep}
        onOpenChange={(open) => {
          if (!open) setInspectedStep(null);
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{inspectedStep?.name}</DialogTitle>
            <DialogDescription>
              All saved options for this action
            </DialogDescription>
          </DialogHeader>
          {inspectedStep && (
            <div className="action-options">
              {Object.entries(inspectedStep)
                .filter(([key]) => key !== 'id' && key !== 'name')
                .map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}</strong>
                    <code>{String(value || 'Default')}</code>
                  </div>
                ))}
              <div>
                <strong>Workflow CAPTCHA default</strong>
                <code>{flow?.settings?.captchaProvider || 'manual'}</code>
              </div>
              <div>
                <strong>Default key reference</strong>
                <code>{flow?.settings?.captchaKeyEnv || 'Not set'}</code>
              </div>
            </div>
          )}
          <Button className="primary-button" onClick={openEditor}>
            Edit steps & settings
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={newFlow} onOpenChange={setNewFlow}>
        <DialogContent className="studio-dialog sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Workflow builder</DialogTitle>
            <DialogDescription>
              Each input row runs these steps in order. Use $column to fill a
              value from the table.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFlow} className="campaign-form workflow-editor">
            <div className="advanced-grid">
              <label>
                Name
                <Input
                  required
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My account workflow"
                />
              </label>
              <label>
                Platform
                <Input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="e.g. Gmail · unverified"
                />
              </label>
              <label className="wide">
                Input columns
                <Input
                  required
                  value={columns}
                  onChange={(e) => setColumns(e.target.value)}
                  placeholder="username, firstName, password:secret"
                />
                <small>
                  Comma-separated keys. Add :secret for a local
                  environment-variable reference.
                </small>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setColumns(
                      'username, password:secret, firstName, lastName, recoveryEmail, birthYear, birthMonth, birthDay, country, captchaProvider, captchaKeyEnv:secret',
                    )
                  }
                >
                  Use shared account fields
                </button>
              </label>
              <label>
                Default CAPTCHA provider
                <Select
                  value={captchaProvider}
                  onValueChange={(v) => setCaptchaProvider(String(v))}
                >
                  <SelectTrigger aria-label="Default CAPTCHA provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual checkpoint</SelectItem>
                    <SelectItem value="2captcha">
                      2Captcha · image to text
                    </SelectItem>
                    <SelectItem value="anticaptcha">
                      Anti-Captcha · image to text
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Default provider key reference
                <Input
                  value={captchaKeyEnv}
                  onChange={(e) => setCaptchaKeyEnv(e.target.value)}
                  placeholder="HYPERACCOUNTS_SECRET_CAPTCHA_KEY"
                />
              </label>
              <p className="form-help wide">
                Provider settings can be overridden by each action or by the
                captchaProvider and captchaKeyEnv table columns. External
                solvers may charge per submitted image.
              </p>
            </div>
            <div className="editor-steps">
              {steps.map((step, i) => (
                <div className="editor-step" key={i}>
                  <div className="editor-step-heading">
                    <span>{i + 1}</span>
                    <Input
                      aria-label={`Step ${i + 1} name`}
                      value={step.name}
                      onChange={(e) => editStep(i, { name: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() =>
                        setSteps((s) => s.filter((_, n) => n !== i))
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="editor-step-inputs">
                    <Input
                      type="number"
                      min={100}
                      max={60000}
                      aria-label={`Step ${i + 1} timeout in milliseconds`}
                      title="Timeout (milliseconds)"
                      value={step.timeoutMs || 15000}
                      onChange={(e) =>
                        editStep(i, { timeoutMs: Number(e.target.value) })
                      }
                    />
                    <Select
                      value={step.action}
                      onValueChange={(v) => editStep(i, { action: String(v) })}
                    >
                      <SelectTrigger aria-label={`Step ${i + 1} action`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {actions.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {step.action === 'captcha_image' && (
                      <>
                        <Select
                          value={step.provider || 'default'}
                          onValueChange={(v) =>
                            editStep(i, { provider: String(v) })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Step ${i + 1} CAPTCHA provider`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              Workflow / row default
                            </SelectItem>
                            <SelectItem value="manual">
                              Manual checkpoint
                            </SelectItem>
                            <SelectItem value="2captcha">2Captcha</SelectItem>
                            <SelectItem value="anticaptcha">
                              Anti-Captcha
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          required
                          value={step.target || ''}
                          onChange={(e) =>
                            editStep(i, { target: e.target.value })
                          }
                          placeholder="Answer input selector"
                          aria-label={`Step ${i + 1} CAPTCHA answer input`}
                        />
                        <Input
                          value={step.keyEnv || ''}
                          onChange={(e) =>
                            editStep(i, { keyEnv: e.target.value })
                          }
                          placeholder="Key reference override (optional)"
                          aria-label={`Step ${i + 1} CAPTCHA key reference`}
                        />
                      </>
                    )}
                    {!['navigate', 'human'].includes(step.action) && (
                      <Input
                        aria-label={`Step ${i + 1} selector`}
                        required
                        value={step.selector || ''}
                        onChange={(e) =>
                          editStep(i, { selector: e.target.value })
                        }
                        placeholder="Element selector, e.g. #username"
                      />
                    )}
                    {['navigate', 'fill', 'select', 'human'].includes(
                      step.action,
                    ) && (
                      <Input
                        aria-label={`Step ${i + 1} value`}
                        required
                        value={step.value || ''}
                        onChange={(e) => editStep(i, { value: e.target.value })}
                        placeholder={
                          step.action === 'navigate'
                            ? 'https://…'
                            : step.action === 'human'
                              ? 'What should the operator complete?'
                              : '$column or a fixed value'
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSteps((s) => [
                  ...s,
                  { name: 'New step', action: 'click', selector: '' },
                ])
              }
              disabled={steps.length >= 50}
            >
              <Plus size={15} />
              Add step
            </Button>
            <p className="form-help">
              Begin with Open page. End with Verify success or Wait for element.
              QR or phone actions can use a Human checkpoint.
            </p>
            {message && (
              <p className="field-error" role="status">
                {message}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewFlow(false)}
              >
                Cancel
              </Button>
              <Button className="primary-button" disabled={busy} type="submit">
                Save workflow
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={addRow} onOpenChange={setAddRow}>
        <DialogContent className="studio-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add input row</DialogTitle>
            <DialogDescription>
              {flow?.name} · Values remain local in the live app.
            </DialogDescription>
          </DialogHeader>
          <form className="campaign-form" onSubmit={saveRow}>
            {flow?.columns.map((c) => (
              <label key={c.key}>
                {c.label}
                {c.secret ? ' · environment-variable name' : ''}
                <Input
                  className="mt-2"
                  value={values[c.key] || ''}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [c.key]: e.target.value }))
                  }
                  placeholder={c.secret ? 'HYPERACCOUNTS_SECRET_PASSWORD' : ''}
                  autoComplete="off"
                />
              </label>
            ))}
            {message && <p className="form-help">{message}</p>}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddRow(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="primary-button">
                Add row
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Row execution</DialogTitle>
            <DialogDescription>{detail?.id}</DialogDescription>
          </DialogHeader>
          {(() => {
            const row = engine.rows.find((r) => r.id === detail?.id) || detail;
            return row ? (
              <>
                <p className="remove-explanation">{row.message}</p>
                <div className="execution-log">
                  {row.results.map((result, i) => (
                    <div key={i}>
                      <span
                        className={`status ${result.status === 'failed' ? 'amber' : 'green'}`}
                      >
                        {result.status}
                      </span>
                      <strong>{result.name}</strong>
                      <time>{result.at.slice(11, 19)} UTC</time>
                    </div>
                  ))}
                  {!row.results.length && <p>No completed steps yet.</p>}
                </div>
                {row.status === 'waiting' && (
                  <Button
                    className="primary-button"
                    onClick={() =>
                      action(
                        '/engine/rows/resume',
                        { rowId: row.id },
                        'Checkpoint confirmed. Row resumed.',
                      )
                    }
                  >
                    I completed the checkpoint · Resume
                  </Button>
                )}
              </>
            ) : null;
          })()}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!restart}
        onOpenChange={(open) => {
          if (!open) setRestart(null);
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restart this row from step one?</DialogTitle>
            <DialogDescription>
              Inspect the external account first. Earlier clicks or submissions
              may already have completed.
            </DialogDescription>
          </DialogHeader>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setRestart(null)}>
              Keep stopped
            </Button>
            <Button
              onClick={() => {
                if (restart)
                  void action(
                    '/engine/rows/start',
                    { rowIds: [restart.id], restart: true },
                    'Row restarted from step one.',
                  );
                setRestart(null);
              }}
            >
              Restart row
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
