'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Workflow,
  Trash2,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Command,
  Database,
  FolderKanban,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEMO,
  type Snapshot,
  type Campaign,
  type Account,
  formatMoney,
  shortPlatform,
  api,
  exportJson,
} from '@/lib/studio';
import catalog from '@/lib/pricing.json';
import { AutomationPanel } from '@/components/automation-panel';
import { StepEnginePanel } from '@/components/step-engine-panel';

const navigation = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', title: 'Campaigns', icon: FolderKanban },
  { id: 'engine', title: 'Workflow builder', icon: Workflow },
  { id: 'accounts', title: 'Accounts', icon: Users },
  { id: 'verification', title: 'SMS & pricing', icon: Smartphone },
  { id: 'connections', title: 'Connections', icon: Layers3 },
  { id: 'automation', title: 'Automation & API', icon: Bot },
  { id: 'activity', title: 'Activity log', icon: Activity },
];
const descriptions: Record<string, string> = {
  overview: 'A clear view of your campaigns, accounts, and verification.',
  campaigns: 'Create, organize, and monitor your account workflows.',
  engine: 'Build reusable actions and run them from a table of inputs.',
  accounts: 'Review the accounts returned by your connected engine.',
  verification: 'Plan verification spend before you run a campaign.',
  connections: 'Keep your execution engine and services in sync.',
  automation: 'Connect your agents and build on your local workspace.',
  activity: 'Follow the changes and outcomes in your workspace.',
};

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    Run: 'Running',
    Stop: 'Ready',
    Pause: 'Paused',
    Success: 'Completed',
    Fail: 'Needs attention',
    Available: 'Available',
    Unvailable: 'Unavailable',
    Registing: 'In progress',
    NotRegister: 'Queued',
    Connected: 'Connected',
  };
  const tone = ['Run', 'Available', 'Success', 'Connected'].includes(value)
    ? 'green'
    : ['Fail', 'Unvailable'].includes(value)
      ? 'amber'
      : 'neutral';
  return (
    <span className={`status ${tone}`}>
      <span className={value === 'Run' ? 'pulse' : ''} />
      {labels[value] || value}
    </span>
  );
}
function ServiceIcon({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const google = /gmail|google/i.test(name);
  const outlook = /outlook|microsoft/i.test(name);
  return (
    <span
      className={`service-icon ${google ? 'google' : outlook ? 'outlook' : 'twitter'} ${small ? 'small' : ''}`}
    >
      {google ? (
        <Mail size={small ? 17 : 21} />
      ) : outlook ? (
        <span className="windows-mark">▦</span>
      ) : (
        <span className="x-mark">𝕏</span>
      )}
    </span>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Database size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default function Studio() {
  const [view, setView] = useState('overview');
  const [snapshot, setSnapshot] = useState<Snapshot>(DEMO);
  const [isLocal, setIsLocal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [campaignAccounts, setCampaignAccounts] = useState<Account[]>([]);
  const [accountError, setAccountError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [removal, setRemoval] = useState<{
    name: string;
    accountId?: string;
    username?: string;
  } | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [platform, setPlatform] = useState('');
  const [rateId, setRateId] = useState('google-youtube-gmail');
  const [quantity, setQuantity] = useState('10');
  const [addOpen, setAddOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    Username: '',
    Password: '',
    FirstName: '',
    LastName: '',
    PhoneService: '1',
    PhoneApiKey: '',
    PhoneCountry: '',
    RecoveryEmail: '',
    ProxyType: 'HTTP',
    Proxy: '',
    BirthYear: '',
    BirthMonth: '',
    BirthDay: '',
    Gender: '',
    Enable_IMAP_POP3: '',
    _2StepVerification: '',
  });

  async function refresh() {
    if (!isLocal) {
      setNotice(
        'Sample workspace refreshed. Open the local app for your PVACreator data.',
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSnapshot(await api('/snapshot'));
    } catch (e) {
      setSnapshot((s) => ({ ...s, connected: false }));
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (
      ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname) &&
      window.location.port === '4371'
    ) {
      setIsLocal(true);
      setSnapshot({
        ...DEMO,
        mode: 'live',
        campaigns: [],
        accounts: [],
        events: [],
        platforms: [],
        providers: [],
        connected: false,
      });
      setLoading(true);
      api('/snapshot')
        .then(setSnapshot)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      const timer = setInterval(
        () =>
          api('/snapshot')
            .then((s) => {
              setSnapshot(s);
              setError('');
            })
            .catch((e) => {
              setSnapshot((s) => ({ ...s, connected: false }));
              setError(e.message);
            }),
        30000,
      );
      return () => clearInterval(timer);
    }
  }, []);
  function navigate(next: string) {
    setView(next);
    setSearch('');
    setFilter('all');
    setNotice('');
  }
  const campaigns = snapshot.campaigns.filter(
    (c) =>
      (c.name + c.platform).toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || c.status === filter),
  );
  const accounts = snapshot.accounts.filter(
    (a) =>
      (a.username + a.campaign + a.platform)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'all' || a.status === filter),
  );
  const running = snapshot.campaigns.filter((c) => c.status === 'Run').length;
  const complete = snapshot.accounts.filter(
    (a) => a.status === 'Success',
  ).length;
  const attention = snapshot.accounts.filter((a) => a.status === 'Fail').length;
  const rates = catalog.services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const rate = catalog.services.find((s) => s.id === rateId)!;
  const estimated =
    quantity.trim() &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) >= 0 &&
    Number(quantity) <= 1000000
      ? rate.price_cents * Number(quantity)
      : null;
  async function inspect(c: Campaign) {
    setSelected(c);
    setError('');
    setAccountError('');
    setCampaignAccounts([]);
    if (!isLocal) {
      setCampaignAccounts(
        snapshot.accounts.filter((a) => a.campaign === c.name),
      );
      return;
    }
    try {
      setCampaignAccounts(
        (
          await api<{ accounts: Account[] }>(
            '/accounts?campaign=' + encodeURIComponent(c.name),
          )
        ).accounts,
      );
    } catch (e) {
      setAccountError((e as Error).message);
    }
  }
  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    setActionBusy(true);
    setError('');
    try {
      if (isLocal) {
        await api('/campaigns', { name: campaignName.trim(), platform });
        await refresh();
      } else {
        if (snapshot.campaigns.some((c) => c.name === campaignName.trim()))
          throw new Error('A campaign with this name already exists.');
        setSnapshot((s) => ({
          ...s,
          campaigns: [
            {
              name: campaignName.trim(),
              platform,
              status: 'Stop',
              total: 0,
              completed: 0,
              failed: 0,
              accountAccess: true,
            },
            ...s.campaigns,
          ],
          events: [
            {
              at: new Date().toISOString(),
              title: 'Sample campaign created',
              detail: campaignName.trim(),
              type: 'info',
            },
            ...s.events,
          ],
        }));
      }
      setNewOpen(false);
      setCampaignName('');
      navigate('campaigns');
      setNotice('Campaign created. Add accounts before starting.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  async function campaignAction(c: Campaign, action: 'start' | 'stop') {
    setActionBusy(true);
    setError('');
    try {
      if (isLocal) {
        await api('/campaigns/' + action, { name: c.name });
        await refresh();
      } else
        setSnapshot((s) => ({
          ...s,
          campaigns: s.campaigns.map((x) =>
            x.name === c.name
              ? { ...x, status: action === 'start' ? 'Run' : 'Pause' }
              : x,
          ),
          events: [
            {
              at: new Date().toISOString(),
              title:
                action === 'start'
                  ? 'Sample campaign started'
                  : 'Sample campaign paused',
              detail: c.name,
              type: 'info',
            },
            ...s.events,
          ],
        }));
      setSelected(null);
      setNotice(
        action === 'start'
          ? 'Campaign started.'
          : 'Campaign stopped. Completed accounts are retained.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  async function addAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setActionBusy(true);
    setError('');
    try {
      if (isLocal) {
        await api('/accounts/add', {
          campaignName: selected.name,
          account: accountForm,
        });
        await refresh();
      } else {
        const account: Account = {
          id: crypto.randomUUID(),
          username: accountForm.Username,
          campaign: selected.name,
          platform: selected.platform,
          status: 'NotRegister',
        };
        setSnapshot((s) => ({
          ...s,
          accounts: [...s.accounts, account],
          campaigns: s.campaigns.map((c) =>
            c.name === selected.name ? { ...c, total: (c.total || 0) + 1 } : c,
          ),
        }));
      }
      setAddOpen(false);
      setSelected(null);
      setAccountForm({
        Username: '',
        Password: '',
        FirstName: '',
        LastName: '',
        PhoneService: '1',
        PhoneApiKey: '',
        PhoneCountry: '',
        RecoveryEmail: '',
        ProxyType: 'HTTP',
        Proxy: '',
        BirthYear: '',
        BirthMonth: '',
        BirthDay: '',
        Gender: '',
        Enable_IMAP_POP3: '',
        _2StepVerification: '',
      });
      setNotice('Account added to the campaign. It has not been started.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }

  async function removeRecord() {
    if (!removal) return;
    setActionBusy(true);
    setError('');
    try {
      if (isLocal) {
        await api(
          removal.accountId ? '/accounts/remove' : '/campaigns/remove',
          removal.accountId
            ? { campaignName: removal.name, accountId: removal.accountId }
            : { name: removal.name },
        );
        await refresh();
      } else
        setSnapshot((s) => ({
          ...s,
          accounts: s.accounts.filter((a) =>
            removal.accountId
              ? a.id !== removal.accountId
              : a.campaign !== removal.name,
          ),
          campaigns: removal.accountId
            ? s.campaigns.map((c) =>
                c.name === removal.name
                  ? { ...c, total: Math.max(0, (c.total || 0) - 1) }
                  : c,
              )
            : s.campaigns.filter((c) => c.name !== removal.name),
          events: [
            {
              at: new Date().toISOString(),
              title: removal.accountId
                ? 'Sample account removed'
                : 'Sample campaign removed',
              detail: removal.name,
              type: 'info',
            },
            ...s.events,
          ],
        }));
      setSelected(null);
      setRemoval(null);
      setNotice('Record removed from the workspace.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  function CampaignTable({ rows }: { rows: Campaign[] }) {
    return rows.length ? (
      <Table className="campaign-table">
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Accounts</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.name}>
              <TableCell>
                <button className="campaign-name" onClick={() => inspect(c)}>
                  <ServiceIcon name={c.platform} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{shortPlatform(c.platform)}</small>
                  </span>
                </button>
              </TableCell>
              <TableCell>
                <Status value={c.status} />
              </TableCell>
              <TableCell className="progress-cell">
                {c.total !== null ? (
                  <>
                    <div className="progress-numbers">
                      <span>
                        {c.completed ?? 0} / {c.total}
                      </span>
                      <span>
                        {c.total
                          ? Math.round(((c.completed || 0) / c.total) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <Progress
                      value={c.total ? ((c.completed || 0) / c.total) * 100 : 0}
                      aria-label={`${c.name} completion`}
                    />
                  </>
                ) : (
                  <span className="muted">Not available</span>
                )}
              </TableCell>
              <TableCell>
                <span className="mono">{c.total ?? '—'}</span>
                {(c.failed || 0) > 0 && (
                  <small className="failure-note">{c.failed} need review</small>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open ${c.name}`}
                  onClick={() => inspect(c)}
                >
                  <ArrowUpRight size={17} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <EmptyState
        title="No campaigns found"
        text={
          search
            ? 'Try a different name or filter.'
            : 'Create a campaign to organize your next workflow.'
        }
      />
    );
  }
  function EventList({ full = false }: { full?: boolean }) {
    return (
      <div className={`activity-list ${full ? 'full-log' : ''}`}>
        {(full ? snapshot.events : snapshot.events.slice(0, 3)).map(
          (event, i) => (
            <div className="activity-item" key={i}>
              <span className={`event-icon ${event.type}`}>
                <Check size={14} />
              </span>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
              <time>
                {full
                  ? new Date(event.at)
                      .toISOString()
                      .replace('T', ' ')
                      .slice(0, 19) + ' UTC'
                  : new Date(event.at).toISOString().slice(11, 16) + ' UTC'}
              </time>
            </div>
          ),
        )}
        {snapshot.events.length === 0 && (
          <p className="empty-inline">
            Actions you take in HyperAccounts will appear here.
          </p>
        )}
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ '--sidebar-width': '244px' } as React.CSSProperties}
    >
      <Sidebar className="studio-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => navigate('overview')}>
            <span className="brand-symbol">
              <Command size={23} />
            </span>
            <span>
              Hyper<span className="brand-light">Accounts</span>
              <small>ACCOUNT WORKSPACE</small>
            </span>
          </button>
          <div className="workspace-picker">
            <span className="workspace-avatar">P</span>
            <span>
              Personal workspace
              <small>
                {isLocal ? 'On this computer' : 'Interactive preview'}
              </small>
            </span>
            <ChevronRight size={15} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={view === item.id}
                    onClick={() => navigate(item.id)}
                    className="nav-button"
                  >
                    <item.icon size={18} />
                    <span>{item.title}</span>
                    {item.id === 'campaigns' && (
                      <span className="nav-count">
                        {snapshot.campaigns.length}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>
              Your accounts.
              <br />
              Your workspace.
            </strong>
            <p>Local execution keeps credentials on your computer.</p>
            <button onClick={() => navigate('connections')}>
              Manage connections <ArrowRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="engine-card"
            onClick={() => navigate('connections')}
          >
            <span
              className={`connection-dot ${isLocal && snapshot.connected ? 'online' : ''}`}
            />
            <span>
              {isLocal ? 'PVACreator engine' : 'Sample workspace'}
              <small>
                {isLocal
                  ? snapshot.connected
                    ? 'Connected locally'
                    : 'Connection unavailable'
                  : 'Sample changes reset on reload'}
              </small>
            </span>
            <Settings2 size={16} />
          </button>
          <div className="sidebar-version">
            <span>HYPERACCOUNTS</span>
            <span>01.0</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="main-surface">
        <header className="topbar">
          <div className="breadcrumbs">
            <SidebarTrigger />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === view)?.title}</strong>
          </div>
          <div className="topbar-right">
            <span className={`mode-label ${isLocal ? 'live' : ''}`}>
              <span />
              {isLocal ? 'LOCAL WORKSPACE' : 'SAMPLE DATA'}
            </span>
            <button
              className="refresh-icon"
              aria-label="Refresh workspace"
              onClick={refresh}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
            <span className="user-avatar">P</span>
          </div>
        </header>
        <main className="workspace-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR OPERATIONS, IN FOCUS</div>
              <h1>
                {view === 'overview'
                  ? 'Workspace overview'
                  : navigation.find((n) => n.id === view)?.title}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-actions">
              {view === 'accounts' && (
                <Button
                  variant="outline"
                  onClick={() =>
                    exportJson(accounts, 'hyperaccounts-accounts.json')
                  }
                >
                  <ArrowDownToLine size={16} />
                  Export view
                </Button>
              )}
              <Button
                className="primary-button"
                onClick={() => {
                  setNewOpen(true);
                  setError('');
                  setPlatform(
                    snapshot.platforms.find((p) => p.status === 'Available')
                      ?.name || '',
                  );
                }}
              >
                <Plus size={17} />
                New campaign
              </Button>
            </div>
          </div>
          {(error || notice) && (
            <div
              className={`feedback ${error ? 'error' : ''}`}
              role={error ? 'alert' : 'status'}
            >
              {error || notice}
              <button
                aria-label="Dismiss message"
                onClick={() => {
                  setError('');
                  setNotice('');
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'overview' && (
            <>
              <div className="metrics">
                <div className="metric">
                  <span className="metric-icon">
                    <FolderKanban size={19} />
                  </span>
                  <p>Active campaigns</p>
                  <strong>{running.toString().padStart(2, '0')}</strong>
                  <small>
                    <span className="green-text">
                      {snapshot.campaigns.length}
                    </span>{' '}
                    campaigns in your workspace
                  </small>
                  <div className="mini-bars">
                    {[24, 40, 32, 52, 46, 66, 60, 78, 69, 88, 82, 96].map(
                      (h, i) => (
                        <i key={i} style={{ height: h + '%' }} />
                      ),
                    )}
                  </div>
                </div>
                <div className="metric">
                  <span className="metric-icon">
                    <Users size={19} />
                  </span>
                  <p>Accounts in view</p>
                  <strong>{snapshot.accounts.length.toLocaleString()}</strong>
                  <small>
                    {isLocal
                      ? 'From supported account endpoints'
                      : 'Illustrative account records'}
                  </small>
                  <span className="metric-accent">↗</span>
                </div>
                <div className="metric">
                  <span className="metric-icon">
                    <CheckCheck size={19} />
                  </span>
                  <p>Verified accounts</p>
                  <strong>{complete.toLocaleString()}</strong>
                  <small>
                    {attention
                      ? `${attention} account needs review`
                      : 'Completed accounts in this view'}
                  </small>
                </div>
                <div className="metric dark-metric">
                  <span className="metric-icon">
                    <CircleDollarSign size={19} />
                  </span>
                  <p>Gmail verification</p>
                  <strong>
                    $1.30<span>/ code</span>
                  </strong>
                  <small>Standard rate from your catalog</small>
                  <button onClick={() => navigate('verification')}>
                    Estimate a campaign <ArrowRight size={15} />
                  </button>
                </div>
              </div>
              <div className="overview-grid">
                <section className="panel campaigns-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Campaigns at a glance</h2>
                      <p>Keep the next step in sight.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate('campaigns')}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <CampaignTable rows={snapshot.campaigns.slice(0, 4)} />
                  <div className="panel-foot">
                    <span className="connection-dot online" />
                    {isLocal
                      ? 'Refreshes every 30 seconds'
                      : 'Sample campaigns · preview actions only'}
                    <button onClick={refresh}>
                      Refresh <RefreshCw size={13} />
                    </button>
                  </div>
                </section>
                <section className="panel modules-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Connected modules</h2>
                      <p>Ready when your engine is.</p>
                    </div>
                    <Layers3 size={18} className="muted" />
                  </div>
                  <div className="module-list">
                    {snapshot.platforms.map((p) => (
                      <div className="module-row" key={p.name}>
                        <ServiceIcon name={p.name} small />
                        <div>
                          <strong>{shortPlatform(p.name)}</strong>
                          <small>
                            {p.status === 'Available'
                              ? 'Engine module available'
                              : 'Check activation in PVACreator'}
                          </small>
                        </div>
                        <span
                          className={`module-dot ${p.status === 'Available' ? 'green' : 'amber'}`}
                          title={p.status}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="module-callout">
                    <KeyRound size={18} />
                    <div>
                      <strong>
                        {snapshot.platforms.some(
                          (p) =>
                            p.name === 'Gmail_Bypass_QR_Code' &&
                            p.status === 'Available',
                        )
                          ? 'Gmail QR is available'
                          : 'Gmail QR needs attention'}
                      </strong>
                      <p>
                        Availability is controlled by your PVACreator license
                        and engine.
                      </p>
                      <button onClick={() => navigate('connections')}>
                        Review connection <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
              <div className="lower-grid">
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <h2>Recent activity</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate('activity')}
                    >
                      View log <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <EventList />
                </section>
                <section className="quick-estimate">
                  <span className="estimate-icon">
                    <Smartphone size={24} />
                  </span>
                  <div>
                    <span className="eyebrow">PAY WHEN THE CODE ARRIVES</span>
                    <h2>A little clarity on every verification.</h2>
                    <p>
                      Compare all {catalog.services.length} rates. Unused
                      numbers are refunded to your provider balance.
                    </p>
                    <button onClick={() => navigate('verification')}>
                      Explore verification pricing <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {view === 'campaigns' && (
            <section className="panel">
              <div className="table-toolbar">
                <Tabs
                  value={filter}
                  onValueChange={(v) => setFilter(String(v))}
                >
                  <TabsList>
                    <TabsTrigger value="all">All campaigns</TabsTrigger>
                    <TabsTrigger value="Run">Running</TabsTrigger>
                    <TabsTrigger value="Pause">Paused</TabsTrigger>
                    <TabsTrigger value="Stop">Ready</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="search-field">
                  <Search size={16} />
                  <Input
                    aria-label="Search campaigns"
                    placeholder="Search campaigns…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <CampaignTable rows={campaigns} />
            </section>
          )}
          {view === 'accounts' && (
            <section className="panel">
              <div className="table-toolbar">
                <Tabs
                  value={filter}
                  onValueChange={(v) => setFilter(String(v))}
                >
                  <TabsList>
                    <TabsTrigger value="all">All accounts</TabsTrigger>
                    <TabsTrigger value="Success">Completed</TabsTrigger>
                    <TabsTrigger value="Fail">Needs attention</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="search-field">
                  <Search size={16} />
                  <Input
                    aria-label="Search accounts"
                    placeholder="Search accounts…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {snapshot.warnings?.map((w) => (
                <div className="data-warning" key={w}>
                  {w}
                </div>
              ))}
              {accounts.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Platform</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <span className="account-address">
                            <Mail size={16} />
                            {a.username}
                          </span>
                        </TableCell>
                        <TableCell>{a.campaign}</TableCell>
                        <TableCell>
                          <Status value={a.status} />
                        </TableCell>
                        <TableCell>{shortPlatform(a.platform)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  title="No accounts available in this view"
                  text="The engine’s account endpoint supports Gmail QR campaigns. Legacy campaigns may not expose their accounts here."
                />
              )}
            </section>
          )}
          {view === 'verification' && (
            <div className="pricing-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Verification catalog{' '}
                      <span className="count-chip">
                        {catalog.services.length}
                      </span>
                    </h2>
                    <p>Your supplied rates · USD per number receiving a code</p>
                  </div>
                </div>
                <div className="pricing-search search-field">
                  <Search size={16} />
                  <Input
                    aria-label="Search verification services"
                    placeholder="Find a service…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="price-list">
                  {rates.map((s) => (
                    <button
                      className={`price-row ${rateId === s.id ? 'selected' : ''}`}
                      key={s.id}
                      onClick={() => setRateId(s.id)}
                    >
                      <span>
                        <strong>{s.name}</strong>
                        {'variant_unspecified' in s && (
                          <small>Variant not specified in supplied list</small>
                        )}
                      </span>
                      <span className="mono">
                        {formatMoney(s.price_cents)}
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                  {rates.length === 0 && (
                    <EmptyState
                      title="No matching service"
                      text="Try another name."
                    />
                  )}
                </div>
              </section>
              <aside className="calculator panel">
                <div className="calculator-top">
                  <span className="metric-icon">
                    <CircleDollarSign size={22} />
                  </span>
                  <h2>Cost estimate</h2>
                  <p>Know the rate before you run.</p>
                </div>
                <div className="calculator-body">
                  <label>Selected service</label>
                  <div className="selected-service">
                    <Smartphone size={18} />
                    <strong>{rate.name}</strong>
                  </div>
                  <label htmlFor="quantity">Numbers receiving a code</label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <div className="estimate-line">
                    <span>Rate per received code</span>
                    <strong>{formatMoney(rate.price_cents)}</strong>
                  </div>
                  <div className="estimate-total">
                    <span>Estimated SMS cost</span>
                    <strong>
                      {estimated === null ? '—' : formatMoney(estimated)}
                    </strong>
                    <small>USD</small>
                  </div>
                  {estimated === null && (
                    <p role="alert" className="field-error">
                      Enter a whole number from 0 to 1,000,000.
                    </p>
                  )}
                  <p className="estimate-note">
                    Charged when an SMS code arrives, even if account creation
                    later fails. Unused rentals follow your provider’s refund
                    policy.
                  </p>
                  <div className="estimate-disclaimer">
                    <ShieldCheck size={17} />
                    <span>
                      Catalog estimates only. Your current provider’s live price
                      determines the actual charge.
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          )}
          {view === 'connections' && (
            <div className="connections-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Execution engine</h2>
                    <p>Automation runs in your installed PVACreator.</p>
                  </div>
                  <Status
                    value={
                      isLocal
                        ? snapshot.connected
                          ? 'Connected'
                          : 'Offline'
                        : 'Preview'
                    }
                  />
                </div>
                <div className="engine-detail">
                  <div className="engine-logo">
                    <Command size={30} />
                  </div>
                  <div>
                    <h3>PVACreator for Windows</h3>
                    <p>
                      {isLocal
                        ? 'Connected through the local HyperAccounts server.'
                        : 'Open HyperAccounts on your computer for live campaigns.'}
                    </p>
                    <code>localhost:52636</code>
                  </div>
                  <Button variant="outline" onClick={refresh}>
                    <RefreshCw size={15} />
                    Check connection
                  </Button>
                </div>
                <div className="connection-help">
                  <Wifi size={18} />
                  <p>
                    {isLocal
                      ? 'Starting campaigns can use paid SMS and CAPTCHA services. The engine determines which actions are supported.'
                      : 'This private preview uses sample data. The local app connects directly to PVACreator; credentials never go through this preview.'}
                  </p>
                </div>
                <div className="panel-heading border-top">
                  <h2>Module availability</h2>
                </div>
                <div className="connection-modules">
                  {snapshot.platforms.map((p) => (
                    <div className="connection-module" key={p.name}>
                      <ServiceIcon name={p.name} />
                      <div>
                        <strong>{shortPlatform(p.name)}</strong>
                        <p>
                          {p.status === 'Available'
                            ? 'Available in the connected engine.'
                            : 'Check your module entitlement or activation in PVACreator.'}
                        </p>
                      </div>
                      <Status value={p.status} />
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel provider-panel">
                <div className="panel-heading">
                  <div>
                    <h2>External services</h2>
                    <p>Configuration on this computer.</p>
                  </div>
                </div>
                {snapshot.providers.map((p) => (
                  <div className="provider-row" key={p.name}>
                    <span className="provider-icon">
                      {p.kind === 'SMS' ? (
                        <Smartphone size={19} />
                      ) : (
                        <ShieldCheck size={19} />
                      )}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <p>{p.kind} provider</p>
                    </div>
                    <span className="provider-state">
                      {p.configured ? 'Key saved' : 'Not configured'}
                    </span>
                  </div>
                ))}
                <div className="provider-note">
                  Saved credentials have not been tested. Provider keys are
                  managed in PVACreator and are never displayed here.
                </div>
              </section>
            </div>
          )}
          {view === 'activity' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Workspace activity</h2>
                  <p>
                    {isLocal
                      ? 'Actions recorded by HyperAccounts on this computer.'
                      : 'Illustrative events for this sample workspace.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportJson(snapshot.events, 'hyperaccounts-activity.json')
                  }
                >
                  <ArrowDownToLine size={16} />
                  Export log
                </Button>
              </div>
              <EventList full />
            </section>
          )}
          {view === 'automation' && <AutomationPanel isLocal={isLocal} />}
          {view === 'engine' && <StepEnginePanel isLocal={isLocal} />}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={14} />
              {isLocal
                ? 'Local workspace · credentials stay on this computer'
                : 'Interactive preview · sample accounts and campaigns'}
            </span>
            <span>Thoughtfully organized. Ready for work.</span>
          </footer>
        </main>
      </SidebarInset>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="studio-dialog sm:max-w-lg">
          <DialogHeader>
            <span className="dialog-icon">
              <FolderKanban size={22} />
            </span>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              {isLocal
                ? 'Create an empty campaign in PVACreator. It stays stopped until you start it.'
                : 'Create a sample campaign to explore the workspace.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createCampaign} className="campaign-form">
            <label htmlFor="campaign-name">Campaign name</label>
            <Input
              id="campaign-name"
              required
              maxLength={80}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Gmail · customer support"
            />
            <label>Platform</label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(String(v))}
            >
              <SelectTrigger className="w-full" aria-label="Campaign platform">
                <SelectValue>
                  {shortPlatform(platform) || 'Choose a platform'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {snapshot.platforms.map((p) => (
                  <SelectItem
                    key={p.name}
                    value={p.name}
                    disabled={p.status !== 'Available'}
                  >
                    {shortPlatform(p.name)}
                    {p.status !== 'Available' ? ' · unavailable' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="form-help">
              Availability comes from the engine. Account entry through the API
              is currently documented for Gmail QR only.
            </p>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={actionBusy || !campaignName.trim() || !platform}
                className="primary-button"
              >
                {actionBusy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                Create campaign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected && !addOpen && !removal}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <ServiceIcon name={selected.platform} />
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {shortPlatform(selected.platform)} · Campaign details
                </DialogDescription>
              </DialogHeader>
              <div className="detail-summary">
                <Status value={selected.status} />
                <span>
                  {selected.total === null
                    ? 'Account totals are not exposed by this endpoint.'
                    : `${selected.completed || 0} of ${selected.total} completed`}
                </span>
              </div>
              {accountError && (
                <div className="data-warning">{accountError}</div>
              )}
              {campaignAccounts.length ? (
                <div className="detail-account-list">
                  {campaignAccounts.map((a) => (
                    <div key={a.id}>
                      <span>{a.username}</span>
                      <Status value={a.status} />
                      <button
                        className="remove-account"
                        disabled={selected.status === 'Run' || actionBusy}
                        aria-label={`Remove ${a.username}`}
                        onClick={() => {
                          setError('');
                          setRemoval({
                            name: selected.name,
                            accountId: a.id,
                            username: a.username,
                          });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-inline">
                  No account records are available for this campaign.
                </p>
              )}
              <p className="form-help">
                Starting runs every queued account and can incur provider fees.
                Stopping does not undo completed work.
              </p>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={
                    isLocal && selected.platform !== 'Gmail_Bypass_QR_Code'
                  }
                  onClick={() => {
                    setAddOpen(true);
                    setError('');
                  }}
                >
                  <Plus size={16} />
                  Add account
                </Button>
                {selected.status === 'Run' ? (
                  <Button
                    disabled={actionBusy}
                    onClick={() => campaignAction(selected, 'stop')}
                  >
                    <Pause size={16} />
                    Stop campaign
                  </Button>
                ) : (
                  <Button
                    className="primary-button"
                    disabled={
                      actionBusy ||
                      selected.total === 0 ||
                      (isLocal && !selected.accountAccess)
                    }
                    onClick={() => campaignAction(selected, 'start')}
                  >
                    <Play size={16} />
                    Start campaign
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="danger-action"
                  disabled={selected.status === 'Run' || actionBusy}
                  onClick={() => {
                    setError('');
                    setRemoval({ name: selected.name });
                  }}
                >
                  <Trash2 size={15} />
                  Remove
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open)
            setAccountForm((f) => ({
              ...f,
              Password: '',
              PhoneApiKey: '',
              Proxy: '',
            }));
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              {isLocal
                ? 'Account details are sent only to your local PVACreator engine.'
                : 'Use sample account details. No registration occurs in the preview.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="campaign-form account-form-scroll"
            onSubmit={addAccount}
          >
            <label htmlFor="account-user">Username</label>
            <Input
              id="account-user"
              value={accountForm.Username}
              required
              onChange={(e) =>
                setAccountForm({ ...accountForm, Username: e.target.value })
              }
              autoComplete="off"
            />
            {isLocal && (
              <>
                <label htmlFor="account-password">Password</label>
                <Input
                  id="account-password"
                  type="password"
                  value={accountForm.Password}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, Password: e.target.value })
                  }
                  autoComplete="new-password"
                />
                <label>SMS provider</label>
                <Select
                  value={accountForm.PhoneService}
                  onValueChange={(v) =>
                    setAccountForm({ ...accountForm, PhoneService: String(v) })
                  }
                >
                  <SelectTrigger aria-label="SMS provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ['1', 'SMSPVA'],
                      ['2', '5sim'],
                      ['3', 'SMS Activate'],
                      ['7', 'Tinderre'],
                      ['10', 'TextVerified'],
                      ['11', 'DaisySMS'],
                    ].map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label htmlFor="sms-key">SMS API key</label>
                <Input
                  id="sms-key"
                  type="password"
                  required
                  autoComplete="off"
                  value={accountForm.PhoneApiKey}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      PhoneApiKey: e.target.value,
                    })
                  }
                />
                <label htmlFor="sms-country">Provider country code</label>
                <Input
                  id="sms-country"
                  value={accountForm.PhoneCountry}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      PhoneCountry: e.target.value,
                    })
                  }
                />
                <p className="form-help">
                  Country codes depend on the SMS provider. Check the provider
                  mapping before adding an account.
                </p>
                <details className="advanced-fields">
                  <summary>Profile, proxy & account options</summary>
                  <div className="advanced-grid">
                    {(
                      [
                        ['FirstName', 'First name'],
                        ['LastName', 'Last name'],
                        ['RecoveryEmail', 'Recovery email'],
                        ['BirthYear', 'Birth year'],
                        ['BirthMonth', 'Birth month'],
                        ['BirthDay', 'Birth day'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <Input
                          autoComplete="off"
                          value={accountForm[key]}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Gender code
                      <Select
                        value={accountForm.Gender || 'default'}
                        onValueChange={(v) =>
                          setAccountForm({
                            ...accountForm,
                            Gender: v === 'default' ? '' : String(v),
                          })
                        }
                      >
                        <SelectTrigger aria-label="Gender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Engine default
                          </SelectItem>
                          <SelectItem value="1">Male</SelectItem>
                          <SelectItem value="2">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label>
                      Proxy type
                      <Select
                        value={accountForm.ProxyType}
                        onValueChange={(v) =>
                          setAccountForm({
                            ...accountForm,
                            ProxyType: String(v),
                          })
                        }
                      >
                        <SelectTrigger aria-label="Proxy type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="wide">
                      Proxy (host:port:username:password)
                      <Input
                        type="password"
                        autoComplete="off"
                        value={accountForm.Proxy}
                        onChange={(e) =>
                          setAccountForm({
                            ...accountForm,
                            Proxy: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>
                        <input
                          type="checkbox"
                          checked={!!accountForm.Enable_IMAP_POP3}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              Enable_IMAP_POP3: e.target.checked ? '1' : '',
                            })
                          }
                        />{' '}
                        Enable IMAP / POP3
                      </span>
                    </label>
                    <label>
                      <span>
                        <input
                          type="checkbox"
                          checked={accountForm._2StepVerification === '1'}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              _2StepVerification: e.target.checked ? '1' : '',
                            })
                          }
                        />{' '}
                        Enable two-step verification
                      </span>
                    </label>
                  </div>
                </details>
              </>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setAccountForm((f) => ({
                    ...f,
                    Password: '',
                    PhoneApiKey: '',
                    Proxy: '',
                  }));
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="primary-button"
                disabled={actionBusy || !accountForm.Username.trim()}
              >
                Add account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!removal}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
      >
        <DialogContent className="studio-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {removal?.accountId
                ? 'Remove account record?'
                : 'Remove campaign?'}
            </DialogTitle>
            <DialogDescription>
              {removal?.accountId ? removal.username : removal?.name}
            </DialogDescription>
          </DialogHeader>
          <p className="remove-explanation">
            {removal?.accountId
              ? 'This removes the record from the engine campaign. It does not delete the account on the external service.'
              : 'This removes the campaign and its saved records from the engine. This action cannot be undone in HyperAccounts.'}
          </p>
          {!isLocal && (
            <p className="form-help">This preview changes sample data only.</p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button variant="outline" onClick={() => setRemoval(null)}>
              Keep record
            </Button>
            <Button
              variant="destructive"
              disabled={actionBusy}
              onClick={removeRecord}
            >
              <Trash2 size={16} />
              Remove record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
