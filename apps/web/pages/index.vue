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
          <span>From private networks to your terminal</span>
        </div>
        
        <h1 class="mx-auto w-full text-balance text-center font-semibold tracking-tight text-white text-2xl !leading-[1.2] sm:text-4xl md:text-5xl lg:text-6xl">
          Access any service<br/>
          <span class="text-blue-300">like it's localhost</span>
        </h1>
        
        <p class="font-normal text-center text-gray-400 max-w-lg mx-auto mb-1 sm:mt-4 text-pretty text-base sm:text-lg sm:leading-6">
          Your staging database. Your prod API behind a firewall. Your teammate's dev server.
          <span class="text-white">One command and it's on localhost.</span> No VPN, no firewall rules, no SSH tunnels.
        </p>

        <!-- Quick Install -->
        <div class="mt-10 mb-3">
          <div class="inline-flex items-center cursor-pointer bg-black/60 border border-gray-500/15 rounded-lg px-4 py-2.5 font-mono text-xs group hover:bg-gray-500/15 transition-colors">
            <span class="text-gray-500 mr-2">$</span>
            <span class="text-gray-200">curl -fsSL https://privateconnect.co/install.sh | bash</span>
            <button 
              @click="copyInstall" 
              class="ml-4 text-gray-500 hover:text-white transition-colors"
              :title="copied ? 'Copied!' : 'Copy'"
            >
              <svg v-if="!copied" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <svg v-else class="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- CTA buttons -->
        <div class="flex items-center justify-center gap-2">
          <!-- <NuxtLink to="/register" class="text-sm border justify-center w-44 font-medium flex items-center gap-2 rounded-lg bg-blue-300 border-blue-300 text-black hover:bg-blue-200 transition-colors py-2 px-4!">
            <span>Get Started</span>
          </NuxtLink> -->
          <a href="https://github.com/treadiehq/private-connect" target="_blank" class="text-sm justify-center w-44 font-medium rounded-lg cursor-pointer flex items-center gap-2 text-gray-500 hover:text-white hover:bg-gray-500/10 py-2 px-4!">
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
          <div class="absolute -top-3 left-4 px-3 py-1 rounded-full bg-red-400/10 border border-red-400/20 text-red-400 text-xs font-semibold uppercase tracking-wide">
            Without Private Connect
          </div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 pt-8 h-full flex flex-col">
            <div class="space-y-3 font-mono text-sm text-gray-400 flex-1 bg-black/50 rounded-lg p-4 opacity-60 hover:opacity-80 transition-opacity">
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span class="line-through decoration-red-400/50">SSH into the bastion, then SSH into prod...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span class="line-through decoration-red-400/50">Set up SSH tunnels for port forwarding...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span class="line-through decoration-red-400/50">Wait for VPN access approval...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span class="line-through decoration-red-400/50">Ask DevOps to open a firewall rule...</span>
              </div>
              <div class="flex items-start gap-3">
                <span class="text-red-400 shrink-0">✗</span>
                <span class="line-through decoration-red-400/50">Update /etc/hosts with internal IPs...</span>
              </div>
            </div>
            <div class="flex items-start gap-3 pt-2 text-sm">
              <span class="text-gray-500">30 minutes before you can start working</span>
            </div>
          </div>
        </div>

        <!-- With Private Connect (Solution) -->
        <div class="relative">
          <div class="absolute -top-3 left-4 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold uppercase tracking-wide">
            With Private Connect
          </div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 pt-8 h-full flex flex-col">
            <div class="font-mono text-sm flex-1">
              <div class="flex items-start gap-3 mb-4">
                <span class="text-blue-300 shrink-0">$</span>
                <span class="text-gray-200">connect reach prod-api</span>
              </div>
              <!-- Diagnostic output -->
              <div class="bg-black/50 rounded-lg p-4">
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
                    <span class="text-gray-400 w-14">Latency</span>
                    <span class="text-blue-300">45ms</span>
                  </div>
                  <div class="px-3 py-1.5 flex items-center gap-2">
                    <span class="text-gray-400 w-14">Local</span>
                    <span class="text-emerald-300">localhost:3000</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 text-sm flex items-center gap-2">
                <span class="text-gray-500">Ready in 10 seconds. Works for humans and AI agents alike.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section id="features" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Built for developers who…</h2>
        <p class="text-gray-400 max-w-xl mx-auto">If any of these sound familiar, Private Connect is for you and your AI agents.</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- Use case 1: Production fire -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"Production is on fire, but I'm on my laptop"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">You need to check the database. Now. Not in 20 minutes after the VPN connects.</p>
          <code class="text-blue-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect reach prod-db</code>
        </div>

        <!-- Use case 2: Test against staging -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"I need to test against staging, not mocks"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">Your code works locally but fails in staging. You need to hit the real API.</p>
          <code class="text-purple-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect reach staging-api</code>
        </div>

        <!-- Use case 3: New dev onboarding -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"New dev starts Monday. Setup takes a day."</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">VPN, SSH keys, firewall rules, /etc/hosts... They could be coding instead.</p>
          <code class="text-amber-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect join x7k9m2</code>
        </div>

        <!-- Use case 4: AI Agents -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"My AI agent needs to query prod"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">Agents in sandboxes need private data. Secure tunnel, no credentials exposed, full audit trail.</p>
          <code class="text-emerald-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect reach prod-db</code>
        </div>

        <!-- Use case 5: Contractor access -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-cyan-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"The contractor needs API access for 2 hours"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">Not VPN access. Not an account. Just a link to that one endpoint.</p>
          <code class="text-cyan-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect link staging-api --expires 2h</code>
        </div>

        <!-- Use case 6: CI/CD -->
        <div class="group p-5 rounded-xl bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/15 transition-all">
          <div class="w-10 h-10 rounded-lg bg-rose-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"CI/CD can't reach our private servers"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">GitHub Actions needs to deploy to your private infra. Without a self-hosted runner.</p>
          <code class="text-rose-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect reach deploy-target</code>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">How it works</h2>
        <p class="text-gray-400 max-w-xl mx-auto">Set up once, use every day.</p>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Left: Initial Setup (One Time) -->
        <div>
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">One-time setup</div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
            <!-- Terminal header -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gray-500/5 border-b border-gray-500/10">
              <div class="flex gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-yellow-300"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-green-300"></div>
              </div>
              <span class="ml-2 text-xs text-gray-500 font-mono">prod-server</span>
            </div>
            
            <!-- Step 1: Install -->
            <div class="p-4 border-b border-gray-500/10">
              <div class="flex items-center gap-2 mb-2">
                <div class="shrink-0 w-5 h-5 rounded-full bg-blue-300/10 text-blue-300 flex items-center justify-center font-bold text-xs">1</div>
                <h3 class="font-medium text-white text-sm">Install</h3>
              </div>
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs">
                <span class="text-gray-500">$</span>
                <span class="text-gray-200 ml-2">curl -fsSL https://privateconnect.co/install.sh | bash</span>
              </div>
            </div>

            <!-- Step 2: Expose -->
            <div class="p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="shrink-0 w-5 h-5 rounded-full bg-blue-300/10 text-blue-300 flex items-center justify-center font-bold text-xs">2</div>
                <h3 class="font-medium text-white text-sm">Expose services</h3>
              </div>
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1.5">
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect up --label prod-server</span>
                </div>
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect expose localhost:5432 --name prod-db</span>
                </div>
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect expose localhost:3000 --name prod-api</span>
                </div>
                <div class="text-emerald-300 pt-1">✓ Services exposed</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Daily Usage -->
        <div>
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Every day</div>
          <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
            <!-- Terminal header -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gray-500/5 border-b border-gray-500/10">
              <div class="flex gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-yellow-300"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-green-300"></div>
              </div>
              <span class="ml-2 text-xs text-gray-500 font-mono">your-laptop</span>
            </div>
            
            <!-- Option A: connect reach -->
            <div class="p-4 border-b border-gray-500/10">
              <div class="flex items-center gap-2 mb-2">
                <div class="shrink-0 w-5 h-5 rounded-full bg-emerald-300/10 text-emerald-300 flex items-center justify-center font-bold text-xs">A</div>
                <h3 class="font-medium text-white text-sm">Connect to a service</h3>
              </div>
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1.5">
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect reach prod-db</span>
                </div>
                <div class="text-emerald-300">✓ Connected on localhost:5432</div>
              </div>
            </div>

            <!-- Option B: connect dev -->
            <div class="p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="shrink-0 w-5 h-5 rounded-full bg-purple-300/10 text-purple-300 flex items-center justify-center font-bold text-xs">B</div>
                <h3 class="font-medium text-white text-sm">Or use a project config</h3>
              </div>
              <!-- pconnect.yml -->
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs mb-3">
                <div class="text-gray-500 mb-1.5"># pconnect.yml</div>
                <div><span class="text-purple-300">services:</span></div>
                <div class="ml-2"><span class="text-gray-200">- prod-db</span></div>
                <div class="ml-2"><span class="text-gray-200">- prod-api</span></div>
                <div class="ml-2"><span class="text-gray-200">- staging-cache</span></div>
              </div>
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1.5">
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect dev</span>
                </div>
                <div class="text-emerald-300">✓ Connected to 3 services</div>
                <div class="text-gray-500">  prod-db → localhost:5432</div>
                <div class="text-gray-500">  prod-api → localhost:3000</div>
                <div class="text-gray-500">  staging-cache → localhost:6379</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Workflow Section -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">Works for teams, not just individuals</h2>
        <p class="text-gray-400">Onboard teammates instantly. Share access without sharing credentials.</p>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <!-- Share/Join: Team Onboarding -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">Team onboarding</h3>
              <p class="text-gray-500 text-sm">New dev productive in 30 seconds</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <!-- You -->
            <div class="bg-black/40 rounded-lg p-4">
              <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">You</div>
              <div class="font-mono text-sm space-y-1">
                <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect share</span></div>
                <div class="text-purple-300">Share code: x7k9m2</div>
                <div class="text-gray-500 text-xs">Valid for 24 hours</div>
              </div>
            </div>
            
            <!-- Teammate -->
            <div class="bg-black/40 rounded-lg p-4">
              <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">Teammate</div>
              <div class="font-mono text-sm space-y-1">
                <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect join x7k9m2</span></div>
                <div class="text-emerald-300">✓ Joined environment</div>
                <div class="text-gray-500 text-xs">Connected to 5 services</div>
              </div>
            </div>
          </div>
          
          <p class="text-gray-500 text-xs mt-4">No VPN setup. No SSH keys. No /etc/hosts. Same environment, instantly.</p>
        </div>

        <!-- Link: External Sharing -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-cyan-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">External sharing</h3>
              <p class="text-gray-500 text-sm">Give access without giving credentials</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <!-- Create link -->
            <div class="bg-black/40 rounded-lg p-4">
              <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">Create a public link</div>
              <div class="font-mono text-sm space-y-1">
                <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect link staging-api --expires 2h</span></div>
                <div class="text-cyan-300 text-xs break-all">https://link.privateconnect.co/share_abc123</div>
              </div>
            </div>
            
            <!-- Features -->
            <div class="bg-black/40 rounded-lg p-4">
              <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">Built-in controls</div>
              <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2">
                  <span class="text-emerald-400">✓</span>
                  <span class="text-gray-400">Auto-expires (2h, 24h, 7d)</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-emerald-400">✓</span>
                  <span class="text-gray-400">Rate limiting built-in</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-emerald-400">✓</span>
                  <span class="text-gray-400">No account required for recipient</span>
                </div>
              </div>
            </div>
          </div>
          
          <p class="text-gray-500 text-xs mt-4">Perfect for contractors, external reviewers, or quick demos.</p>
        </div>
      </div>
    </section>

    <!-- Commands / Skip the Boilerplate Section -->
    <!-- <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">One command for each thing</h2>
        <p class="text-gray-400">No setup scripts. No configuration files. Just type and connect.</p>
      </div>
      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
        <TransitionGroup name="list">
          <div 
            v-for="(cmd, index) in commands" 
            :key="cmd.name"
            class="px-6 py-4 border-b border-gray-500/10 last:border-0 hover:bg-gray-500/5 transition-colors cursor-pointer group"
            @click="activeCommand = activeCommand === cmd.name ? null : cmd.name"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <code class="text-blue-300 font-mono text-sm">{{ cmd.name }}</code>
                  <span class="text-emerald-400 text-xs hidden sm:inline">✓</span>
                </div>
                <p class="text-gray-500 text-sm mt-1">{{ cmd.description }}</p>
              </div>
              <svg 
                class="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-all shrink-0"
                :class="{ 'rotate-180 text-blue-300': activeCommand === cmd.name }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
            
            <Transition name="expand">
              <div v-if="activeCommand === cmd.name" class="mt-4 p-4 bg-black/40 rounded-lg border border-gray-500/10">
                <div class="font-mono text-sm mb-3 overflow-x-auto">
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">{{ cmd.example }}</span>
                </div>
                <p class="text-gray-400 text-sm leading-relaxed">{{ cmd.useCase }}</p>
              </div>
            </Transition>
          </div>
        </TransitionGroup>
      </div>
    </section> -->

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
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Make every service feel local</h2>
        <p class="text-gray-400 max-w-md mx-auto mb-8">Install in 30 seconds. Connect to your first service in 60.</p>
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
import { ref, computed } from 'vue';

useHead({ 
  title: 'Private Connect',
})

definePageMeta({
  layout: false,
});

// Copy install command
const copied = ref(false);
const copyInstall = async () => {
  await navigator.clipboard.writeText('curl -fsSL https://privateconnect.co/install.sh | bash');
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
};

const activeCommand = ref<string | null>(null);
const activeCategory = ref('all');

const categories = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'collab', label: 'Collaboration' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'infra', label: 'Infrastructure' },
];

const filteredCommands = computed(() => {
  if (activeCategory.value === 'all') return commands;
  return commands.filter(c => c.category === activeCategory.value);
});

const commands = [
  // Core Commands
  {
    name: 'connect up',
    description: 'Start the agent and connect to hub',
    example: 'connect up --label prod-server',
    useCase: 'Initialize the agent on any machine. Works on servers, laptops, Raspberry Pis, CI runners. One command to join your private network.',
    buildTime: '1-2 weeks',
    category: 'core',
  },
  {
    name: 'connect expose',
    description: 'Make a local service reachable',
    example: 'connect expose localhost:5432 --name prod-db',
    useCase: 'Running PostgreSQL on a private server? Expose it securely without opening firewall ports. Only your workspace members can reach it.',
    buildTime: '2-3 weeks',
    category: 'core',
  },
  {
    name: 'connect reach',
    description: 'Connect to an exposed service',
    example: 'connect reach prod-db',
    useCase: 'From your laptop, connect to any exposed service. Creates a local tunnel so your tools think the service is running locally.',
    buildTime: '2-3 weeks',
    category: 'core',
  },
  // Collaboration
  {
    name: 'connect share',
    description: 'Share environment with teammates',
    example: 'connect share --name "staging-env"',
    useCase: 'New developer joins? Share your entire routing setup. They run connect join <code> and instantly access the same services you do.',
    buildTime: '1-2 weeks',
    category: 'collab',
  },
  {
    name: 'connect join',
    description: 'Join a shared environment',
    example: 'connect join ABC123',
    useCase: 'Got a share code from a teammate? One command and you have their exact service setup. No manual configuration needed.',
    buildTime: '1 week',
    category: 'collab',
  },
  {
    name: 'connect link',
    description: 'Create public shareable URLs',
    example: 'connect link api --expires 24h',
    useCase: 'Share an internal API with a contractor. Generate a secure, expiring public URL. No VPN, no firewall rules. Revoke anytime.',
    buildTime: '2-3 weeks',
    category: 'collab',
  },
  // Developer Workflow
  {
    name: 'connect dev',
    description: 'Project-based configuration',
    example: 'connect dev',
    useCase: 'Add pconnect.yml to your repo. Every developer runs connect dev and gets the exact same services database, Redis, APIs mapped automatically.',
    buildTime: '1-2 weeks',
    category: 'workflow',
  },
  {
    name: 'connect proxy',
    description: 'Subdomain-based routing',
    example: 'connect proxy',
    useCase: 'Access services via memorable URLs like staging-db.localhost:3000 instead of random ports. Works with any HTTP client or browser.',
    buildTime: '1-2 weeks',
    category: 'workflow',
  },
  {
    name: 'connect map',
    description: 'Explicit port mappings',
    example: 'connect map staging-db 5432',
    useCase: 'Map remote services to exact local ports. staging-db always on :5432, redis on :6379. Configure once, use everywhere.',
    buildTime: '3-5 days',
    category: 'workflow',
  },
  {
    name: 'connect discover',
    description: 'Auto-detect local services',
    example: 'connect discover --expose',
    useCase: 'Scan your machine for running services (databases, web servers, etc.) and optionally expose them all at once. Great for quick setup.',
    buildTime: '1 week',
    category: 'workflow',
  },
  // Infrastructure
  // {
  //   name: 'connect daemon',
  //   description: 'Always-on background service',
  //   example: 'connect daemon install --proxy',
  //   useCase: 'Install once, forget forever. Starts on boot, keeps services connected. Like Docker Desktop, but for private network access.',
  //   buildTime: '2-3 weeks',
  //   category: 'infra',
  // },
  // {
  //   name: 'connect whoami',
  //   description: 'Show agent identity & workspace',
  //   example: 'connect whoami',
  //   useCase: 'Check which workspace you belong to, your agent ID, usage limits, and connection status. Useful for debugging and verification.',
  //   buildTime: '2-3 days',
  //   category: 'infra',
  // },
  // {
  //   name: 'connect update',
  //   description: 'Update CLI to latest version',
  //   example: 'connect update',
  //   useCase: 'Stay current with one command. Downloads and installs the latest version automatically. No package manager needed.',
  //   buildTime: '3-5 days',
  //   category: 'infra',
  // },
];
</script>
