<template>
  <div class="min-h-screen bg-black relative">
    <div class="radial-gradient absolute top-0 md:right-14 right-5"></div>
    <!-- Navigation -->
    <nav class=" bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-15">
          <!-- Logo -->
          <div class="flex items-center">
            <NuxtLink to="/" class="text-xl font-semibold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
              </svg>
              <span class="text-base font-semibold text-white">Private Connect</span>
            </NuxtLink>
          </div>
          
          <!-- Navigation -->
          <nav class="flex items-center space-x-4">
            <a href="https://github.com/treadiehq/private-connect" class="text-gray-500 hover:text-white transition-colors cursor-pointer" title="GitHub" target="_blank" rel="noopener noreferrer">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
                </svg>
            </a>
            <NuxtLink to="/login" class="text-sm border font-medium flex items-center gap-2 rounded-lg bg-gray-500/10 border-gray-500/10 text-white hover:bg-gray-500/20 transition-colors py-1.5 px-4">
              <span>Sign In</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
              </svg>
            </NuxtLink>
          </nav>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-10 antialiased">
      <div class="text-center">
        <!-- Problem badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/10 text-gray-500 text-xs font-medium mb-8">
          <!-- <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg> -->
          <span>No more "can you SSH into prod and curl that for me?"</span>
        </div>
        
        <h1 class="mx-auto w-full text-balance text-center font-semibold tracking-tight text-white text-2xl !leading-[1.2] sm:text-4xl md:text-5xl">
          Access any service,<br/>
          <span class="text-blue-300">from anywhere</span>
        </h1>
        
        <p class="font-normal text-center text-gray-400 max-w-lg mx-auto mb-1 sm:mt-4 text-pretty text-base sm:text-lg sm:leading-6">
          Your database is on a private network. Your API runs behind a firewall. 
          <span class="text-white">Private Connect lets you reach them securely</span>, no VPN setup, no firewall rules, no opening ports.
        </p>

        <!-- CTA buttons -->
        <!-- <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <NuxtLink to="/register" 
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-base hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/25">
            Get Started — Free
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </NuxtLink>
          <a href="https://github.com/treadiehq/private-connect" target="_blank"
             class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-base hover:bg-white/10 transition-all">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
            </svg>
            View on GitHub
          </a>
        </div> -->

        <!-- <p class="text-sm text-gray-500">Open source · Self-hostable · Free for personal use</p> -->
      </div>
    </section>

    <!-- The Problem / Solution Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
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
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
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
    <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
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

    <!-- Simple CTA Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="text-center py-12 px-6 rounded-xl bg-gray-500/10 border border-gray-500/10">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to stop the SSH dance?</h2>
        <p class="text-gray-400 max-w-md mx-auto mb-8">Set up in under a minute. No credit card required.</p>
        <NuxtLink to="/register" 
                  class="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all">
          Get Started
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
          </svg>
          <!-- <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg> -->
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-gray-500/10 mt-8">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm text-gray-500">© 2025 Treadie, Inc.</p>
          <div class="flex items-center gap-6">
            <a href="https://discord.gg/KqdBcqRk5E" target="_blank" class="text-gray-400 hover:text-white transition-colors">
              <svg viewBox="0 0 20 20" class="h-5 w-5" fill="currentColor">
                <path d="M16.238 4.515a14.842 14.842 0 0 0-3.664-1.136.055.055 0 0 0-.059.027 10.35 10.35 0 0 0-.456.938 13.702 13.702 0 0 0-4.115 0 9.479 9.479 0 0 0-.464-.938.058.058 0 0 0-.058-.027c-1.266.218-2.497.6-3.664 1.136a.052.052 0 0 0-.024.02C1.4 8.023.76 11.424 1.074 14.782a.062.062 0 0 0 .024.042 14.923 14.923 0 0 0 4.494 2.272.058.058 0 0 0 .064-.02c.346-.473.654-.972.92-1.496a.057.057 0 0 0-.032-.08 9.83 9.83 0 0 1-1.404-.669.058.058 0 0 1-.006-.096c.094-.07.189-.144.279-.218a.056.056 0 0 1 .058-.008c2.946 1.345 6.135 1.345 9.046 0a.056.056 0 0 1 .059.007c.09.074.184.149.28.22a.058.058 0 0 1-.006.095 9.224 9.224 0 0 1-1.405.669.058.058 0 0 0-.033.033.056.056 0 0 0 .002.047c.27.523.58 1.022.92 1.495a.056.056 0 0 0 .062.021 14.878 14.878 0 0 0 4.502-2.272.055.055 0 0 0 .016-.018.056.056 0 0 0 .008-.023c.375-3.883-.63-7.256-2.662-10.246a.046.046 0 0 0-.023-.021Zm-9.223 8.221c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.717 1.814-1.618 1.814Zm5.981 0c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.71 1.814-1.618 1.814Z"/>
              </svg>
            </a>
            <a href="https://github.com/treadiehq/private-connect" target="_blank" class="text-gray-400 hover:text-white transition-colors">
              <svg viewBox="0 0 14 14" class="h-4 w-4" fill="currentColor">
                <path d="M7 .175c-3.872 0-7 3.128-7 7 0 3.084 2.013 5.71 4.79 6.65.35.066.482-.153.482-.328v-1.181c-1.947.415-2.363-.941-2.363-.941-.328-.81-.787-1.028-.787-1.028-.634-.438.044-.416.044-.416.7.044 1.071.722 1.071.722.635 1.072 1.641.766 2.035.59.066-.459.24-.765.437-.94-1.553-.175-3.193-.787-3.193-3.456 0-.766.262-1.378.721-1.881-.065-.175-.306-.897.066-1.86 0 0 .59-.197 1.925.722a6.754 6.754 0 0 1 1.75-.24c.59 0 1.203.087 1.75.24 1.335-.897 1.925-.722 1.925-.722.372.963.131 1.685.066 1.86.46.48.722 1.115.722 1.88 0 2.691-1.641 3.282-3.194 3.457.24.219.481.634.481 1.29v1.926c0 .197.131.415.481.328C11.988 12.884 14 10.259 14 7.175c0-3.872-3.128-7-7-7z" fill-rule="evenodd"/>
              </svg>
            </a>
            <a href="https://twitter.com/treadieinc" target="_blank" class="text-gray-400 hover:text-white transition-colors">
              <svg fill="currentColor" class="h-4 w-4" viewBox="0 0 22 20">
                <path d="M16.99 0H20.298L13.071 8.26L21.573 19.5H14.916L9.702 12.683L3.736 19.5H0.426L8.156 10.665L0 0H6.826L11.539 6.231L16.99 0ZM15.829 17.52H17.662L5.83 1.876H3.863L15.829 17.52Z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
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
