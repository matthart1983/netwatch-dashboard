export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  readTime: string
  tags: string[]
  content: string
}

export const posts: BlogPost[] = [
  {
    slug: 'velocitas-fix-engine-benchmarks',
    title: 'Velocitas vs Artio vs QuickFIX/J: A Three-Way Latency Shootout on a Realistic Trading Topology',
    date: '2026-04-11',
    excerpt:
      'Most FIX engine benchmarks measure parse() in a tight loop and call it a day. I built the real pipeline — TCP in, Aeron IPC, executor, Aeron back, TCP out — three times, in Rust (Velocitas), Java (Artio), and Java (QuickFIX/J). Five runs each. Here is what happened.',
    readTime: '14 min read',
    tags: ['rust', 'fix', 'performance', 'hft'],
    content: `
<p>Most FIX engine benchmarks lie. They measure <code>parse(bytes) → Message</code> in a tight loop and call it a day — no network, no IPC, no executor, no back-pressure. That tells you almost nothing about how the engine performs inside a real trading system, where a message has to cross TCP from a venue, get normalized, hand off to an execution engine over a shared-memory ringbuffer, come back, and be serialized back out to the wire.</p>

<p>So I built the real thing — three times. Once in Rust using the <a href="https://github.com/matthart1983/velocitas-fix-engine" target="_blank" rel="noopener noreferrer">Velocitas FIX engine</a>. Once in Java using <a href="https://www.quickfixj.org/" target="_blank" rel="noopener noreferrer">QuickFIX/J</a>, the de-facto open-source Java FIX engine. And once using <a href="https://github.com/real-logic/artio" target="_blank" rel="noopener noreferrer">Artio</a>, Real Logic's Aeron-native FIX engine built by the same team behind <a href="https://github.com/real-logic/aeron" target="_blank" rel="noopener noreferrer">Aeron</a> itself. Same topology, same pipeline, same workload, five runs each. Here's what happened.</p>

<h2>The topology</h2>

<pre><code>Venue (FIX initiator)
  ⇄ TCP (localhost)
Gateway (FIX acceptor)
  ⇄ Aeron IPC
Executor</code></pre>

<p>Three components, two transports, three threads per engine. The venue connects to the gateway over real TCP, logs on, and starts sending <code>NewOrderSingle</code> messages. The gateway parses each order, extracts the fields that matter, encodes them into a compact internal binary format, and publishes them to the executor over Aeron — the same shared-memory messaging library used by LMAX, Adaptive, and most modern HFT stacks. The executor decodes the order, encodes a filled <code>ExecutionReport</code> back, and publishes it over a second Aeron stream. The gateway decodes it, builds the FIX ExecRpt, and sends it back over TCP. The venue records the round-trip.</p>

<p><strong>Nine steps are timed on every iteration:</strong></p>

<ul>
<li>Venue serializes FIX NOS → writes to TCP</li>
<li>Gateway parses FIX NOS</li>
<li>Gateway extracts fields → encodes internal binary order</li>
<li>Aeron IPC publish (gateway → executor)</li>
<li>Executor decodes order</li>
<li>Executor encodes ExecutionReport</li>
<li>Aeron IPC publish (executor → gateway)</li>
<li>Gateway decodes ExecutionReport</li>
<li>Gateway builds FIX ExecRpt → writes to TCP → venue</li>
</ul>

<p>This is representative of what an order gateway actually does in production. The only things missing are a real network hop and a real matching engine — and those would add latency on all three sides equally.</p>

<h2>Ground rules for a fair fight</h2>

<p>Benchmarks are easy to rig. I took this seriously:</p>

<ul>
<li><strong>Identical logical pipelines</strong> on all three engines. Same nine steps, same order.</li>
<li><strong>Identical workload</strong>: 10,000 warmup round-trips (discarded) + 100,000 measured, × 5 runs. Same <code>NewOrderSingle</code>, same reply shape.</li>
<li><strong>Zero per-iteration allocations on the hot path.</strong> All three versions pre-allocate buffers, reuse scratch space, and avoid heap churn. Getting Artio there took real work — see below.</li>
<li><strong>Same Aeron library</strong> (1.50.4) on both Java engines.</li>
<li><strong>Same JVM tuning.</strong> <code>-server -XX:+UseG1GC</code>, 512 MB heap for QFJ, 1 GB for Artio (because it runs an embedded Archive). Both with the required <code>--add-opens</code> flags.</li>
<li><strong>Artio with validation disabled</strong> (<code>-Dfix.codecs.no_validation=true</code>) and Agrona bounds checks off (<code>-Dagrona.disable.bounds.checks=true</code>). That's how you'd run it in production.</li>
<li><strong>Busy-spin on receives.</strong> All three tightly poll the Aeron subscriptions. The Rust version has a three-phase idle strategy (busy-spin → <code>yield_now</code> → 10 µs sleep) to avoid pegging the CPU forever; Java uses pure busy-spin.</li>
</ul>

<h3>The Artio tuning story</h3>

<p>My first Artio run was <strong>slower than QuickFIX/J</strong> — p99.9 of 4.2 ms, max of 43 ms. That's not Artio being bad; it's me being sloppy. The hot path had <code>new String(bytes, UTF_8)</code> in the gateway frame decode, <code>String.format("%08d", seq)</code> in the venue's <code>sendNos</code>, and validation was on. Five hundred thousand short-lived Strings per run is enough to trigger young-gen collections during the measured window. Fixing it:</p>

<ul>
<li>Pre-allocated byte scratches, in-place ASCII encoding of the sequence counter.</li>
<li>Swapped the <code>session-codecs</code> encoders to the <code>byte[], int, int</code> overloads instead of the String/CharSequence ones.</li>
<li>Disabled codec validation and Agrona bounds checks.</li>
<li><code>ThreadingMode.DEDICATED</code> for the media driver and archive — SHARED mode multiplexed everything onto one agent thread that was fighting the library poll thread for CPU.</li>
</ul>

<p>That got Artio's p99.9 from 4,231 µs to 189 µs — a <strong>22× tail improvement</strong> — and the mean from 131 µs to 83 µs. The first run wasn't measuring Artio; it was measuring my allocation mistakes. This is why benchmarking Java engines is annoying: the GC is a latent variable that punishes anyone who doesn't audit every method on the hot path.</p>

<h2>Results (5 runs each, median across runs)</h2>

<p>100,000 measured round-trips × 5 runs, same hardware, same session:</p>

<div class="nw-table-wrap">
<table>
<thead>
<tr><th>Metric</th><th class="num">Velocitas (Rust)</th><th class="num">Artio (Java)</th><th class="num">QuickFIX/J (Java)</th></tr>
</thead>
<tbody>
<tr><td>min</td><td class="num"><strong>11.7 µs</strong></td><td class="num">36.9 µs</td><td class="num">37.0 µs</td></tr>
<tr><td>p50</td><td class="num"><strong>20.1 µs</strong></td><td class="num">78.5 µs</td><td class="num">50.6 µs</td></tr>
<tr><td>mean</td><td class="num"><strong>23.6 µs</strong></td><td class="num">83.3 µs</td><td class="num">54.7 µs</td></tr>
<tr><td>p90</td><td class="num"><strong>31.1 µs</strong></td><td class="num">108.8 µs</td><td class="num">60.9 µs</td></tr>
<tr><td>p99</td><td class="num"><strong>82.5 µs</strong></td><td class="num">142.5 µs</td><td class="num">157.5 µs</td></tr>
<tr><td>p99.9</td><td class="num"><strong>113.6 µs</strong></td><td class="num">180.5 µs</td><td class="num">221.2 µs</td></tr>
<tr><td>max</td><td class="num">4,448 µs</td><td class="num"><strong>940 µs</strong></td><td class="num">4,218 µs</td></tr>
<tr><td>Throughput</td><td class="num"><strong>41,720 RT/s</strong></td><td class="num">11,986 RT/s</td><td class="num">17,887 RT/s</td></tr>
</tbody>
</table>
</div>

<p><strong>Rust wins p50, p99, p99.9, and throughput — everything except worst-case <code>max</code>, where Artio takes the crown.</strong> Rust is 2.5× faster than QuickFIX/J at median and 3.9× faster than Artio. At p99.9 it's 1.9× faster than QFJ and 1.6× faster than Artio. Throughput: 2.3× over QFJ, 3.5× over Artio.</p>

<h3>The Artio story is more interesting than the win</h3>

<p>Look at that <code>max</code> row. Artio's worst-case single round-trip (940 µs median across runs) is <strong>4.5× better than QuickFIX/J and 4.7× better than Rust</strong>. That's not noise — Artio was consistently better at worst-case across all 5 runs (min run 624 µs, max run 2,201 µs).</p>

<p>But at p50 Artio is 1.6× <em>slower</em> than QuickFIX/J. What's going on?</p>

<p>Artio's architecture splits the FIX engine into two pieces: a <code>FixEngine</code> that owns the TCP connections and runs on its own agent thread, and a <code>FixLibrary</code> that your application code runs on. They communicate via an internal Aeron publication. Every outbound message does <code>library → Aeron → engine → TCP</code>, and every inbound message does <code>TCP → engine → Aeron → library</code>. That's <strong>two extra Aeron hops per direction</strong> compared to QuickFIX/J, which writes to TCP directly from the application thread.</p>

<p>On localhost those hops are pure overhead — ~30 µs of extra latency at p50. But they buy you something: the engine/library split means the GC-heavy application code can allocate freely without affecting the I/O path. That's why Artio's tail is so smooth. When something does go wrong, it goes wrong in the library thread, not the engine thread that's actively reading the socket. The engine keeps the wire hot even if the library stutters.</p>

<p><strong>This is a real architectural trade-off, not a bug.</strong> In production with network latency dominating, the ~30 µs Aeron cost disappears into the noise and Artio's cleaner tail is the only thing you feel. In a localhost microbenchmark like this one, the cost is visible and Artio looks slower at the median. In a multi-session deployment with hundreds of concurrent sessions, the fixed cost amortizes and Artio pulls ahead of QuickFIX/J on total throughput.</p>

<p>QuickFIX/J is the opposite: simple and direct (the session is the thread, writes go straight to TCP), which wins at median, but every message parse creates a <code>Message</code> object graph that the GC eventually has to clean up. That's why QFJ's <code>max</code> is 4 ms — somewhere in the measured window a young-gen collection happened.</p>

<p><strong>Velocitas Rust avoids both problems.</strong> No engine/library split, so no fixed IPC tax at median. No GC, so no worst-case cleanup pause. Just a tight hot path that allocates nothing after startup.</p>

<h2>Run-to-run variance</h2>

<p>One run is a data point. Five runs tell you whether the data point was real.</p>

<div class="nw-table-wrap">
<table>
<thead>
<tr><th>Engine</th><th class="num">p50 (min–median–max)</th><th class="num">p99 (min–median–max)</th><th class="num">tput (min–median–max)</th></tr>
</thead>
<tbody>
<tr><td>Rust</td><td class="num">19.7 – <strong>20.1</strong> – 23.1</td><td class="num">79.3 – <strong>82.5</strong> – 101.8</td><td class="num">29,424 – <strong>41,720</strong> – 44,228</td></tr>
<tr><td>QFJ</td><td class="num">50.5 – <strong>50.6</strong> – 50.9</td><td class="num">156.5 – <strong>157.5</strong> – 177.6</td><td class="num">16,913 – <strong>17,887</strong> – 17,900</td></tr>
<tr><td>Artio</td><td class="num">76.8 – <strong>78.5</strong> – 80.3</td><td class="num">139.4 – <strong>142.5</strong> – 169.8</td><td class="num">11,480 – <strong>11,986</strong> – 12,275</td></tr>
</tbody>
</table>
</div>

<ul>
<li><strong>QuickFIX/J is the most consistent</strong>: p50 spread of 0.4 µs across 5 runs. Once the JIT warms up, it does the same thing every time.</li>
<li><strong>Artio is consistent at median</strong> but had one p99.9 outlier run (468 µs vs the usual ~180 µs) — a young-gen GC that caught the tail of the measured window.</li>
<li><strong>Rust is the most variable.</strong> One run (run 4) showed clear system noise interference: p50 jumped from 20 to 23, p90 from 28 to 67. Busy-spin loops are sensitive to scheduler hiccups — the macOS scheduler happened to preempt the gateway thread at a bad moment. The other 4 runs are tight: p50 19.7–20.5, p99 79–94.</li>
</ul>

<p><strong>Even using Rust's <em>worst</em> run against Artio/QFJ <em>best</em> runs, Rust still wins p50 by 2×+.</strong> The comparison holds under noise.</p>

<h2>Why Rust wins</h2>

<p>The usual "Rust is faster than Java" story is about JIT warmup, GC pauses, and bounds checks. That's all true but the specifics matter:</p>

<p><strong>1. No GC means no worst-case pauses — except the tail.</strong> Rust's <code>max</code> is worse than Artio's because of macOS scheduler jitter on busy-spin threads, not GC. Artio's <code>max</code> is better because its engine/library split isolates I/O from allocation. Pick your poison: scheduler noise or GC noise. Velocitas wins everywhere except the single worst sample.</p>

<p><strong>2. FIX parsing cost.</strong> QuickFIX/J parses into a full <code>Message</code> object graph even with validation off. Artio parses into a zero-copy decoder wrapping an <code>AsciiBuffer</code>. Velocitas parses into a zero-copy <code>MessageView</code> that hands out <code>&amp;[u8]</code> slices on demand. Decoder-to-decoder, Velocitas and Artio are close. But QuickFIX/J is carrying object-construction overhead on every message.</p>

<p><strong>3. No virtual dispatch on the hot path.</strong> <code>FixApp</code> in Velocitas is a <code>&amp;mut dyn</code> trait object called once per message. Artio's <code>SessionHandler.onMessage</code> is also once per message. QFJ's <code>MessageCracker</code> does a HashMap lookup per field.</p>

<p><strong>4. Architecture.</strong> Velocitas writes directly from the caller thread to TCP. QuickFIX/J does the same. Artio goes through Aeron both ways. In this benchmark (localhost, one session) direct wins; in a production multi-session deployment, Aeron pipelining wins.</p>

<p><strong>5. Aeron binding.</strong> Velocitas uses <code>aeron_c</code> (the C driver client) directly over FFI. Both Java engines use the native Agrona/Aeron client. Both are fast, but the Rust FFI path has slightly less overhead per publish.</p>

<p><strong>6. TCP syscall cost is identical</strong> across all three. Both sides do the same <code>write()</code> / <code>read()</code> dance on localhost TCP with <code>TCP_NODELAY</code>. That's the floor — the deltas above are <em>codec and runtime</em> deltas, not transport deltas.</p>

<h2>What this means for you</h2>

<p>If you're building an order gateway, market data normalizer, or any hot-path component in a trading system, the engine you choose compounds every trade you handle:</p>

<ul>
<li><strong>Velocitas (Rust)</strong> if you want the fastest median and p99, don't mind budgeting for occasional scheduler jitter, and want a runtime with no GC to reason about. 2.5× faster than QuickFIX/J at p50, 3.9× faster than Artio at p50, and <strong>p99.9 under 120 µs end-to-end</strong> including TCP on both ends.</li>
<li><strong>Artio (Java)</strong> if you run many concurrent FIX sessions, care about worst-case tail more than median, and have a team that already lives in the JVM ecosystem. The Aeron-based architecture pays off at scale and gives you the smoothest <code>max</code> of the three engines I tested. Just be prepared to audit every allocation on the hot path — Artio is fast but it's not automatic.</li>
<li><strong>QuickFIX/J (Java)</strong> if you want maximum operational simplicity, JIT predictability, and a well-understood engine with twenty years of community history. It's the slowest median of the three, but it's also the most laser-consistent run to run — and "consistent and slightly slower" is often more valuable in production than "fast but variable."</li>
</ul>

<p><strong>Velocitas gives you a 2.5× latency improvement over QuickFIX/J and a 3.9× improvement over Artio on a realistic nine-step pipeline, with no allocations on the hot path, predictable latency, and a p99.9 under 120 µs end-to-end.</strong> That's not a microbenchmark — that's the whole pipeline, including TCP on both ends, across five independent runs of 100,000 round-trips each.</p>

<p>The code for all three benchmarks is public. If you think I've rigged something, <a href="https://github.com/matthart1983/velocitas-fix-engine" target="_blank" rel="noopener noreferrer">clone it and run it</a>. If you find a way to make the Java sides faster, I want to see it — getting Artio down was a 22× tail improvement from allocation fixes alone, and I'd bet there's more to find.</p>

<h2>Reproducing</h2>

<pre><code># Rust
cd velocitas-fix-engine && cargo run --release --bin bench_e2e

# QuickFIX/J
cd velocitas-fix-engine/bench-vs-quickfixj && gradle runE2E

# Artio
cd velocitas-fix-engine/bench-vs-quickfixj && gradle runArtio</code></pre>

<p>Each run takes 5–25 seconds, prints the same format, and uses real TCP + real Aeron. No hand-waving.</p>

<p><em>Velocitas FIX is a Rust FIX 4.4 engine built for ultra-low-latency trading infrastructure. Zero-allocation hot paths, pluggable transports, native SBE and Aeron integration. <a href="https://github.com/matthart1983/velocitas-fix-engine" target="_blank" rel="noopener noreferrer">github.com/matthart1983/velocitas-fix-engine</a></em></p>
`,
  },
  {
    slug: 'zero-to-700-stars-building-netwatch',
    title: 'Zero to 700 Stars: Building a Rust TUI Network Analyzer',
    date: '2026-03-15',
    excerpt:
      'What it actually takes to build a terminal tool people want — and how netwatch grew from a one-day frustration fix to a tool used by 700+ developers worldwide.',
    readTime: '7 min read',
    tags: ['rust', 'tui', 'open-source'],
    content: `
<p>The setup was always the same. You SSH into a server that's behaving strangely, and you immediately hit a wall. <code>top</code> shows CPU is fine. <code>iftop</code> needs root. <code>nethogs</code> shows process names you don't recognize and packet counts in units that don't map to your mental model. There's no clean way to answer the question you actually have: <em>is this server's network healthy right now?</em></p>

<p><code>netwatch</code> started as a personal fix for that. I wanted one binary, no root, no configuration, that could tell me: interface bandwidth, gateway latency, packet loss, DNS latency, connection count. Everything relevant to "can this server reach the world?" — readable in a terminal, refreshing live.</p>

<h2>Building with ratatui</h2>

<p>The Rust TUI ecosystem in 2024 was <code>ratatui</code> plus figuring most things out yourself. <code>ratatui</code> is excellent — a composable widget model, a well-designed event loop, enough flexibility to make something that actually looks good. What it doesn't give you is opinions about architecture.</p>

<p>The main challenge with a network monitoring TUI is the polling model. You have multiple metric sources — <code>/proc/net/dev</code> for interface stats, ICMP pings for latency, <code>/proc/net/tcp</code> for connections — each with different refresh intervals. Getting these to compose cleanly without threads blocking each other took a few iterations.</p>

<p>The pattern I landed on: one background thread per metric source, each writing to a shared <code>RwLock&lt;MetricCache&gt;</code> at its own cadence. The render loop reads from the cache at 1 Hz, so the UI stays smooth even if a ping times out and stalls for 500 ms. The cache acts as a decoupling layer between "how fast can we collect" and "how fast should we draw."</p>

<h2>No root, by design</h2>

<p>A non-negotiable early decision: no root required. Everything <code>netwatch</code> reads is in <code>/proc</code> and <code>/sys</code>, which are world-readable on every modern Linux distribution. The one exception is ICMP socket creation — modern Linux supports unprivileged ICMP_ECHO sockets since kernel 3.x, so we use those.</p>

<p>This matters more than it sounds. If a tool requires <code>sudo</code>, it goes in the "too much friction" pile for most developers. A single binary you can <code>scp</code> to a server and run immediately — without privilege escalation — is a fundamentally different experience.</p>

<h2>700 stars without a marketing budget</h2>

<p>It started with a post in <a href="https://reddit.com/r/rust" target="_blank" rel="noopener noreferrer">r/rust</a>. The tool was useful, the post was honest about what it did and didn't do, and it got enough upvotes to reach people who actually needed it. Growth since then has been the same pattern: word of mouth from developers who found it useful and told others. We've posted in other communities and forums over time, but that first r/rust thread is where it began.</p>

<p>What I didn't expect: how many people use it as a live debugging tool during production incidents. "I had netwatch running in a tmux pane and that's how I caught the packet loss spike" came up more than once. That's exactly the use case the tool was built for. It's satisfying when the problem statement turns out to be exactly right.</p>

<h2>What's next</h2>

<p>The CLI tool is stable, actively maintained, and <a href="https://github.com/matthart1983/netwatch" target="_blank" rel="noopener noreferrer">open source on GitHub</a>. The logical extension is a hosted layer — persistent metric history, alerting, and a fleet dashboard for servers you can't babysit with a terminal. That's what NetWatch Cloud is: the same lightweight Rust agent, plus a backend that stores your data and pages you when something breaks. It's coming. In the meantime, the CLI tool works today and costs nothing.</p>
`,
  },
  {
    slug: 'essh-ssh-client-for-server-fleets',
    title: 'essh: Building the SSH Client I Actually Wanted',
    date: '2026-02-08',
    excerpt:
      'Why I built another SSH client in Rust, what makes it different from the tools that already exist, and what terminal-native UX should feel like in 2026.',
    readTime: '5 min read',
    tags: ['rust', 'ssh', 'devtools'],
    content: `
<p>My server management workflow was embarrassing. A <code>~/.ssh/config</code> with 40 entries, kept vaguely in sync with a notes file. A shell alias for each server. Multiple terminal tabs, renamed by hand. <code>scp</code> commands reconstructed from memory every time I needed to copy a file.</p>

<p>If you manage fewer than five servers, this works fine. At ten or more, it's death by a thousand cuts. The existing options weren't quite right: <code>mosh</code> is great for flaky connections but doesn't solve fleet management. Teleport and Boundary are serious infrastructure for 100-node organizations. There's a real gap in the middle — a native TUI that treats your servers as a fleet, not individual connections.</p>

<h2>The fleet model</h2>

<p><code>essh</code> organizes servers into named groups. You can have a <code>prod</code> group, a <code>staging</code> group, a <code>personal</code> group. The TUI shows all groups in a sidebar, lets you connect to any server in two keystrokes, and gives you a split view for concurrent sessions. No config file archaeology. No alias maintenance.</p>

<p>The thing that makes this useful rather than just pretty: per-session diagnostics. When you connect to a server, a small panel shows live CPU, memory, network interface stats, and gateway latency — pulled via the SSH connection, no agent required. You get <code>netwatch</code>-style visibility without installing anything on the remote host.</p>

<h2>Pure Rust SSH</h2>

<p>Building an SSH client from scratch is genuinely hard. The protocol is a layered stack: transport → user auth → connection multiplexing → channel handling. <code>russh</code> handles the crypto and protocol state machine correctly, which meant I could focus on the UX layer rather than the wire format.</p>

<p>The trickiest part was concurrent sessions with correct input routing. In a split-view terminal, every keystroke needs to go to exactly the right session. Getting this right with <code>ratatui</code>'s input model took two full rewrites — the first attempt had a subtle race condition that only appeared when switching focus quickly between panes.</p>

<h2>What it feels like to use</h2>

<p>The goal was a tool that feels like it belongs in the terminal, not a web app awkwardly ported to a TUI. That means: keyboard-first navigation, no mouse dependency, consistent visual language, and latency that doesn't feel like a round-trip to a server just to draw a menu.</p>

<p>It also means respecting your existing SSH config. <code>essh</code> reads your <code>~/.ssh/config</code> on startup and imports known hosts. You don't have to re-enter anything you've already configured. It adds fleet features on top of what you already have, not as a replacement.</p>

<h2>What's next</h2>

<p>The core is solid: concurrent sessions, host diagnostics, file transfer, port forwarding, fleet management. The next features I want to build are proper SSH jump host support (SSH ProxyJump with full TUI), a key management panel, and SFTP with a two-pane file browser. The hard infrastructure is there. The remaining features are UI problems, which are tractable.</p>

<p><code>essh</code> is MIT licensed, <a href="https://github.com/matthart1983/essh" target="_blank" rel="noopener noreferrer">available on GitHub</a>, and installable via <code>cargo install essh</code>. If you manage more than a handful of servers and live in the terminal, give it a try.</p>
`,
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return posts.find(p => p.slug === slug)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
