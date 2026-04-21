'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getApiKeys, createApiKey, deleteApiKey, ApiKeyInfo, getAccount, updateAccount, AccountInfo } from '@/lib/api'
import { SOURCE_KIND } from '@/lib/source'

function LocalModeNotice({ title }: { title: string }) {
  return (
    <div className="mt-10 max-w-3xl nw-empty-state">
      <span className="nw-kicker">Local mode</span>
      <h1 className="mt-4 text-3xl font-semibold">{title} isn&apos;t available in local mode</h1>
      <p className="mb-4 mt-3 text-base leading-7 nw-muted">
        This dashboard is running as a standalone collector. Account settings, billing, and API-key management only apply when connected to a hosted NetWatch Cloud backend.
      </p>
      <p className="text-sm nw-muted">
        Your local API key lives in <code className="rounded bg-black/30 px-1">~/.netwatch-dashboard/config.json</code> (or the <code className="rounded bg-black/30 px-1">NETWATCH_DASHBOARD_API_KEY</code> env var).
      </p>
    </div>
  )
}

export default function SettingsPage() {
  if (SOURCE_KIND === 'local') return <LocalModeNotice title="Settings" />
  return <HostedSettingsPage />
}

function HostedSettingsPage() {
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackWebhookDirty, setSlackWebhookDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!token) { router.push('/login'); return }
    loadData()
  }, [authLoading, token, router])

  async function loadData() {
    try {
      const [keysData, accountData] = await Promise.all([getApiKeys(), getAccount()])
      setKeys(keysData)
      setAccount(accountData)
      setNotifyEmail(accountData.notify_email)
      setSlackWebhook('')
      setSlackWebhookDirty(false)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    try {
      const result = await createApiKey()
      setNewKey(result.api_key)
      loadData()
    } catch {
      // handled
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Revoke this API key? Agents using it will stop sending data.')) return
    try {
      await deleteApiKey(id)
      loadData()
    } catch {
      // handled
    }
  }

  async function handleSaveNotifications() {
    setSaving(true)
    setSaved(false)
    try {
      const update: { notify_email?: boolean; slack_webhook?: string } = {
        notify_email: notifyEmail,
      }

      if (slackWebhookDirty) {
        update.slack_webhook = slackWebhook
      }

      await updateAccount(update)
      await loadData()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // handled
    } finally {
      setSaving(false)
    }
  }

  const slackWebhookWillBeRemoved = Boolean(account?.has_slack_webhook) && slackWebhookDirty && slackWebhook.trim() === ''

  if (authLoading || loading) return <div className="mt-10 nw-muted">Loading settings...</div>

  return (
    <div className="space-y-8">
      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="nw-kicker">Workspace settings</span>
            <div>
              <h1 className="nw-section-title">Shape access and notifications from one control surface.</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 nw-muted">
                Keep the account tidy, hand out installation credentials safely, and tune how the platform reaches you when conditions change.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[430px]">
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Plan</div>
              <div className="mt-2 text-2xl font-semibold">Free</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">API keys</div>
              <div className="mt-2 text-2xl font-semibold">{keys.length}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Alerts</div>
              <div className="mt-2 text-2xl font-semibold">{notifyEmail || account?.has_slack_webhook ? 'On' : 'Off'}</div>
            </div>
          </div>
        </div>
      </section>

      {account && (
        <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Account</p>
                <h2 className="mt-2 text-2xl font-semibold">{account.email}</h2>
                <p className="mt-2 text-sm nw-muted">Member since {new Date(account.created_at).toLocaleDateString()}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[rgba(61,214,198,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#bffff8]">
                  Free
                </span>
              </div>
              <p className="text-sm nw-muted">
                Up to 10 hosts · 7-day retention · Email and Slack alerts · Free while we grow.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-5 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Notifications</p>
          <h2 className="text-2xl font-semibold">Tune the signal</h2>
          <p className="text-sm leading-7 nw-muted">Keep operators informed without leaking credentials or creating noisy workflows.</p>
        </div>
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 rounded-[1.1rem] border border-white/7 bg-white/[0.02] px-4 py-4">
            <div>
              <div className="text-sm font-medium">Email alerts</div>
              <div className="mt-1 text-sm nw-muted">Receive incident notifications in your inbox.</div>
            </div>
            <button
              onClick={() => setNotifyEmail(!notifyEmail)}
              className={`relative h-6 w-12 rounded-full transition-colors ${notifyEmail ? 'bg-[var(--nw-accent)]' : 'bg-white/10'}`}
              type="button"
            >
              <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${notifyEmail ? 'translate-x-6' : ''}`} />
            </button>
          </label>

          <div>
            <label className="mb-2 block text-sm font-medium">Slack webhook URL</label>
            <p className="mb-2 text-sm nw-muted">
              {account?.has_slack_webhook && !slackWebhookDirty
                ? 'A webhook is already stored. Leave the field blank to keep it, or paste a new URL to replace it.'
                : 'Route alerts into a Slack channel for faster operational response.'}
            </p>
            {account?.has_slack_webhook && !slackWebhookDirty && (
              <p className="mb-2 text-sm text-[var(--nw-accent)]">Slack webhook configured.</p>
            )}
            {slackWebhookWillBeRemoved && (
              <p className="mb-2 text-sm text-orange-300">The saved Slack webhook will be removed when you save.</p>
            )}
            <input
              type="url"
              value={slackWebhook}
              onChange={e => {
                setSlackWebhook(e.target.value)
                setSlackWebhookDirty(true)
              }}
              placeholder={account?.has_slack_webhook ? 'Paste a replacement Slack webhook URL' : 'https://hooks.slack.com/services/...'}
              className="nw-input"
            />
            {account?.has_slack_webhook && (
              <button
                type="button"
                onClick={() => {
                  setSlackWebhook('')
                  setSlackWebhookDirty(true)
                }}
                className="mt-3 text-sm font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]"
              >
                Remove saved Slack webhook
              </button>
            )}
          </div>

          <button onClick={handleSaveNotifications} disabled={saving} className="nw-button-primary disabled:opacity-50">
            {saving ? 'Saving changes...' : saved ? 'Saved' : 'Save notification settings'}
          </button>
        </div>
      </section>

      <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">API keys</p>
            <h2 className="text-2xl font-semibold">Provision agents safely</h2>
            <p className="text-sm leading-7 nw-muted">Each installation should get a clear credential and a simple revoke path.</p>
          </div>
          <button onClick={handleCreate} className="nw-button-primary">
            Create new API key
          </button>
        </div>

        {newKey && (
          <div className="mb-5 rounded-[1.25rem] border border-[rgba(61,214,198,0.2)] bg-[rgba(61,214,198,0.08)] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[#bffff8]">New API key created — this is the only time it will be shown.</p>
            <div className="mt-3 nw-command break-all text-sm">{newKey}</div>
            <p className="mb-2 mt-4 text-sm nw-muted">Ready-to-paste install command</p>
            <div className="nw-command break-all text-xs">
              curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --api-key {newKey} --endpoint https://netwatch-api-production.up.railway.app/api/v1/ingest
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => navigator.clipboard.writeText(`curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --api-key ${newKey} --endpoint https://netwatch-api-production.up.railway.app/api/v1/ingest`)} className="nw-button-secondary">
                Copy install command
              </button>
              <button onClick={() => navigator.clipboard.writeText(newKey)} className="nw-button-ghost">
                Copy key only
              </button>
              <button onClick={() => setNewKey(null)} className="nw-button-ghost">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {keys.map(key => (
            <div key={key.id} className="nw-card-soft rounded-[1.2rem] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-mono text-sm text-[var(--nw-text)]">{key.key_prefix}...</div>
                  {key.label && <div className="mt-1 text-sm nw-muted">{key.label}</div>}
                  <div className="mt-1 text-xs nw-subtle">
                    Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                  </div>
                </div>
                <button onClick={() => handleDelete(key.id)} className="nw-button-ghost text-xs">
                  Revoke
                </button>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <div className="nw-empty-state">
              <h3 className="text-lg font-semibold">No API keys yet</h3>
              <p className="mt-2 text-sm leading-7 nw-muted">Create one to install the first agent and bring your fleet into the dashboard.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="mb-4 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Install agent</p>
            <h2 className="text-2xl font-semibold">One command, predictable rollout</h2>
          </div>
          <p className="mb-3 text-sm leading-7 nw-muted">
            Create an API key above and use the command below if you want a generic install template instead of a pre-filled one.
          </p>
          <div className="nw-command break-all text-xs">
            curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --api-key <span className="text-[var(--nw-warm)]">YOUR_API_KEY</span> --endpoint https://netwatch-api-production.up.railway.app/api/v1/ingest
          </div>
        </section>

        <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="mb-4 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Runbook snippets</p>
            <h2 className="text-2xl font-semibold">Useful operator commands</h2>
          </div>
          <div className="nw-command space-y-1 text-xs">
            <div><span className="text-[var(--nw-text-soft)]"># Check status</span></div>
            <div>netwatch-agent status</div>
            <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># View config</span></div>
            <div>netwatch-agent config</div>
            <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># Update to latest version</span></div>
            <div>sudo netwatch-agent update</div>
            <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># View logs</span></div>
            <div>journalctl -u netwatch-agent -f</div>
            <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># Remove agent</span></div>
            <div>curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --remove</div>
          </div>
        </section>
      </div>
    </div>
  )
}
