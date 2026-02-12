<template>
  <div class="min-h-screen bg-black">
    <LandingHeader />
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pt-24">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mt-4 mb-2">Set up with AI</h1>
        <p class="text-gray-400">Copy the CLI commands or paste an AI prompt into Cursor, Copilot, or your assistant of choice.</p>
      </div>

      <!-- CLI code -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Install and connect in two commands</h2>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-500/20 text-gray-300 text-xs rounded-lg hover:bg-gray-500/30 transition-colors"
            @click="copyCli"
          >
            <svg v-if="!copiedCli" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {{ copiedCli ? 'Copied!' : 'Copy CLI code' }}
          </button>
        </div>
        <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-1">
          <div><span class="text-gray-500">$</span> <span class="text-gray-300">curl -fsSL https://privateconnect.co/install.sh | bash</span></div>
          <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect up</span></div>
        </div>
        <p class="mt-3 text-xs text-gray-500">
          <a href="https://github.com/treadiehq/private-connect/blob/main/scripts/install.sh" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-blue-300 underline underline-offset-2">View install script source</a>
          <span class="mx-1.5">·</span>
          <NuxtLink to="/install" class="text-gray-400 hover:text-blue-300 underline underline-offset-2">Manual download</NuxtLink>
        </p>
      </div>

      <!-- Main AI prompt -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-10">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Try with your AI tool of choice</h2>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-300/20 border border-blue-300/30 text-blue-300 text-xs font-medium rounded-lg hover:bg-blue-300/30 transition-colors"
            @click="copyMainPrompt"
          >
            <svg v-if="!copiedMainPrompt" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {{ copiedMainPrompt ? 'Copied!' : 'Copy AI prompt' }}
          </button>
        </div>
        <p class="text-gray-500 text-sm mb-4">Copy this prompt to your AI code editor (Cursor, Copilot, etc.) to set up Private Connect automatically:</p>
        <pre class="bg-black/50 rounded-lg p-4 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{{ MAIN_PROMPT }}</pre>
      </div>

      <!-- More examples -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold text-white mb-2">More examples</h2>
        <p class="text-gray-500 text-sm">
          Copy any prompt below into Cursor, Copilot, or your AI assistant to get step-by-step instructions for that use case.
        </p>
      </div>

      <div class="space-y-4">
        <div
          v-for="(example, i) in moreExamples"
          :key="i"
          class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6"
        >
          <div class="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 class="text-base font-semibold text-white">{{ example.title }}</h3>
              <p class="text-gray-400 text-sm mt-1">{{ example.description }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-300/20 border border-blue-300/30 text-blue-300 text-xs font-medium rounded-lg hover:bg-blue-300/30 transition-colors"
              @click="copyExamplePrompt(example.prompt, i)"
            >
              <svg v-if="copiedExampleIndex !== i" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ copiedExampleIndex === i ? 'Copied!' : 'Copy AI prompt' }}
            </button>
          </div>
          <pre class="bg-black/50 rounded-lg p-4 font-mono text-xs text-gray-400 leading-relaxed whitespace-pre-wrap break-words">{{ example.prompt }}</pre>
        </div>
      </div>

      <div class="mt-10 text-center">
        <NuxtLink
          to="/install"
          class="text-sm text-gray-500 hover:text-blue-300 transition-colors"
        >
          Manual install (all platforms) →
        </NuxtLink>
      </div>
    </div>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Set up with AI - Private Connect',
  meta: [
    { name: 'description', content: 'Copy CLI commands or AI prompts to set up Private Connect with Cursor, Copilot, or your AI assistant.' },
  ],
});

definePageMeta({
  layout: false,
});

const MAIN_PROMPT = `Set up Private Connect on this machine. Run these steps in order:

1. Install the CLI: curl -fsSL https://privateconnect.co/install.sh | bash
2. Authenticate: run "connect up" — this will open a browser window for login. Wait for me to complete it.
3. Scaffold the project config: run "connect dev --init" in my project directory. This creates a pconnect.yml pre-populated with my workspace's available services.
4. Connect to services: run "connect dev" to create local tunnels to every service in pconnect.yml.

After step 4, each service is available at localhost on its configured port (e.g. staging-db on localhost:5432). Show me the connection details when done.`;

const CLI_CODE = `curl -fsSL https://privateconnect.co/install.sh | bash
connect up`;

const EXPOSE_PROMPT = `I have Private Connect installed and authenticated (via "connect up"). I want to expose my local web app so it can receive webhooks from Stripe.

Create a file called pconnect.yml in my project root with this structure:

expose:
  web:
    target: localhost:3000
    public: true

Then run "connect serve". The output will show a public URL like https://abc123.privateconnect.co — that's the webhook URL. Tell me the exact URL from the output so I can paste it into my Stripe webhook dashboard settings.`;

const DB_PROMPT = `I have Private Connect installed and authenticated (via "connect up"). My team has a staging Postgres database exposed as "staging-db" through Private Connect.

Create or update pconnect.yml in my project root:

services:
  - name: staging-db
    port: 5432

Then run "connect dev". Once it connects, the database is available at localhost:5432. Show me:
1. The psql connection command: psql -h localhost -p 5432 -U <user> -d <dbname>
2. A DATABASE_URL I can put in .env: postgres://<user>:<password>@localhost:5432/<dbname>`;

const SHARE_PROMPT = `I have Private Connect running with services exposed. I want to share my environment with a teammate so they get the same services I have.

Run "connect share" to generate a share code. Then tell me:
1. The share code from the output — I'll send this to my teammate
2. The command they need to run: connect join <the-code>
3. How to revoke the share later: connect share --revoke <the-code>

The share expires after 24 hours by default. To set a different duration, use: connect share --expires 7d`;

const moreExamples = [
  {
    title: 'Expose local app and receive webhooks',
    description: 'Make your local app reachable via a public URL so Stripe, GitHub, etc. can send webhooks to it.',
    prompt: EXPOSE_PROMPT,
  },
  {
    title: 'Access a staging database locally',
    description: 'Connect to your team\'s staging Postgres (or any database) from your local machine via Cursor.',
    prompt: DB_PROMPT,
  },
  {
    title: 'Share your environment with a teammate',
    description: 'Give a teammate access to the same services you\'re connected to, with one command each.',
    prompt: SHARE_PROMPT,
  },
];

const copiedCli = ref(false);
const copiedMainPrompt = ref(false);
const copiedExampleIndex = ref<number | null>(null);

function copyCli() {
  navigator.clipboard.writeText(CLI_CODE);
  copiedCli.value = true;
  setTimeout(() => { copiedCli.value = false; }, 2500);
}

function copyMainPrompt() {
  navigator.clipboard.writeText(MAIN_PROMPT);
  copiedMainPrompt.value = true;
  setTimeout(() => { copiedMainPrompt.value = false; }, 2500);
}

function copyExamplePrompt(prompt: string, index: number) {
  navigator.clipboard.writeText(prompt);
  copiedExampleIndex.value = index;
  setTimeout(() => { copiedExampleIndex.value = null; }, 2500);
}
</script>
