<template>
  <div class="min-h-screen bg-black relative">
    <div class="radial-gradient absolute top-0 md:right-14 right-5"></div>
    <!-- Navigation -->
    <nav class=" bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
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
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 antialiased">
      <div class="text-center">
        <div class="">
          <h1 class="mx-auto w-full text-balance text-center font-semibold tracking-tight text-white text-2xl !leading-[1.2] sm:text-4xl md:text-5xl">
            Connect to private services<span class="text-blue-300"> from anywhere</span>
          </h1>
          
          <!-- Subheading -->
          <p class="font-normal text-center text-gray-400 max-w-md mx-auto mb-1 sm:mt-4 text-pretty text-base sm:text-lg sm:leading-6">
            Securely reach services across any environment. No VPNs, no firewall rules, no port forwarding.
          </p>
        </div>
      </div>
    </section>

    <!-- Terminal Demo -->
    <section class="mb-12 px-6">
      <div class="max-w-2xl mx-auto">
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-2xl overflow-hidden shadow-2xl">
          <!-- Terminal header -->
          <div class="flex items-center gap-2 px-4 py-3 bg-gray-500/10 border-b border-gray-500/10">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-red-400/80"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-300/80"></div>
              <div class="w-3 h-3 rounded-full bg-green-300/80"></div>
            </div>
            <!-- <span class="ml-2 text-xs text-gray-500 font-mono">terminal</span> -->
          </div>
          <!-- Terminal content -->
          <div class="p-6 font-mono text-sm space-y-4">
            <div>
              <span class="text-gray-500"># Install the CLI</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-emerald-300">$</span>
                <span class="text-gray-200">curl -fsSL https://privateconnect.co/install.sh | bash</span>
              </div>
            </div>
            <div>
              <span class="text-gray-500"># Start the agent on your server</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-emerald-400">$</span>
                <span class="text-gray-200">connect up --label prod</span>
              </div>
            </div>
            <div>
              <span class="text-gray-500"># Expose your database</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-emerald-300">$</span>
                <span class="text-gray-200">connect expose localhost:5432 --name prod-db</span>
              </div>
            </div>
            <div class="pt-4 border-t border-white/5">
              <span class="text-gray-500"># From your laptop, reach the database</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-emerald-300">$</span>
                <span class="text-gray-200">connect reach prod-db</span>
              </div>
              <div class="mt-2 text-emerald-300">
                ✓ REACHABLE — TCP OK, Latency 45ms
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <!-- <section class="py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-4">How it works</h2>
        <p class="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
          Run lightweight agents in each environment. They connect outbound to the hub — no inbound ports needed.
        </p>
        
        <div class="grid md:grid-cols-3 gap-8">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-300/10 border border-blue-300/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">1. Run agents</h3>
            <p class="text-gray-400 text-sm">
              Install the CLI and run <code class="text-blue-300">connect up</code> in each environment.
            </p>
          </div>
          
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-purple-300/10 border border-purple-300/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">2. Expose services</h3>
            <p class="text-gray-400 text-sm">
              Make local services available with <code class="text-purple-300">connect expose</code>.
            </p>
          </div>
          
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-300/10 border border-emerald-300/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">3. Reach anywhere</h3>
            <p class="text-gray-400 text-sm">
              Connect from any other agent with <code class="text-emerald-300">connect reach</code>.
            </p>
          </div>
        </div>
      </div>
    </section> -->

    <!-- Features -->
    <!-- <section class="py-20 px-6 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-16">Built for developers</h2>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div class="w-10 h-10 mb-4 rounded-xl bg-blue-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">No firewall changes</h3>
            <p class="text-gray-400 text-sm">Agents connect outbound only. No ports to open, no NAT traversal needed.</p>
          </div>
          
          <div class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div class="w-10 h-10 mb-4 rounded-xl bg-purple-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Real-time diagnostics</h3>
            <p class="text-gray-400 text-sm">DNS, TCP, TLS, and HTTP checks with latency metrics. Know exactly what's failing.</p>
          </div>
          
          <div class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div class="w-10 h-10 mb-4 rounded-xl bg-emerald-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">CLI-first</h3>
            <p class="text-gray-400 text-sm">Simple commands that work in any terminal. Perfect for scripts and CI/CD.</p>
          </div>
          
          <div class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div class="w-10 h-10 mb-4 rounded-xl bg-amber-300/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Shareable access</h3>
            <p class="text-gray-400 text-sm">Generate secure tokens to share service access with external teams.</p>
          </div>
        </div>
      </div>
    </section> -->

    <!-- CTA -->
    <!-- <section class="py-20 px-6">
      <div class="max-w-3xl mx-auto text-center">
        <h2 class="text-3xl font-bold mb-4">Ready to connect?</h2>
        <p class="text-gray-400 mb-8">Get started in minutes. Free for small teams.</p>
        <NuxtLink 
          to="/register" 
          class="inline-flex items-center gap-2 px-8 py-4 bg-blue-300 hover:bg-blue-400 text-black font-semibold rounded-xl transition-all hover:-translate-y-0.5 text-lg"
        >
          Start for Free
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </NuxtLink>
      </div>
    </section> -->

    <!-- Footer -->
    <!-- Footer -->
    <footer aria-labelledby="footer-heading" class="pt-14">
      <h2 id="footer-heading" class="sr-only">Footer</h2>
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="border-t border-transparent flex flex-col md:flex-row items-center justify-between py-6">
          <div class="flex items-center justify-center gap-3 relative">
            <p class="text-xs leading-6 font-medium text-gray-500 xl:text-center">
              &copy; 2025 Treadie, Inc.
            </p>
          </div>
          <div
            class="flex space-x-6 items-center md:mt-0 mt-4"
          >
            <a
              href="https://discord.gg/KqdBcqRk5E"
              target="_blank"
              class="text-sm font-semibold leading-6 hover:text-blue-300 text-gray-500"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" class="h-5 w-5" fill="currentColor">
                <path d="M16.238 4.515a14.842 14.842 0 0 0-3.664-1.136.055.055 0 0 0-.059.027 10.35 10.35 0 0 0-.456.938 13.702 13.702 0 0 0-4.115 0 9.479 9.479 0 0 0-.464-.938.058.058 0 0 0-.058-.027c-1.266.218-2.497.6-3.664 1.136a.052.052 0 0 0-.024.02C1.4 8.023.76 11.424 1.074 14.782a.062.062 0 0 0 .024.042 14.923 14.923 0 0 0 4.494 2.272.058.058 0 0 0 .064-.02c.346-.473.654-.972.92-1.496a.057.057 0 0 0-.032-.08 9.83 9.83 0 0 1-1.404-.669.058.058 0 0 1-.029-.046.058.058 0 0 1 .023-.05c.094-.07.189-.144.279-.218a.056.056 0 0 1 .058-.008c2.946 1.345 6.135 1.345 9.046 0a.056.056 0 0 1 .059.007c.09.074.184.149.28.22a.058.058 0 0 1 .023.049.059.059 0 0 1-.028.046 9.224 9.224 0 0 1-1.405.669.058.058 0 0 0-.033.033.056.056 0 0 0 .002.047c.27.523.58 1.022.92 1.495a.056.056 0 0 0 .062.021 14.878 14.878 0 0 0 4.502-2.272.055.055 0 0 0 .016-.018.056.056 0 0 0 .008-.023c.375-3.883-.63-7.256-2.662-10.246a.046.046 0 0 0-.023-.021Zm-9.223 8.221c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.717 1.814-1.618 1.814Zm5.981 0c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.71 1.814-1.618 1.814Z"></path>
              </svg>
            </a>
            <a
              href="https://github.com/treadiehq/private-connect"
              target="_blank"
              class="text-sm font-semibold leading-6 hover:text-blue-300 text-gray-500"
            >
              <svg
                aria-label="github"
                viewBox="0 0 14 14"
                class="h-4 w-4"
                fill="currentColor"
              >
                <path
                  d="M7 .175c-3.872 0-7 3.128-7 7 0 3.084 2.013 5.71 4.79 6.65.35.066.482-.153.482-.328v-1.181c-1.947.415-2.363-.941-2.363-.941-.328-.81-.787-1.028-.787-1.028-.634-.438.044-.416.044-.416.7.044 1.071.722 1.071.722.635 1.072 1.641.766 2.035.59.066-.459.24-.765.437-.94-1.553-.175-3.193-.787-3.193-3.456 0-.766.262-1.378.721-1.881-.065-.175-.306-.897.066-1.86 0 0 .59-.197 1.925.722a6.754 6.754 0 0 1 1.75-.24c.59 0 1.203.087 1.75.24 1.335-.897 1.925-.722 1.925-.722.372.963.131 1.685.066 1.86.46.48.722 1.115.722 1.88 0 2.691-1.641 3.282-3.194 3.457.24.219.481.634.481 1.29v1.926c0 .197.131.415.481.328C11.988 12.884 14 10.259 14 7.175c0-3.872-3.128-7-7-7z"
                  fill="currentColor"
                  fill-rule="evenodd"
                ></path>
              </svg>
            </a>
            <a
              href="https://twitter.com/treadieinc"
              target="_blank"
              class="hover:text-blue-300 text-gray-500"
            >
              <span class="sr-only">X formerly known as Twitter</span>
              <svg aria-label="X formerly known as Twitter" fill="currentColor" class="h-4 w-4" viewBox="0 0 22 20"><path d="M16.99 0H20.298L13.071 8.26L21.573 19.5H14.916L9.702 12.683L3.736 19.5H0.426L8.156 10.665L0 0H6.826L11.539 6.231L16.99 0ZM15.829 17.52H17.662L5.83 1.876H3.863L15.829 17.52Z" class="astro-3SDC4Q5U"></path></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
useHead({ 
  title: 'Private Connect - Securely connect to private services from anywhere',
  meta: [
    { name: 'description', content: 'Connect to private services across any environment. No VPNs, no firewall rules, no port forwarding.' }
  ]
})

// No layout for landing page
definePageMeta({
  layout: false,
});
</script>
