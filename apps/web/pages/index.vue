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
          <div class="text-xs text-gray-600 mt-2">
            <NuxtLink to="/install" class="text-gray-500 hover:text-gray-300 underline">Manual download</NuxtLink> for production environments
          </div>
        </div>

        <!-- CTA buttons -->
        <div class="flex items-center justify-center gap-3 mt-6">
          <NuxtLink to="/register" target="_blank" class="text-sm justify-center bg-white font-medium rounded-lg cursor-pointer flex items-center gap-2 text-black hover:bg-gray-300 py-2 px-4">
            <span>Get started for free</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="relative overflow-hidden bg-blue-300 rounded-xl">
        <div class="p-1 rounded-lg">
          <img src="/img/screenshot.png" alt="Private Connect" class="w-full h-full object-cover rounded-lg">
        </div>
      </div>
    </section>

    <!-- What It Is Section -->
    <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-xl font-semibold text-white mb-2">What is Private Connect?</h2>
        <p class="text-gray-500 text-sm mb-4 max-w-lg mx-auto">Private Connect is a tunnel agent that lets you access private services by name from anywhere. Like Tailscale, but for services, not networks.</p>
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4 max-w-2xl mx-auto mt-4">
          <p class="text-gray-300 text-xs mb-2"><strong class="text-white">Example:</strong> Have a local database but need to access it from another machine?</p>
          <div class="bg-black/40 rounded p-3 font-mono text-xs space-y-1">
            <div class="text-gray-500"># On your local machine:</div>
            <div><span class="text-gray-400">$</span> <span class="text-emerald-300">connect localhost:5432 --name my-db</span></div>
            <div class="text-gray-500 mt-2"># From anywhere (works with Tailscale):</div>
            <div><span class="text-gray-400">$</span> <span class="text-blue-300">connect my-db</span></div>
            <div class="text-gray-500 text-xs mt-2"># no port forwarding, no firewall rules, no changing localhost to 0.0.0.0</div>
          </div>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
        <ul class="space-y-3 text-sm">
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Access by name:</strong> <code class="bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">connect prod-db</code> instead of remembering IPs or ports</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Onboard teammates in 30 seconds:</strong> <code class="bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">connect clone alice</code> gives them your exact setup</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Share instantly:</strong> <code class="bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">connect share</code> → teammate runs <code class="bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">connect join</code>, same environment</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Works with any infrastructure:</strong> AWS, exe.dev, DigitalOcean, your local machine, or anywhere, works regardless of where services run</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Solves a daily problem:</strong> Access private services is something you need constantly, not just when setting up infrastructure</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">No port conflicts:</strong> Services stay connected via background daemon</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Bidirectional:</strong> Access remote services, not just expose local ones (unlike ngrok)</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-emerald-300 mt-0.5">•</span>
            <span class="text-gray-400"><strong class="text-white">Private by default:</strong> Workspace isolation, not public URLs</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- What You Can Do Section -->
    <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
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
          <code class="text-xs font-mono text-emerald-300 bg-black/40 px-2 py-1 rounded block mb-2">connect 5432 --name prod-db</code>
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

        <!-- Debug -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-md bg-rose-300/10 flex items-center justify-center">
              <svg class="w-3 h-3 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <h3 class="font-medium text-white text-sm">Debug</h3>
          </div>
          <code class="text-xs font-mono text-rose-300 bg-black/40 px-2 py-1 rounded block mb-2">connect expose 3000 --debug</code>
          <p class="text-xs text-gray-500">See live traffic. Share with teammates. AI explains errors.</p>
        </div>
      </div>

      <!-- Works everywhere callout -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-600">
          Works on <span class="text-gray-400">laptops</span>, <span class="text-gray-400">servers</span>, <span class="text-gray-400">CI/CD runners</span>, and <span class="text-gray-400">AI agents</span>.
        </p>
      </div>
    </section>

    <!-- Works with: remote dev → private backend -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
      <div class="text-center mb-10">
        <h2 class="text-xl font-semibold text-white mb-2">Reach private backends from anywhere you code</h2>
        <p class="text-gray-500 text-sm max-w-sm mx-auto">Your app runs in the cloud. Your database doesn't. One command connects them.</p>
        <!-- <p class="text-gray-600 text-xs max-w-md mx-auto mt-2">Whether your backend is a <span class="text-gray-400">Mac Mini running OpenClaw</span>, a laptop with Postgres, or a server in AWS—same flow.</p> -->
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/sprites-and-private-connect.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <svg class="relative top-px w-auto h-6" viewBox="0 0 724 582" fill-rule="evenodd">
            <g>
              <path d="M205.594 197.898h322.661v108.263H205.594z"></path>
              <path d="M578.582 508.799h-72.323v72.686h72.323v-72.686zm-361.614 0h-72.323v72.686h72.323v-72.686zm361.614-290.742h72.323v145.371h-72.323v72.686h-74.229 1.906v72.685H216.968v-72.685h-72.323v-72.686H72.323V218.057h72.322v-73.163h72.323V72.686h72.323v72.685h144.645V72.686h72.323v72.685h72.323v72.686zM72.323 508.799V363.428H0v145.371h72.323zm650.904 0V363.428h-72.322v145.371h72.322zM289.423 290.742h-.132.132zm-72.455-72.685h72.323v72.685h-72.323v-72.685zm216.968 0h72.323v72.685h-72.323v-72.685zM578.582 0h-72.323v72.686h72.323V0zM216.968 0h-72.323v72.686h72.323V0z" class="fill-green-600"></path>
              <path d="M144.645 363.428V218.057h72.323v-72.686h289.291v72.686h72.323v72.685l-.001.001v72.685h-72.322v72.686h-72.323V508.8H289.291v-72.686h-72.323v-72.686h-72.323zm144.646-72.686h-72.323v-72.685h72.323v72.685zm216.968 0h-72.323v-72.685h72.323v72.685z" class="fill-green-500"></path>
            </g>
          </svg>
          <!-- <img src="https://logo.clearbit.com/fly.io" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'"> -->
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">Sprites</div>
            <p class="text-xs text-gray-500">Reach your DB, API or other services from a stateful sandbox</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/exe-dev-private-access.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <img src="/img/exe.png" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">exe.dev</div>
            <p class="text-xs text-gray-500">Access private services from exe.dev VMs</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/openclaw-remote-access.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <img src="/img/openclaw.jpg" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">OpenClaw</div>
            <p class="text-xs text-gray-500">Run OpenClaw at home, reach it from Sprites, Cursor, anywhere</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/database-and-cursor.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <img src="/img/cursor.jpg" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">Cursor</div>
            <p class="text-xs text-gray-500">Connect Cursor (and agents) to your DB</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/tailscale-and-private-connect.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <img src="/img/tailscale.jpg" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">Tailscale</div>
            <p class="text-xs text-gray-500">Service-level access on top of Tailscale</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/opencode-remote-access.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <img src="/img/opencode.png" alt="" class="w-9 h-9 rounded-lg shrink-0 bg-white/5 object-contain" loading="lazy" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">OpenCode</div>
            <p class="text-xs text-gray-500">Access your OpenCode server from anywhere, laptop, phone, or any device</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/kubernetes-virtual-clusters-and-private-connect.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <div class="w-9 h-9 rounded-lg shrink-0 bg-white/5 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">Kubernetes</div>
            <p class="text-xs text-gray-500">Multicluster Kubernetes (kplane) API server and nodes over private tunnels, no VPN</p>
          </div>
        </a>
        <a
          href="https://github.com/treadiehq/private-connect/blob/main/docs/family-abroad.md"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 hover:border-gray-500/25 hover:bg-gray-500/10 transition-all text-left group flex items-start gap-3"
        >
          <div class="w-9 h-9 rounded-lg shrink-0 bg-white/5 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008H17.25v-.008z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="font-medium text-white text-sm mb-0.5 group-hover:text-blue-300 transition-colors">Family abroad</div>
            <p class="text-xs text-gray-500">Share your home (Plex, NAS, etc.) with family abroad, no VPN setup</p>
          </div>
        </a>
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

    <!-- Project Dev Mode Section -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 hidden">
      <div class="text-center mb-10">
        <h2 class="text-xl sm:text-2xl font-semibold text-white mb-3">Same setup, every developer</h2>
        <p class="text-gray-500 text-sm max-w-xl mx-auto">Add one file to your repo. Every developer gets the same services, same ports, every time.</p>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6 mb-6">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-white mb-3">Add pconnect.yml to your repo</h3>
            <div class="bg-black/40 rounded-lg p-4 font-mono text-xs mb-3">
              <div class="text-gray-500 mb-2"># pconnect.yml</div>
              <div><span class="text-purple-300">services</span><span class="text-gray-400">:</span></div>
              <div class="ml-2"><span class="text-gray-400">-</span> <span class="text-cyan-300">name</span><span class="text-gray-400">:</span> <span class="text-amber-300">staging-db</span></div>
              <div class="ml-4"><span class="text-cyan-300">port</span><span class="text-gray-400">:</span> <span class="text-emerald-300">5432</span></div>
              <div class="ml-2"><span class="text-gray-400">-</span> <span class="text-cyan-300">name</span><span class="text-gray-400">:</span> <span class="text-amber-300">redis</span></div>
              <div class="ml-4"><span class="text-cyan-300">port</span><span class="text-gray-400">:</span> <span class="text-emerald-300">6379</span></div>
            </div>
            <p class="text-gray-500 text-xs">One file. Same services for everyone. Commit it to git.</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-white mb-3">Run connect dev</h3>
            <div class="bg-black/40 rounded-lg p-4 font-mono text-xs space-y-1 mb-3">
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect dev</span></div>
              <div class="text-emerald-300">✓ staging-db → localhost:5432</div>
              <div class="text-emerald-300">✓ redis → localhost:6379</div>
              <div class="text-emerald-300">✓ user-api → localhost:8080</div>
            </div>
            <p class="text-gray-500 text-xs">All services connected. Your app works. No manual setup.</p>
          </div>
        </div>
      </div>

      <div class="mt-6 text-center">
        <p class="text-xs text-gray-600">
          Clone a repo → <span class="text-gray-400">connect dev</span> → Start coding. That's it.
        </p>
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
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
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
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
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
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"New dev starts Monday. Setup takes a day."</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">VPN, SSH keys, firewall rules, /etc/hosts... They could be coding instead.</p>
          <code class="text-amber-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect join x7k9m2</code>
        </div>

        <!-- Use case 4: Live Debugging -->
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center mb-4">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">"I can see the request, but why is it failing?"</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">Share a live traffic viewer with your teammate. AI analyzes and explains the error.</p>
          <code class="text-emerald-300 text-xs font-mono bg-black/40 px-2 py-1 rounded-md">connect expose 3000 --debug</code>
        </div>

        <!-- Use case 5: Contractor access -->
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
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
        <div class="group p-5 rounded-xl bg-gray-500/5 border border-gray-500/10 transition-all">
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
    <section id="security" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
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
            <p class="text-gray-500 text-xs">Think of it like a private Tailnet, only members can see what's inside.</p>
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
