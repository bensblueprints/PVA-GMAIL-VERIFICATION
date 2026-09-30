'use client';
import { useState } from 'react';
import {
  ArrowDownToLine,
  Bot,
  Braces,
  Check,
  Copy,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, exportJson } from '@/lib/studio';
import capabilities from '@/lib/capabilities.json';

type Diagnostic = {
  checks: { name: string; status: string; detail: string }[];
};
const exampleConfig = {
  mcpServers: {
    hyperaccounts: {
      command: 'node',
      args: ['C:/path/to/HyperAccounts/mcp/server.mjs'],
      env: { HYPERACCOUNTS_URL: 'http://127.0.0.1:4371' },
    },
  },
};
const steps = [
  [
    'Check readiness',
    'Read module availability and diagnose missing configuration.',
  ],
  [
    'Prepare accounts',
    'Create a campaign, then add accounts and provider settings.',
  ],
  ['Review costs', 'Estimate verification charges for the selected service.'],
  ['Run and monitor', 'Start the campaign and follow actual engine outcomes.'],
];
export function AutomationPanel({ isLocal }: { isLocal: boolean }) {
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function downloadConfig() {
    try {
      exportJson(
        isLocal ? await api('/integrations/mcp-config') : exampleConfig,
        'hyperaccounts-mcp.json',
      );
      setMessage(
        isLocal
          ? 'MCP configuration downloaded. Add your SMS key in your MCP client environment.'
          : 'Template downloaded. Replace the path with your local HyperAccounts installation.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function diagnose() {
    if (!isLocal) {
      setMessage(
        'Run diagnostics in the local app to inspect your actual engine.',
      );
      return;
    }
    setBusy(true);
    try {
      setDiagnostic(await api<Diagnostic>('/diagnostics'));
      setMessage('Local diagnostics updated. No accounts were started.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="automation-stack">
      <div className="automation-hero">
        <span className="automation-symbol">
          <Workflow size={28} />
        </span>
        <div>
          <span className="eyebrow">ONE WORKSPACE. THREE WAYS TO WORK.</span>
          <h2>From your dashboard to your agents.</h2>
          <p>
            Manage campaigns here, connect an MCP client, or build your own
            integration with the local API.
          </p>
        </div>
        <span className="automation-badge">LOCAL EXECUTION</span>
      </div>
      <div className="automation-grid">
        <section className="panel automation-card">
          <div className="integration-heading">
            <span className="metric-icon">
              <Bot size={22} />
            </span>
            <span className="status neutral">STDIO</span>
          </div>
          <h2>MCP server</h2>
          <p>
            21 tools for campaigns, account workflows, pricing, and diagnostics.
            Connect an MCP-compatible desktop client.
          </p>
          <pre className="code-block">{'node mcp/server.mjs'}</pre>
          <Button className="primary-button" onClick={downloadConfig}>
            <ArrowDownToLine size={16} />
            Download client config
          </Button>
          <small>
            Keep SMS keys in your local client environment. The MCP server does
            not return credential values.
          </small>
        </section>
        <section className="panel automation-card">
          <div className="integration-heading">
            <span className="metric-icon">
              <Braces size={22} />
            </span>
            <span className="status neutral">HTTP · v1</span>
          </div>
          <h2>Developer API</h2>
          <p>
            JSON endpoints with a published OpenAPI definition. The API runs
            alongside your dashboard on this computer.
          </p>
          <pre className="code-block">{'http://127.0.0.1:4371/api/v1'}</pre>
          <div className="integration-actions">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    'http://127.0.0.1:4371/api/v1',
                  );
                  setMessage('Local API URL copied.');
                } catch {
                  setMessage('API URL: http://127.0.0.1:4371/api/v1');
                }
              }}
            >
              <Copy size={16} />
              Copy API URL
            </Button>
            {isLocal && (
              <a
                className="text-button"
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
              >
                Open API schema ↗
              </a>
            )}
          </div>
          <small>
            Read /session first, then send X-HyperAccounts-Token with write
            requests.
          </small>
        </section>
      </div>
      {message && (
        <div className="feedback" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>A workflow your agent can follow</h2>
            <p>
              Available as the MCP prompt <code>prepare_account_workflow</code>.
            </p>
          </div>
        </div>
        <div className="workflow-steps">
          {steps.map(([title, detail], i) => (
            <div key={title}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Workspace diagnostics</h2>
            <p>
              Inspect connection and configuration issues without a support
              ticket.
            </p>
          </div>
          <Button variant="outline" onClick={diagnose} disabled={busy}>
            <RefreshCw size={16} className={busy ? 'spin' : ''} />
            Run check
          </Button>
        </div>
        {diagnostic ? (
          <div className="diagnostic-list">
            {diagnostic.checks.map((check) => (
              <div key={check.name}>
                <span
                  className={`status ${check.status === 'pass' ? 'green' : check.status === 'configured' ? 'neutral' : 'amber'}`}
                >
                  {check.status === 'pass' ? <Check size={13} /> : null}
                  {check.status}
                </span>
                <div>
                  <strong>{check.name}</strong>
                  <p>{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-inline automation-empty">
            {isLocal
              ? 'Run a check to read your installed engine and provider configuration.'
              : 'Diagnostics require the app running on your computer.'}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Feature coverage</h2>
            <p>HyperAccounts 0.2 · PVACreator engine adapter</p>
          </div>
        </div>
        <div className="coverage-list">
          {capabilities.features.map((feature) => (
            <div key={feature.name}>
              <div>
                <strong>{feature.name}</strong>
                <p>{feature.detail}</p>
              </div>
              <span
                className={`coverage-state ${feature.state === 'Implemented' ? 'complete' : ''}`}
              >
                {feature.state}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
