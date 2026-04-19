# netwatch-dashboard

The open-source web UI for [NetWatch Cloud](https://netwatch.io). A Next.js 16 app that renders metrics collected by [`netwatch-agent`](https://github.com/matthart1983/netwatch-agent) and served by the NetWatch Cloud hosted backend.

## What you get

Host dashboard with:
- **Live stats bar** — CPU, memory, load, disk, network rate, connection count
- **Time-series charts** — latency/loss, network & connections, CPU (total + per-core), memory, load, disk, TCP state counts. 1h/6h/24h/72h ranges. Drag to reorder, collapse, maximize.
- **Agent-detected alerts** — bandwidth threshold, port scan, beaconing, DNS tunnel detectors from the agent's NetworkIntel collector
- **Top processes** — per-process bandwidth attribution table
- **Active connections** — TCP/UDP socket table with kernel-measured RTT
- **DNS activity** — query totals, latency histogram, top domains, NXDOMAIN count

Plus account management, API keys, alert rules, and admin pages.

## Run it locally

### 1. Install deps

```sh
npm install
```

### 2. Configure the API endpoint

Create `.env.local`:

```sh
NEXT_PUBLIC_API_URL=https://netwatch-api-production.up.railway.app
```

For local development against a self-hosted backend, set this to `http://localhost:3001` instead.

### 3. Start the dev server

```sh
npm run dev
```

Open http://localhost:3000.

## Build for production

```sh
npm run build
npm start
```

## Relationship to other NetWatch projects

This dashboard talks to the **proprietary NetWatch Cloud backend** (closed source). You can fork and modify this UI freely, but it's only useful pointed at a real NetWatch Cloud account — it has no backend of its own. If you want a self-hosted single-machine experience, try [`netwatch`](https://github.com/matthart1983/netwatch), the standalone TUI.

```
┌───────────────────────────┐       ┌─────────────────────────┐
│ netwatch-dashboard (you)  │──────▶│ NetWatch Cloud backend  │
│ Next.js in your browser   │  HTTPS│ (closed source, hosted) │
└───────────────────────────┘       └──────────┬──────────────┘
                                               │
                                               │ receives snapshots from
                                               ▼
                                    ┌─────────────────────────┐
                                    │ netwatch-agent          │
                                    │ running on your hosts   │
                                    └─────────────────────────┘
```

- [**netwatch-sdk**](https://github.com/matthart1983/netwatch-sdk) — shared Rust types + collectors (the wire format this dashboard's data travels in).
- [**netwatch-agent**](https://github.com/matthart1983/netwatch-agent) — collects metrics on your hosts.
- [**netwatch**](https://github.com/matthart1983/netwatch) — unrelated single-host TUI, no network required.

## License

MIT © 2025-2026 Matt Hartley
