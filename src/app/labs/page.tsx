import Link from 'next/link'
import type { Metadata } from 'next'
import { posts, formatDate } from '@/lib/posts'

export const metadata: Metadata = {
  title: 'NetWatch Labs',
  description:
    'Open-source tools for infrastructure teams. Network monitoring, fleet SSH management, and more — built with Rust.',
}

const tools = [
  {
    monogram: 'NW',
    name: 'netwatch',
    tagline: 'Real-time network diagnostics in your terminal',
    description:
      'A zero-config TUI network analyzer for Linux. Interface bandwidth, gateway latency, packet loss, DNS latency, and connection count — one binary, no root, instant visibility.',
    version: 'v0.10.0',
    language: 'Rust',
    stars: '700+',
    links: [
      { label: 'GitHub', href: 'https://github.com/matthart1983/netwatch' },
      {
        label: 'Homebrew',
        href: 'https://github.com/matthart1983/netwatch',
        mono: 'brew install matthart1983/tap/netwatch',
      },
    ],
    badges: ['TUI', 'Linux', 'MIT'],
    accentClass: 'text-[var(--nw-accent)]',
    glowClass: 'shadow-[0_0_40px_rgba(61,214,198,0.12)]',
    monogramBg: 'bg-[rgba(61,214,198,0.12)] border-[rgba(61,214,198,0.25)]',
  },
  {
    monogram: 'NS',
    name: 'netscan',
    tagline: 'Continuous attack surface monitor — a TUI workflow for nmap',
    description:
      'A TUI workflow layer on top of the nmap engine. Target inventory, saved scan profiles, live streaming results, SQLite-backed scan history with automatic differential scanning, incident bundle export, pause/resume, and opt-in AI triage via local or remote Ollama.',
    version: 'v0.1.0',
    language: 'Rust',
    stars: 'new',
    links: [
      { label: 'GitHub', href: 'https://github.com/matthart1983/netscan' },
    ],
    badges: ['TUI', 'Security', 'MIT'],
    accentClass: 'text-[#f5b64d]',
    glowClass: 'shadow-[0_0_40px_rgba(245,182,77,0.12)]',
    monogramBg: 'bg-[rgba(245,182,77,0.1)] border-[rgba(245,182,77,0.22)]',
  },
  {
    monogram: 'ES',
    name: 'essh',
    tagline: 'An enhanced SSH client for server fleets',
    description:
      'A TUI SSH client with concurrent sessions, per-connection host diagnostics, file transfer, port forwarding, and fleet management — built with russh in pure Rust.',
    version: 'v0.2.7',
    language: 'Rust',
    stars: '37',
    links: [
      { label: 'GitHub', href: 'https://github.com/matthart1983/essh' },
    ],
    badges: ['TUI', 'SSH', 'MIT'],
    accentClass: 'text-[#7eb8ff]',
    glowClass: 'shadow-[0_0_40px_rgba(126,184,255,0.1)]',
    monogramBg: 'bg-[rgba(126,184,255,0.1)] border-[rgba(126,184,255,0.22)]',
  },
]

function LabsNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08111a]/78 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(61,214,198,0.25)] bg-[rgba(61,214,198,0.12)] text-xs font-bold text-[var(--nw-text)]">
              NW
            </div>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="nw-kicker py-1 text-[0.65rem]">Labs</span>
        </div>

        <div className="hidden items-center gap-6 sm:flex">
          <a href="#tools" className="text-sm nw-muted hover:text-[var(--nw-text)] transition-colors">Tools</a>
          <a href="#writing" className="text-sm nw-muted hover:text-[var(--nw-text)] transition-colors">Writing</a>
          <Link href="/" className="text-sm nw-muted hover:text-[var(--nw-text)] transition-colors">← Home</Link>
        </div>

        <div className="flex sm:hidden">
          <Link href="/" className="text-sm nw-muted hover:text-[var(--nw-text)] transition-colors">← Home</Link>
        </div>
      </div>
    </nav>
  )
}

export default function LabsPage() {
  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
      <LabsNav />

      {/* Hero */}
      <section className="mx-auto max-w-[1320px] px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <div className="nw-kicker mb-5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--nw-accent)]" />
          Open Source
        </div>
        <h1 className="text-5xl font-semibold tracking-[-0.05em] text-[var(--nw-text)] sm:text-6xl">
          NetWatch Labs
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 nw-muted">
          Tools for infrastructure teams who live in the terminal.
          Built with Rust, designed for clarity, released as open source.
        </p>
      </section>

      {/* Tools */}
      <section id="tools" className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--nw-text)]">Tools</h2>
          <span className="text-sm nw-subtle">{tools.length} projects</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {tools.map(tool => (
            <div
              key={tool.name}
              className={`nw-card rounded-[1.5rem] p-7 ${tool.glowClass} transition-shadow hover:shadow-[0_0_60px_rgba(61,214,198,0.16)]`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-bold text-[var(--nw-text)] ${tool.monogramBg}`}
                  >
                    {tool.monogram}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-xl font-semibold tracking-tight ${tool.accentClass}`}>
                        {tool.name}
                      </h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[0.68rem] nw-subtle">
                        {tool.version}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm nw-muted">{tool.tagline}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-semibold text-[var(--nw-text)]">{tool.stars}</div>
                  <div className="text-xs nw-subtle">stars</div>
                </div>
              </div>

              {/* Description */}
              <p className="mt-5 text-sm leading-7 nw-muted">
                {tool.description}
              </p>

              {/* Badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[rgba(61,214,198,0.18)] bg-[rgba(61,214,198,0.07)] px-2.5 py-0.5 text-xs font-medium text-[#7eeee7]">
                  {tool.language}
                </span>
                {tool.badges.map(b => (
                  <span
                    key={b}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs nw-subtle"
                  >
                    {b}
                  </span>
                ))}
              </div>

              {/* Links */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/6 pt-5">
                {tool.links.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nw-button-ghost px-4 py-2 text-sm"
                  >
                    {link.label} ↗
                  </a>
                ))}
                {tool.links[0]?.mono && (
                  <code className="ml-auto hidden font-mono text-xs nw-subtle lg:block">
                    {tool.links[0].mono}
                  </code>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Writing */}
      <section id="writing" className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--nw-text)]">Writing</h2>
          <span className="text-sm nw-subtle">{posts.length} posts</span>
        </div>

        <div className="space-y-4">
          {posts.map(post => (
            <Link
              key={post.slug}
              href={`/labs/blog/${post.slug}`}
              className="nw-card-hover group flex flex-col gap-3 rounded-[1.35rem] p-6 sm:flex-row sm:items-start sm:gap-6"
            >
              <div className="shrink-0 pt-0.5 font-mono text-xs nw-subtle sm:w-28">
                {formatDate(post.date)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--nw-text)] group-hover:text-[var(--nw-accent)] transition-colors">
                  {post.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 nw-muted line-clamp-2">{post.excerpt}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs nw-subtle">{post.readTime}</span>
                  <span className="text-white/10">·</span>
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.68rem] nw-subtle"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 self-center text-[var(--nw-text-soft)] group-hover:text-[var(--nw-accent)] transition-colors">
                →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* NetWatch Cloud teaser */}
      <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="nw-card rounded-[1.5rem] p-8 text-center">
          <div className="nw-kicker mx-auto mb-5 w-fit">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            In development
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--nw-text)]">
            NetWatch Cloud is coming
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base leading-7 nw-muted">
            Persistent metric history, alerting, and a fleet dashboard for Linux infrastructure —
            powered by the same lightweight Rust agent. No Datadog sprawl.
          </p>
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-semibold text-[var(--nw-text)]">~5 MB</div>
              <div className="mt-0.5 text-xs nw-subtle">agent binary</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[var(--nw-text)]">15s</div>
              <div className="mt-0.5 text-xs nw-subtle">metric interval</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[var(--nw-text)]">zero YAML</div>
              <div className="mt-0.5 text-xs nw-subtle">config required</div>
            </div>
          </div>
          <p className="mt-6 text-sm nw-subtle">
            Built at{' '}
            <Link href="/" className="text-[var(--nw-accent)] hover:underline underline-offset-2">
              netwatchlabs.com
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/6 px-4 py-8 text-center">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="text-xs nw-subtle">
            NetWatch Labs — tools for infrastructure teams
          </div>
          <div className="flex items-center gap-5 text-xs nw-subtle">
            <a
              href="https://github.com/matthart1983/netwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--nw-text)] transition-colors"
            >
              netwatch ↗
            </a>
            <a
              href="https://github.com/matthart1983/essh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--nw-text)] transition-colors"
            >
              essh ↗
            </a>
            <Link href="/" className="hover:text-[var(--nw-text)] transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
