# netwatch-dashboard

Self-hosted web dashboard for [NetWatch](https://github.com/matthart1983/netwatch) host metrics. A Next.js 16 app that can run in one of two modes:

- **Standalone (default)** — bundles its own collector API and SQLite storage. `docker run` it, point [`netwatch-agent`](https://github.com/matthart1983/netwatch-agent) at it, and you have fleet monitoring in one process. No external backend required.
- **Hosted** — points at a [NetWatch Cloud](https://netwatchlabs.com) account and renders data served by the managed SaaS backend.

## What you get

- **Fleet overview** — online/offline status, per-host CPU/memory/disk/load summary with sparkline charts.
- **Host detail** — time-series panels for latency/loss, network throughput + connection count, CPU (total + per-core), memory, load, disk, TCP state counters. 1h/6h/24h/72h ranges, drag-to-reorder, collapse, maximize.
- **Alert rules + history** — numeric thresholds on any metric the agent ships, evaluated on every ingest. Firing/resolved events with timestamps.
- **Agent-detected alerts** — port scans, beaconing, DNS tunneling, bandwidth spikes (from the agent's NetworkIntel collector).
- **Top processes** — per-process bandwidth attribution.
- **Active connections** — TCP/UDP socket table with kernel-measured RTT (Linux).
- **DNS activity** — query totals, latency histogram, top domains, NXDOMAIN counts.

## Quick start — standalone mode

### Docker (recommended)

```sh
docker build -t netwatch-dashboard .
docker run -d --name netwatch-dashboard \
  -p 3000:3000 \
  -v netwatch-data:/data \
  netwatch-dashboard
```

On first start the container writes a fresh API key to `/data/config.json` and logs it. Grab it:

```sh
docker logs netwatch-dashboard | grep 'API key'
# [netwatch-dashboard] generated API key — point agents at /api/v1/ingest with Bearer ndk_...
```

Then point an agent at the dashboard:

```sh
NETWATCH_API_KEY=ndk_... \
NETWATCH_ENDPOINT=http://localhost:3000/api/v1/ingest \
netwatch-agent
```

Open http://localhost:3000 — the empty state shows the ingest URL + API key until the first snapshot arrives.

### From source

```sh
npm install
npm run dev
```

`NEXT_PUBLIC_NETWATCH_SOURCE=local` is the default. The dashboard serves `/api/v1/ingest` itself and writes to SQLite in `~/.netwatch-dashboard/` (override with `NETWATCH_DASHBOARD_DATA_DIR`).

### Provide your own API key

Instead of auto-generating, set `NETWATCH_DASHBOARD_API_KEY`:

```sh
docker run -e NETWATCH_DASHBOARD_API_KEY=my-secret-key ...
```

## Hosted mode

If you already have a NetWatch Cloud account, point the dashboard at it instead:

```sh
# .env.local
NEXT_PUBLIC_NETWATCH_SOURCE=core
NEXT_PUBLIC_NETWATCH_CORE_URL=https://netwatch-api-production.up.railway.app
```

In hosted mode the dashboard surfaces login, registration, account settings, billing, and admin screens — all gated behind the cloud backend's authentication. In standalone mode those routes redirect to `/` (they'd have nothing to talk to).

## Architecture

```
                  ┌───────────────────────────────┐
                  │      netwatch-dashboard       │
                  │  ┌─────────────────────────┐  │
 ┌────────────┐   │  │  Next.js UI             │  │
 │  agent(s)  │──▶│  │  + bundled collector    │──┼─▶ SQLite
 └────────────┘   │  │  + alert evaluator      │  │
                  │  └─────────────────────────┘  │
                  └───────────────────────────────┘
                       ^ standalone mode (default)

                  ┌───────────────────────────────┐
 ┌────────────┐   │       Next.js UI only         │
 │  browser   │──▶│       (no collector)          │──┐
 └────────────┘   └───────────────────────────────┘  │ HTTPS
                                                     ▼
                                     ┌─────────────────────────┐
 ┌────────────┐   HTTPS              │  NetWatch Cloud backend │
 │  agent(s)  │─────────────────────▶│  (Rust, hosted)         │
 └────────────┘                      └─────────────────────────┘
                       ^ hosted mode
```

The **ingest contract is the same shape** in both modes — agents are interchangeable.

## Build for production

```sh
npm run build
npm start
```

## Configuration reference

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_NETWATCH_SOURCE` | `local` | `local` or `core` |
| `NEXT_PUBLIC_NETWATCH_CORE_URL` | `http://localhost:3001` | Only used when `SOURCE=core` |
| `NETWATCH_DASHBOARD_API_KEY` | *(auto-generated)* | Bearer token agents must present |
| `NETWATCH_DASHBOARD_DATA_DIR` | `~/.netwatch-dashboard` (host) / `/data` (container) | SQLite + config location |
| `PORT` | `3000` | HTTP listen port |

## Related projects

- [**netwatch**](https://github.com/matthart1983/netwatch) — standalone TUI, single host, no network.
- [**netwatch-agent**](https://github.com/matthart1983/netwatch-agent) — the collector agent that ships snapshots to either the standalone dashboard or the hosted backend.
- [**netwatch-sdk**](https://github.com/matthart1983/netwatch-sdk) — Rust types + wire format (what agents send).

## License

MIT © 2025-2026 Matt Hartley
