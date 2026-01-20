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
          <span>No VPN. No firewall rules. No waiting.</span>
        </div>
        
        <h1 class="mx-auto w-full text-balance text-center font-semibold tracking-tight text-white text-3xl leading-[1.2]! sm:text-4xl md:text-5xl lg:text-6xl">
          Access private services <br/>
          <span class="text-blue-300">without the complexity</span>
        </h1>
        
        <p class="font-normal text-center text-gray-400 max-w-lg mx-auto mb-1 sm:mt-4 text-pretty text-base sm:text-lg sm:leading-6">
          Your staging database. Your prod API behind a firewall. Your AI agent's data sources.
          <span class="text-white">One command. It just works.</span>
        </p>

        <!-- Install command -->
        <div class="mt-10 mb-4">
          <div class="inline-flex items-center cursor-pointer bg-black/60 border border-gray-500/15 rounded-lg px-4 py-2 font-mono text-xs group hover:bg-gray-500/15 transition-colors">
            <span class="text-gray-500 mr-2">$</span>
            <span class="text-gray-400">curl -fsSL https://privateconnect.co/install.sh | bash</span>
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
          <!-- <div class="text-xs text-gray-600 mt-2">Then: <code class="text-gray-400">connect prod-db</code> to reach any service</div> -->
          <div class="text-xs text-gray-600 mt-2">
            <NuxtLink to="/install" class="text-gray-500 hover:text-gray-300 underline">Manual download</NuxtLink> for production environments
          </div>
        </div>

        <!-- vs alternatives -->
        <!-- <p class="text-xs text-gray-600 max-w-md mx-auto">
          Service-level access to private infrastructure, not a network VPN.
          Like ngrok, but for <span class="text-gray-400">accessing</span> services, not just exposing them. Like Tailscale, but no mesh network to manage.
        </p> -->

        <!-- CTA buttons -->
        <div class="flex items-center justify-center gap-3 mt-6">
          <NuxtLink to="/register" target="_blank" class="text-sm justify-center bg-white font-medium rounded-lg cursor-pointer flex items-center gap-2 text-black hover:bg-gray-300 py-2 px-4">
            <!-- <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
            </svg> -->
            <span>Get started for free</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
            </svg>
          </NuxtLink>
        </div>
        <!-- <div class="flex items-center justify-center gap-3 mt-6">
          <a href="https://github.com/treadiehq/private-connect" target="_blank" class="text-sm justify-center font-medium rounded-lg cursor-pointer flex items-center gap-2 text-gray-500 hover:text-white hover:bg-gray-500/10 py-2 px-4">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
            </svg>
            <span>View on GitHub</span>
          </a>
        </div> -->
      </div>
    </section>

    <!-- What You Can Do Section -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-xl font-semibold text-white mb-2">What you can do</h2>
        <p class="text-gray-500 text-sm">Access services by name. Share with teammates. Works everywhere.</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Expose -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-emerald-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Expose</h3>
          </div>
          <code class="text-xs font-mono text-emerald-300 bg-black/40 px-2 py-1 rounded block mb-2">connect 5432</code>
          <p class="text-xs text-gray-500">Make any local service reachable by name.</p>
        </div>

        <!-- Access -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-blue-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Access</h3>
          </div>
          <code class="text-xs font-mono text-blue-300 bg-black/40 px-2 py-1 rounded block mb-2">connect prod-db</code>
          <p class="text-xs text-gray-500">Connect to any service from anywhere.</p>
        </div>

        <!-- Share -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-purple-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Share</h3>
          </div>
          <code class="text-xs font-mono text-purple-300 bg-black/40 px-2 py-1 rounded block mb-2">connect share</code>
          <p class="text-xs text-gray-500">Onboard teammates in seconds.</p>
        </div>

        <!-- Clone -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-amber-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Clone</h3>
          </div>
          <code class="text-xs font-mono text-amber-300 bg-black/40 px-2 py-1 rounded block mb-2">connect clone alice</code>
          <p class="text-xs text-gray-500">Mirror a teammate's environment instantly.</p>
        </div>

        <!-- Link -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-cyan-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Link</h3>
          </div>
          <code class="text-xs font-mono text-cyan-300 bg-black/40 px-2 py-1 rounded block mb-2">connect link prod-api</code>
          <p class="text-xs text-gray-500">Create a public URL. No install needed for viewers.</p>
        </div>

        <!-- Broker -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-rose-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Broker</h3>
          </div>
          <code class="text-xs font-mono text-rose-300 bg-black/40 px-2 py-1 rounded block mb-2">connect broker claude</code>
          <p class="text-xs text-gray-500">Run AI agents with guardrails. Policies enforced.</p>
        </div>
      </div>

      <!-- Works everywhere callout -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-600">
          Works on <span class="text-gray-400">laptops</span>, <span class="text-gray-400">servers</span>, <span class="text-gray-400">CI/CD runners</span>, and <span class="text-gray-400">AI agents</span>.
        </p>
      </div>

      <!-- For Teams -->
      <div class="mt-12 pt-8 border-t border-gray-500/10 hidden">
        <p class="text-xs text-gray-600 uppercase tracking-wider mb-4 text-center">For teams</p>
        <div class="grid sm:grid-cols-3 gap-4">
          <!-- Control Panel -->
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                </svg>
              </div>
              <h3 class="font-medium text-white text-sm">Control Panel</h3>
            </div>
            <p class="text-xs text-gray-500">REST API, webhooks, and full programmatic control over agents and services.</p>
          </div>

          <!-- Permission Broker -->
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-8 h-8 rounded-lg bg-amber-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <h3 class="font-medium text-white text-sm">Permission Broker</h3>
            </div>
            <p class="text-xs text-gray-500">Control AI agent actions. Approve, block, or require human review.</p>
          </div>

          <!-- Audit Logs -->
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-8 h-8 rounded-lg bg-purple-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <h3 class="font-medium text-white text-sm">Audit Logs</h3>
            </div>
            <p class="text-xs text-gray-500">See who accessed what, when, from where. Full visibility into all agent activity.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Key Features Section -->
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 hidden">
      <div class="grid sm:grid-cols-2 gap-4">
        <!-- Zero Config -->
        <div class="flex items-start gap-3 p-4 rounded-lg bg-gray-500/5 border border-gray-500/10">
          <span class="text-emerald-300 text-lg">✓</span>
          <div>
            <h3 class="font-medium text-white text-sm mb-1">Zero configuration</h3>
            <p class="text-xs text-gray-500">No VPN setup, no firewall rules, no port forwarding. Just install and connect.</p>
          </div>
        </div>

        <!-- End-to-end encrypted -->
        <div class="flex items-start gap-3 p-4 rounded-lg bg-gray-500/5 border border-gray-500/10">
          <span class="text-emerald-300 text-lg">✓</span>
          <div>
            <h3 class="font-medium text-white text-sm mb-1">End-to-end encrypted</h3>
            <p class="text-xs text-gray-500">TLS 1.3 for all connections. Credentials never leave your machine.</p>
          </div>
        </div>

        <!-- Service-level access -->
        <div class="flex items-start gap-3 p-4 rounded-lg bg-gray-500/5 border border-gray-500/10">
          <span class="text-emerald-300 text-lg">✓</span>
          <div>
            <h3 class="font-medium text-white text-sm mb-1">Service-level access</h3>
            <p class="text-xs text-gray-500">Connect to services by name, not IPs. Per-service permissions, not network-wide.</p>
          </div>
        </div>

        <!-- Open source -->
        <div class="flex items-start gap-3 p-4 rounded-lg bg-gray-500/5 border border-gray-500/10">
          <span class="text-emerald-300 text-lg">✓</span>
          <div>
            <h3 class="font-medium text-white text-sm mb-1">Open source & self-hostable</h3>
            <p class="text-xs text-gray-500">Inspect the code. Run your own hub. Full control over your infrastructure.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- For Teams Section (compact) - now integrated into What You Can Do -->
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10 border-t border-gray-500/10 hidden">
      <div class="text-center mb-8">
        <h2 class="text-lg font-semibold text-white mb-2">For teams</h2>
        <p class="text-gray-500 text-sm">Everything you need to manage private access at scale.</p>
      </div>

      <div class="grid sm:grid-cols-3 gap-6">
        <!-- Control Panel -->
        <div class="text-center">
          <div class="w-10 h-10 rounded-lg bg-cyan-300/10 flex items-center justify-center mx-auto mb-3">
            <svg class="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
            </svg>
          </div>
          <h3 class="font-medium text-white text-sm mb-1">Control Panel</h3>
          <p class="text-xs text-gray-500">REST API, webhooks, and full programmatic control.</p>
        </div>

        <!-- Permission Broker -->
        <div class="text-center">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center mx-auto mb-3">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <h3 class="font-medium text-white text-sm mb-1">Permission Broker</h3>
          <p class="text-xs text-gray-500">Control AI agent actions. Approve, block, or require human review.</p>
        </div>

        <!-- Audit Logs -->
        <div class="text-center">
          <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center mx-auto mb-3">
            <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 class="font-medium text-white text-sm mb-1">Audit Logs</h3>
          <p class="text-xs text-gray-500">See who accessed what, when, from where.</p>
        </div>
      </div>

      <div class="text-center mt-6">
        <a href="https://api.privateconnect.co/docs" target="_blank" class="text-xs text-gray-500 hover:text-blue-300 transition-colors">
          API Documentation →
        </a>
      </div>
    </section>

    <!-- The Problem / Solution Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
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
                <span class="text-gray-200">connect prod-api</span>
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

    <!-- Multiple Ways to Integrate -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-lg font-bold text-white mb-3">Three ways to integrate</h2>
        <p class="text-gray-500 text-sm">CLI for developers. SDK for automation. MCP for AI agents.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- CLI -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">Command Line</h3>
              <p class="text-gray-500 text-sm">For developers</p>
            </div>
          </div>
          <div class="bg-black/40 rounded-lg p-4 font-mono text-xs space-y-1">
            <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect up</span></div>
            <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect prod-db</span></div>
            <div class="text-emerald-300">✓ Connected on localhost:5432</div>
          </div>
          <p class="text-gray-500 text-xs mt-4">Install once, reach any service by name. Works on laptops, servers, CI runners.</p>
        </div>

        <!-- SDK -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">TypeScript SDK</h3>
              <p class="text-gray-500 text-sm">For platform teams</p>
            </div>
          </div>
          <div class="bg-black/40 rounded-lg p-4 font-mono text-xs space-y-1">
            <div><span class="text-purple-300">const</span> db = <span class="text-purple-300">await</span> <span class="text-blue-300">connect</span>(<span class="text-amber-300">'prod-db'</span>);</div>
            <div><span class="text-gray-400">console</span>.<span class="text-blue-300">log</span>(db.<span class="text-gray-300">connectionString</span>);</div>
            <div class="text-emerald-300">// postgres://localhost:5432/...</div>
          </div>
          <p class="text-gray-500 text-xs mt-4">Programmatic access for scripts, CI/CD, and orchestration. <code class="bg-black/40 px-1.5 py-0.5 rounded text-blue-300">npm i @privateconnect/sdk</code></p>
        </div>

        <!-- MCP -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">MCP Integration</h3>
              <p class="text-gray-500 text-sm">For AI agents</p>
            </div>
          </div>
          <div class="bg-black/40 rounded-lg p-4 font-mono text-xs space-y-1">
            <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect mcp setup</span></div>
            <div class="text-emerald-300">✓ Added to Cursor config</div>
            <div class="text-gray-500 mt-1"># AI can now access services</div>
          </div>
          <p class="text-gray-500 text-xs mt-4">Let AI assistants connect to your services. Works with Cursor, Claude Desktop, any MCP client.</p>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section id="features" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
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
          <code class="text-blue-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect prod-db</code>
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
          <code class="text-purple-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect staging-api</code>
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
          <code class="text-emerald-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect prod-db</code>
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
          <code class="text-rose-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect deploy-target</code>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
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
                  <span class="text-gray-200 ml-2">connect up</span>
                </div>
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect localhost:5432</span>
                </div>
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect 3000</span>
                </div>
                <div class="text-emerald-300 pt-1">✓ Services exposed (auto-named)</div>
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
            
            <!-- Option A: connect to a service -->
            <div class="p-4 border-b border-gray-500/10">
              <div class="flex items-center gap-2 mb-2">
                <div class="shrink-0 w-5 h-5 rounded-full bg-emerald-300/10 text-emerald-300 flex items-center justify-center font-bold text-xs">A</div>
                <h3 class="font-medium text-white text-sm">Connect to a service</h3>
              </div>
              <div class="bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1.5">
                <div>
                  <span class="text-gray-500">$</span>
                  <span class="text-gray-200 ml-2">connect prod-db</span>
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

      <!-- Daily habit callout -->
      <div class="mt-10 text-center">
        <div class="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-300/5 border border-blue-300/10">
          <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <div class="text-left">
            <div class="text-sm text-white font-medium">The daily workflow</div>
            <div class="text-xs text-gray-400">Add <code class="text-blue-300 bg-black/40 px-1.5 py-0.5 rounded">pconnect.yml</code> to your repo. Run <code class="text-blue-300 bg-black/40 px-1.5 py-0.5 rounded">connect dev</code>. Same services, every machine, every time.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Workflow Section -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
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

    <!-- Built for AI Agents Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">Built for AI agents too</h2>
        <p class="text-gray-400">Same CLI, same access model. Plus governance controls you actually need.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- Left: Permission Broker -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">Permission Broker</h3>
              <p class="text-gray-500 text-sm">Wrap AI tools with policies</p>
            </div>
          </div>
          
          <div class="bg-black/40 rounded-lg p-4 mb-4">
            <div class="font-mono text-xs space-y-1">
              <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect broker opencode</span></div>
              <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect broker claude</span></div>
              <div class="text-amber-300 mt-1">⚡ Policy enforced</div>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-red-400">✕</span>
              <span class="text-gray-400">Block: .env, secrets, CI/CD</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-amber-300">?</span>
              <span class="text-gray-400">Review: config changes</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-emerald-300">✓</span>
              <span class="text-gray-400">Allow: src/**, tests/**</span>
            </div>
          </div>
        </div>

        <!-- Middle: Audit Trail -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">Audit Trail</h3>
              <p class="text-gray-500 text-sm">See what AI actually did</p>
            </div>
          </div>
          
          <div class="bg-black/40 rounded-lg p-4 mb-4">
            <div class="font-mono text-xs space-y-1">
              <div><span class="text-gray-500">$</span> <span class="text-gray-200">connect audit</span></div>
              <div class="text-gray-400 mt-1">• 14:32 write src/api.ts</div>
              <div class="text-red-400">• 14:33 blocked .env</div>
              <div class="text-gray-400">• 14:35 git commit</div>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-blue-300">✓</span>
              <span class="text-gray-400">Full action history</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-blue-300">✓</span>
              <span class="text-gray-400">What was blocked & why</span>
            </div>
          </div>
        </div>

        <!-- Right: Agent Orchestration -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white">Agent Orchestration</h3>
              <p class="text-gray-500 text-sm">Agents talk to agents</p>
            </div>
          </div>
          
          <div class="bg-black/40 rounded-lg p-4 mb-4">
            <div class="font-mono text-xs space-y-1 text-gray-300">
              <div><span class="text-purple-300">await</span> pc.agents.<span class="text-blue-300">list</span>();</div>
              <div><span class="text-purple-300">await</span> pc.agents.<span class="text-blue-300">sendMessage</span>(</div>
              <div class="pl-2">targetId, { action: <span class="text-amber-300">'deploy'</span> }</div>
              <div>);</div>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-purple-300">✓</span>
              <span class="text-gray-400">Agents discover each other</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-purple-300">✓</span>
              <span class="text-gray-400">Inter-agent messaging</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Link to full docs -->
      <div class="text-center mt-8 flex items-center justify-center gap-6">
        <a href="https://github.com/treadiehq/private-connect/blob/main/docs/broker.md" target="_blank" class="text-sm text-gray-500 hover:text-white transition-colors">
          Permission Broker docs →
        </a>
        <a href="https://github.com/treadiehq/private-connect/blob/main/docs/AI.md" target="_blank" class="text-sm text-gray-500 hover:text-white transition-colors">
          AI orchestration docs →
        </a>
      </div>
    </section>

    <!-- Control Plane Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
      <div class="text-center mb-10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">A control plane for private access</h2>
        <p class="text-gray-400">Manage agents and services programmatically. No CLI needed for end users.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- REST API -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="w-10 h-10 rounded-lg bg-cyan-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">REST API</h3>
          <p class="text-gray-500 text-sm mb-4">Full control over agents, services, and shares. Automate everything.</p>
          <div class="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-400">
            <div>GET /v1/agents</div>
            <div>GET /v1/services</div>
            <div>POST /v1/shares</div>
          </div>
        </div>

        <!-- Webhooks -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Webhooks</h3>
          <p class="text-gray-500 text-sm mb-4">React to events in real-time. Agent connected, share accessed, service down.</p>
          <div class="space-y-1.5 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-amber-300">→</span>
              <span class="text-gray-400">agent.connected</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-amber-300">→</span>
              <span class="text-gray-400">share.accessed</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-amber-300">→</span>
              <span class="text-gray-400">service.created</span>
            </div>
          </div>
        </div>

        <!-- No install for users -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">No install for users</h3>
          <p class="text-gray-500 text-sm mb-4">Share links work instantly. Recipients just click, no CLI, no signup required.</p>
          <div class="bg-black/40 rounded-lg p-3 text-xs">
            <div class="text-emerald-300 break-all">https://link.privateconnect.co/abc123</div>
            <div class="text-gray-600 mt-1">Works in any browser</div>
          </div>
        </div>
      </div>

      <!-- API docs link -->
      <div class="text-center mt-8 flex items-center justify-center gap-6">
        <a href="https://api.privateconnect.co/docs" target="_blank" class="text-sm text-blue-300 hover:text-blue-200 transition-colors flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Interactive API Docs
        </a>
        <a href="https://github.com/treadiehq/private-connect/blob/main/DETAILED.md#control-api" target="_blank" class="text-sm text-gray-500 hover:text-white transition-colors">
          View on GitHub →
        </a>
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

    <!-- Pricing Section -->
    <section id="pricing" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Simple, transparent pricing</h2>
        <p class="text-gray-400 max-w-xl mx-auto">Free to start. Upgrade when you need more.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- Free Tier -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-6 flex flex-col">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-1">Free</h3>
            <p class="text-gray-500 text-sm">For individual developers</p>
          </div>
          
          <div class="mb-6">
            <span class="text-4xl font-bold text-white">$0</span>
            <span class="text-gray-500">/month</span>
          </div>

          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">2 agents</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">5 services</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Expose & reach</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Share codes</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Community support</span>
            </li>
          </ul>

          <NuxtLink to="/register" class="w-full py-2.5 px-4 text-sm rounded-lg bg-gray-500/10 border border-gray-500/10 text-white font-medium text-center hover:bg-gray-500/20 transition-colors">
            Sign Up
          </NuxtLink>
        </div>

        <!-- Pro Tier (Popular) -->
        <div class="relative bg-gray-500/5 border-2 border-blue-300/50 rounded-2xl p-6 flex flex-col">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-300 border border-blue-300 text-black text-xs font-semibold">
            Popular
          </div>
          
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-1">Pro</h3>
            <p class="text-gray-500 text-sm">For teams</p>
          </div>
          
          <div class="mb-6">
            <span class="text-4xl font-bold text-white">$30</span>
            <span class="text-gray-500">/month</span>
          </div>

          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">10 agents</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Unlimited services</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Public links (connect link)</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Daemon mode</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Subdomain proxy</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Priority support</span>
            </li>
          </ul>

          <NuxtLink to="/register" class="w-full py-2.5 px-4 text-sm rounded-lg bg-blue-300 text-black font-medium text-center hover:bg-blue-400 transition-colors">
            Sign Up
          </NuxtLink>
        </div>

        <!-- Enterprise Tier -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-6 flex flex-col">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-1">Enterprise</h3>
            <p class="text-gray-500 text-sm">For organizations</p>
          </div>
          
          <div class="mb-6">
            <span class="text-4xl font-bold text-white">Custom</span>
          </div>

          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Everything in Pro</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Unlimited agents</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Self-hosting option</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">SSO & SAML</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Audit logs</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <svg class="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-300">Dedicated support</span>
            </li>
          </ul>

          <a href="mailto:info@treadie.com" class="w-full py-2.5 px-4 text-sm rounded-lg bg-gray-500/10 border border-gray-500/10 text-white font-medium text-center hover:bg-gray-500/20 transition-colors">
            Contact Us
          </a>
        </div>
      </div>
    </section>

    <!-- Security FAQ Section -->
    <section id="security" class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-lg font-bold text-white mb-3">Frequently asked questions</h2>
        <p class="text-gray-500 text-sm">Everything you need to know about Private Connect security.</p>
      </div>

      <div class="space-y-2 text-sm">
        <!-- FAQ 0: Access Control -->
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
          <summary class="flex items-center justify-between p-5 cursor-pointer list-none">
            <span class="font-medium text-white">Who can access my exposed services?</span>
            <svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-5 pb-5 text-gray-400 text-sm leading-relaxed space-y-3">
            <p><strong class="text-white">Only authenticated members of your workspace.</strong> By default, exposed services are completely private.</p>
            <ul class="space-y-2">
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Workspace = access boundary:</strong> Only agents that have authenticated with your workspace credentials can see or reach your services.</span></li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Invisible to outsiders:</strong> Someone outside your workspace can't discover, list, or connect to your services.</span></li>
              <li class="flex items-start gap-2"><span class="text-blue-300">✓</span> <span><strong class="text-white">Public is opt-in:</strong> Use <code class="bg-black/40 px-1.5 py-0.5 rounded text-blue-300">--public</code> only when you explicitly need external access (like webhooks).</span></li>
            </ul>
            <p class="text-gray-500 text-xs">Think of it like a private Tailnet — only members can see what's inside.</p>
          </div>
        </details>

        <!-- FAQ 1 -->
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
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
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
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
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
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
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
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
        <details class="group bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
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
      <div class="text-center py-12 px-6 rounded-xl bg-gray-500/5 border border-gray-500/10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Make every service feel local</h2>
        <p class="text-gray-400 max-w-md mx-auto mb-2 text-pretty font-normal">No signup required. Working tunnel in 10 seconds.</p>
        <!-- <p class="text-xs text-gray-600 max-w-lg mx-auto mb-6">
          Like ngrok, but for <span class="text-gray-400">accessing</span> services, not just exposing them. Like Tailscale, but no mesh network to manage.
        </p> -->
        
        <!-- Primary: Try now -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
          <div 
            @click="copyTryNow"
            class="inline-flex items-center cursor-pointer bg-black/60 border border-gray-500/10 rounded-lg px-4 py-2.5 font-mono text-xs group hover:bg-gray-500/10 transition-colors"
          >
            <span class="text-gray-500 mr-2">$</span>
            <span class="text-blue-300">npx private-connect tunnel 3000</span>
            <button 
              class="ml-4 text-gray-500 hover:text-white transition-colors"
              :title="copiedTry ? 'Copied!' : 'Copy'"
            >
              <svg v-if="!copiedTry" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <svg v-else class="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Secondary: Sign up for team features -->
        <div class="flex items-center justify-center gap-3">
          <NuxtLink to="/register" 
                    class="text-sm text-white bg-gray-500/10 hover:text-gray-400 hover:bg-gray-500/10 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2">
            Get started for free
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
            </svg>
          </NuxtLink>
        </div>
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

// Copy commands
const copied = ref(false);
const copiedTry = ref(false);

const copyInstall = async () => {
  await navigator.clipboard.writeText('curl -fsSL https://privateconnect.co/install.sh | bash');
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
};

const copyTryNow = async () => {
  await navigator.clipboard.writeText('npx private-connect tunnel 3000');
  copiedTry.value = true;
  setTimeout(() => copiedTry.value = false, 2000);
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
