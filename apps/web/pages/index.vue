<template>
  <div class="min-h-screen bg-black relative antialiased">
    <div class="radial-gradient absolute top-0 md:right-14 right-5"></div>
    <!-- Navigation -->
    <LandingHeader />

    <!-- Hero Section -->
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-10 relative z-10">
      <div class="text-center">
        <!-- Problem badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/10 text-gray-500 text-xs font-medium mb-8">
          <!-- <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg> -->
          <span>No more "can you SSH into prod and curl that for me?"</span>
        </div>
        
        <h1 class="mx-auto w-full text-balance text-center font-semibold tracking-tight text-white text-2xl !leading-[1.2] sm:text-4xl md:text-5xl lg:text-6xl">
          Access any service<br/>
          <span class="text-blue-300">from anywhere</span>
        </h1>
        
        <p class="font-normal text-center text-gray-400 max-w-lg mx-auto mb-1 sm:mt-4 text-pretty text-base sm:text-lg sm:leading-6">
          Your database is on a private network. Your API runs behind a firewall. 
          <span class="text-white">Private Connect lets you reach them securely</span>, no VPN setup, no firewall rules, no opening ports.
        </p>

        <!-- CTA buttons -->
        <div class="flex items-center justify-center gap-2 mt-10">
          <NuxtLink to="/register" class="text-sm border justify-center w-44 font-medium flex items-center gap-2 rounded-lg bg-blue-300 border-blue-300 text-black hover:bg-blue-200 transition-colors py-2 px-4!">
            <span>Get Started</span>
          </NuxtLink>
          <a href="https://github.com/treadiehq/private-connect" target="_blank" class="text-sm justify-center w-44 font-medium rounded-lg cursor-pointer flex items-center gap-2 text-white hover:bg-gray-500/10 py-2 px-4!">
            <span>View on Github</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
      </div>
    </section>

    <!-- The Problem / Solution Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="grid lg:grid-cols-2 gap-8">
        <!-- The Old Way (Problem) -->
        <div class="relative">
          <div class="absolute -top-3 left-4 px-3 py-1 rounded-full bg-red-400/10 border border-red-400/10 text-red-400 text-xs font-semibold uppercase tracking-wide">
            The Old Way
          </div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 pt-8 h-full flex flex-col">
            <div class="space-y-4 font-mono text-sm text-gray-400 flex-1 bg-black/40 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>SSH into the bastion host...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>Then SSH into the prod server...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>Set up an SSH tunnel for port forwarding...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>Ask DevOps to open a firewall rule...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>Wait for VPN access approval...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span>Finally run your curl command ...</span>
              </div>
            </div>
            <div class="mt-auto pt-6">
              <p class="text-gray-500 text-sm">Every time you need to debug something, check logs, or test an endpoint on a private network.</p>
            </div>
          </div>
        </div>

        <!-- With Private Connect (Solution) -->
        <div class="relative">
          <div class="absolute -top-3 left-4 px-3 py-1 rounded-full bg-blue-300/10 border border-blue-300/10 text-blue-300 text-xs font-semibold uppercase tracking-wide">
            With Private Connect
          </div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 pt-8 h-full flex flex-col">
            <div class="font-mono text-sm flex-1">
              <div class="flex items-start gap-3 mb-4">
                <span class="text-blue-300 shrink-0">$</span>
                <span class="text-gray-200">connect reach prod-api</span>
              </div>
              <!-- Diagnostic output -->
              <div class="bg-black/40 rounded-lg p-4">
                <div class="text-emerald-400 font-semibold mb-3">✓ REACHABLE</div>
                <div class="text-gray-500 text-xs border border-gray-500/10 rounded">
                  <div class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-500/10">
                    <span class="text-gray-400 w-14">DNS</span>
                    <span class="text-emerald-400">✓</span>
                    <span class="text-emerald-400">OK</span>
                    <span class="text-gray-600">(10.0.1.5)</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-500/10">
                    <span class="text-gray-400 w-14">TCP</span>
                    <span class="text-emerald-400">✓</span>
                    <span class="text-emerald-400">OK</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-500/10">
                    <span class="text-gray-400 w-14">TLS</span>
                    <span class="text-emerald-400">✓</span>
                    <span class="text-emerald-400">OK</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-500/10">
                    <span class="text-gray-400 w-14">HTTP</span>
                    <span class="text-emerald-400">✓</span>
                    <span class="text-emerald-400">200 OK</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-500/10">
                    <span class="text-gray-400 w-14">Latency</span>
                    <span class="text-blue-300">45ms</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2">
                    <span class="text-gray-400 w-14">From</span>
                    <span class="text-purple-300">my-laptop</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-auto pt-6">
              <p class="text-gray-500 text-sm">One command. Instant access. Works from anywhere and see exactly what's happening.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section id="features" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Built for developers who…</h2>
        <p class="text-gray-400 max-w-xl mx-auto">If any of these sound familiar, Private Connect is for you.</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- Use case 1 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center mb-4 group-hover:bg-blue-300/15 transition-colors">
            <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 12h16"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Debug production databases</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Connect your local SQL client to RDS, Cloud SQL, or any private database without a VPN.</p>
        </div>

        <!-- Use case 2 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center mb-4 group-hover:bg-purple-300/15 transition-colors">
            <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Test internal APIs locally</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Hit staging or internal microservices from your dev machine like they're running locally.</p>
        </div>

        <!-- Use case 3 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center mb-4 group-hover:bg-amber-300/15 transition-colors">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Access home lab remotely</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Reach your Raspberry Pi, NAS, or self-hosted services from anywhere without exposing ports.</p>
        </div>

        <!-- Use case 4 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center mb-4 group-hover:bg-emerald-300/15 transition-colors">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Share with contractors</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Give temporary access to specific services without onboarding onto your VPN or network.</p>
        </div>

        <!-- Use case 5 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-cyan-300/10 flex items-center justify-center mb-4 group-hover:bg-cyan-300/15 transition-colors">
            <svg class="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">CI/CD to private infra</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Let GitHub Actions or CircleCI deploy to servers that aren't publicly accessible.</p>
        </div>

        <!-- Use case 6 -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-rose-300/10 flex items-center justify-center mb-4 group-hover:bg-rose-300/15 transition-colors">
            <svg class="w-5 h-5 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Monitor internal services</h3>
          <p class="text-gray-400 text-sm leading-relaxed">Check if your internal Grafana, Kibana, or admin dashboards are responding.</p>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">How it works</h2>
        <p class="text-gray-400 max-w-xl mx-auto">Three commands. That's it.</p>
      </div>

      <div class="max-w-2xl mx-auto">
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
          <!-- Terminal header -->
          <div class="flex items-center gap-2 px-4 py-3 bg-gray-500/10 border-b border-gray-500/10">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-red-400"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-300"></div>
              <div class="w-3 h-3 rounded-full bg-green-300"></div>
            </div>
            <span class="ml-2 text-xs text-gray-500 font-mono">Terminal</span>
          </div>
          
          <!-- Step 1 -->
          <div class="p-4 pb-1">
            <div class="flex items-start gap-4">
              <div class="shrink-0 w-6 h-6 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center font-bold text-xs">1</div>
              <div class="flex-1">
                <h3 class="font-semibold text-white mb-1">Install on your server</h3>
                <p class="text-gray-500 text-sm mb-3">Takes 10 seconds. Just one script.</p>
                <div class="bg-black/50 rounded-lg p-4 font-mono text-sm">
                  <span class="text-blue-300">$</span>
                  <span class="text-gray-200 ml-2">curl -fsSL https://privateconnect.co/install.sh | bash</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="p-4 pb-1">
            <div class="flex items-start gap-4">
              <div class="shrink-0 w-6 h-6 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center font-bold text-xs">2</div>
              <div class="flex-1">
                <h3 class="font-semibold text-white mb-1">Expose your service</h3>
                <p class="text-gray-500 text-sm mb-3">Tell Private Connect what you want to reach.</p>
                <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div>
                    <span class="text-blue-300">$</span>
                    <span class="text-gray-200 ml-2">connect up --label prod-server</span>
                  </div>
                  <div>
                    <span class="text-blue-300">$</span>
                    <span class="text-gray-200 ml-2">connect expose localhost:5432 --name prod-db</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="p-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 w-6 h-6 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center font-bold text-xs">3</div>
              <div class="flex-1">
                <h3 class="font-semibold text-white mb-1">Connect from anywhere</h3>
                <p class="text-gray-500 text-sm mb-3">From your laptop, another server, or CI/CD.</p>
                <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div>
                    <span class="text-blue-300">$</span>
                    <span class="text-gray-200 ml-2">connect reach prod-db</span>
                  </div>
                  <div class="text-gray-500 text-xs">Running diagnostics...</div>
                  <div class="text-emerald-300 font-semibold">✓ REACHABLE</div>
                  <div class="text-emerald-300 font-semibold">✓ Connected to prod-db on localhost:5432</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Security FAQ Section -->
    <section id="security" class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">Frequently asked questions</h2>
        <p class="text-gray-400">Everything you need to know about Private Connect security.</p>
      </div>

      <div class="space-y-3">
        <!-- FAQ 1 -->
        <details class="group bg-gray-500/10 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">Why should I trust this tool?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p>Trust is earned. Here's what we offer:</p>
            <ul class="space-y-2">
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Open architecture:</strong> The agent runs locally. Traffic flows through our hub as an encrypted relay. We can't see inside your tunnels.</span></li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Minimal permissions:</strong> No root/admin access required. Outbound connections only, nothing listens publicly.</span></li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Credentials stay local:</strong> API keys never leave your machine during tunnel operation. Tokens are hashed (SHA-256).</span></li>
            </ul>
            <p class="text-gray-500 text-xs">That said, you're trusting our hub infrastructure. If that's unacceptable, we offer self-hosting.</p>
          </div>
        </details>

        <!-- FAQ 2 -->
        <details class="group bg-gray-500/10 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">What if someone intercepts the connection (MITM)?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p>All agent-to-hub communication uses <strong class="text-white">TLS 1.3</strong>. If TLS were compromised (rogue CA, corporate MITM proxy), an attacker could capture your agent token but NOT your API key.</p>
            <p><strong class="text-white">Mitigations:</strong></p>
            <ul class="space-y-1">
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> HTTPS enforced for production connections</li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> Token rotation with 30-day expiry</li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> IP change detection and audit logging</li>
            </ul>
          </div>
        </details>

        <!-- FAQ 3 -->
        <details class="group bg-gray-500/10 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">Has this been security audited?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p class=" font-medium">Officially, not yet. We are Open Source, please feel free to look around. We have done internal security review, static analysis, and dependency scanning.</p>
            <p>We haven't undergone a formal third-party security audit but that is planned.</p>
          </div>
        </details>

        <!-- FAQ 4 -->
        <details class="group bg-gray-500/10 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">Doesn't this make it easier for attackers to reach prod?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p><strong class="text-white">No.</strong> Private Connect doesn't grant new access, it wraps existing access.</p>
            <p>If you can SSH into a jump box today, you already have prod access. We make that access:</p>
            <ul class="space-y-1">
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <strong class="text-white">Auditable:</strong> Who accessed what, when, from which IP</li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <strong class="text-white">Revocable:</strong> Tokens expire (30 days) and can be rotated instantly</li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <strong class="text-white">Scoped:</strong> Per-service access, not broad network access like VPNs</li>
            </ul>
            <p class="text-gray-500 text-xs">If an attacker has your agent credentials, they likely already have your SSH keys. We just make the access you already have safer and more traceable.</p>
          </div>
        </details>

        <!-- FAQ 5 -->
        <details class="group bg-gray-500/10 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">Can someone recon my environment from your logs?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p>No, we minimize what's logged.</p>
            <p><strong class="text-white">We log:</strong> connection events (timestamp, masked IP), service names you define.</p>
            <!-- <p><strong class="text-white">We DON'T log:</strong> request/response bodies, internal IPs, credentials (actively scrubbed), file paths.</p> -->
            <!-- <p class="text-gray-500 text-xs">IPs are masked (e.g., 192.168.x.x) in production logs.</p> -->
          </div>
        </details>
      </div>
    </section>

    <!-- Simple CTA Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
      <div class="text-center py-12 px-6 rounded-xl bg-gray-500/10 border border-gray-500/10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to stop the SSH dance?</h2>
        <p class="text-gray-400 max-w-md mx-auto mb-8">Set up in under a minute. No credit card required.</p>
        <NuxtLink to="/register" 
                  class="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all">
          Get Started
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
          </svg>
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
useHead({ 
  title: 'Private Connect',
})

definePageMeta({
  layout: false,
});
</script>
