# HyperAccounts

A desktop-local account workspace with a visual workflow builder, an independent browser step engine, a versioned HTTP API, and a 21-tool MCP server. An optional adapter connects to the existing PVACreator Windows engine. It includes editable actions, input tables, checkpoints, campaign controls, diagnostics, action history, and the 241-entry verification catalog supplied for this project.

The step engine is independently implemented and runs without PVACreator. The optional PVACreator adapter uses its documented local API. This is not PVACreator source code, full feature parity, or a license unlock. Gmail-specific registration has not yet been verified.

## Run on Windows

Requires Node.js 22.13+ and Google Chrome. PVACreator is required only for its adapter, not for the independent step engine.
The build uses a project-local Node.js 22.22 runtime for Windows compatibility.

```powershell
npm install
npm run build
npm run local
```

Open http://127.0.0.1:4371/. The `local/launch.ps1` launcher opens the app and starts its server in the background if needed. A desktop shortcut can point to this launcher.

The engine defaults to `http://127.0.0.1:52636/api`, with the PVACreator installation at `E:\PVACreator`. Override these through `PVA_API_URL` and `PVA_DIRECTORY` before starting the server. Remote engines are deliberately rejected. The service binds only to 127.0.0.1 and requires matching host/origin and a session token for changes.

## What works

**Independent engine:** Open Workflow builder, select Add local test, add a username row, select it, and Run. The browser opens a local form and checks its completion marker. No real account or paid verification is involved. This exact worker path is integration-tested with Chrome.

- Build workflows from Open page, Fill input, Click element, Select option, Wait for element, Verify success, Human checkpoint, and Solve image CAPTCHA actions.
- Click an action to inspect its saved options. Edit workflows and defaults; when existing rows refer to a workflow, edits create a revision that preserves their original definition.
- Use shared account input columns, bind inputs with `$column`, and store secret environment-variable references instead of secret values in rows.
- Choose Manual, 2Captcha, or Anti-Captcha for image CAPTCHA steps. Set workflow defaults, per-action overrides, or `captchaProvider` and `captchaKeyEnv` row overrides. Secret key names must start with `HYPERACCOUNTS_SECRET_`.
- Run a serial queue with one isolated Chrome session per row. Pause between steps, complete human verification checkpoints, resume, or cancel. Browser sessions are not retained after success or server restart.
- Inspect per-step results and export workflow/row JSON. A successful row means its configured final check passed; it is not independent proof of external account creation.
- Persist definitions and row progress locally in ignored `.studio/engine.json`. Interrupted jobs require explicit restart after inspecting previous external outcomes.

CAPTCHA adapters support image-to-text only. Other challenge types use a human checkpoint until an adapter is implemented. Paid adapters are tested with mocked provider responses, not live purchases. Keys referenced by independent workflows must be available in the **local server's environment**; MCP-only environment variables are used by the PVACreator `add_account` tool. No unattended Gmail QR solution is included.

**PVACreator adapter:**

- Discover engine-supported campaigns and locally saved legacy campaign names.
- View live module availability and whether provider credentials are configured, without displaying the keys.
- Create an empty campaign using an available module.
- List all pages of accounts for supported Gmail QR campaigns, with credential fields removed.
- Add an account to an available Gmail QR campaign, using credentials entered only in the local app.
- Start supported campaigns with queued accounts, or stop an existing campaign without deleting it.
- Remove stopped campaigns or individual account records, using explicit removal controls.
- Set documented Gmail profile, proxy, IMAP/POP3, and two-step-verification options when adding accounts.
- Store Studio's action history and created campaign names locally in ignored `.studio/workspace.json`.
- Search and filter campaigns, accounts, and verification prices; export account views and action history as JSON.
- Estimate SMS costs in integer cents. The supplied catalog is a snapshot, not a provider quote or a spend cap.

The hosted version is an interactive sample workspace. It never calls your computer or handles real provider credentials. Changes in the sample reset on reload. Real campaign state lives in PVACreator; Studio activity persists in the local app.

## Engine limitations

The published account API currently documents Gmail QR accounts only. Legacy Gmail campaigns may return campaign status but not account records. Unsupported account totals are shown as unavailable, not guessed. Standard Gmail, Outlook, and Twitter account entry may still need the original Windows interface.

Gmail QR must be available under your actual PVACreator license. Studio does not activate or replace the module. Saved SMS/CAPTCHA keys do not mean the provider has been tested. A campaign start can use paid provider services; no campaign is started automatically.

No real SMS transaction ledger is exposed in this API. The price calculator is an estimate and does not claim to report actual charges or refunds. An SMS can be charged even if account creation later fails.

## Development and checks

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

The bridge tests use a disposable mock engine. They verify pagination, credential redaction, origin/token checks, unavailable-module handling, account validation, and persistence without creating real accounts or spending credits.
The MCP integration test launches the real stdio server and connects the official MCP client SDK to check discovery, tool calls, resources, prompts, validation, and secret redaction.

## MCP integration

Start the local app first. In **Automation & API**, download the client configuration with the correct executable and absolute path for this installation. Add it to an MCP-compatible client. A portable template is:

```json
{
  "mcpServers": {
    "hyperaccounts": {
      "command": "node",
      "args": ["C:/path/to/HyperAccounts/mcp/server.mjs"],
      "env": {
        "HYPERACCOUNTS_URL": "http://127.0.0.1:4371",
        "HYPERACCOUNTS_SMS_API_KEY": "configure-your-provider-key-locally"
      }
    }
  }
}
```

Use a client secret store where available. Do not commit populated client configuration. The MCP server reads the SMS key from an environment variable; it does not include it in tool results. Account and proxy credentials supplied as tool arguments may still be recorded by the MCP client itself.

Tools: `workspace_status`, `list_platforms`, `list_campaigns`, `get_campaign`, `create_campaign`, `list_accounts`, `add_account`, `start_campaign`, `stop_campaign`, `remove_campaign`, `remove_account`, `search_verification_prices`, `estimate_verification_cost`, and `diagnose_workspace`.

Independent engine tools: `engine_status`, `engine_create_workflow`, `engine_add_rows`, `engine_start_rows`, `engine_pause_row`, `engine_resume_row`, and `engine_cancel_row`. These use `/api/v1/engine` and do not need a connected PVACreator instance.

The `prepare_account_workflow` prompt guides an agent through availability, required input, cost estimates, campaign setup, execution, and monitoring. The `hyperaccounts://capabilities` resource reports supported features and engine dependencies. All tests use mock services. A live Gmail QR registration has not been verified on this installation because the module is currently unavailable.

## Local HTTP API

Base URL: `http://127.0.0.1:4371/api/v1`. The full machine-readable schema is at `/api/v1/openapi.json`. Read `/session` and include its `csrfToken` as `X-HyperAccounts-Token` for POST requests. Tokens expire when the server restarts. The dashboard and MCP server use this same API.

```powershell
$hyperSession = Invoke-RestMethod http://127.0.0.1:4371/api/v1/session
$hyperHeaders = @{ 'X-HyperAccounts-Token' = $hyperSession.csrfToken }
Invoke-RestMethod http://127.0.0.1:4371/api/v1/platforms
Invoke-RestMethod 'http://127.0.0.1:4371/api/v1/pricing/estimate?serviceId=google-youtube-gmail&count=10'
# Create an empty campaign only when its module is available:
$hyperBody = @{ name = 'My QR campaign'; platform = 'Gmail_Bypass_QR_Code' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:4371/api/v1/campaigns -Method Post -Headers $hyperHeaders -ContentType application/json -Body $hyperBody
```

Writes are serialized but are not transactional with the external engine. Do not automatically retry a timed-out write: inspect campaign/account state first to avoid duplicates. There is no remote/public API listener, cloud credential vault, or hosted execution engine in this release.

## Coverage and next implementation boundary

The **Automation & API → Feature coverage** view and `lib/capabilities.json` distinguish completed features from unavailable functions. The dashboard is independently designed; it has not been visually verified against every screen of the installed PVACreator app. The independent step engine is implemented, but platform-specific registration templates, persistent browser-profile management, Account Speeder/warm-up, and fingerprint infrastructure remain outstanding. This release must not be represented as a complete standalone PVACreator clone or a verified Gmail creator.

Image CAPTCHA adapter references: [2Captcha ImageToTextTask](https://2captcha.com/api-docs/normal-captcha), [Anti-Captcha ImageToTextTask](https://anti-captcha.com/apidoc/task-types/ImageToTextTask).

References: [official PVACreator skill](https://github.com/PVACreator/PVACreator-skills/blob/main/pvacreator/SKILL.md), [Gmail account fields](https://github.com/PVACreator/PVACreator-skills/blob/main/pvacreator/references/gmail-info.md).
