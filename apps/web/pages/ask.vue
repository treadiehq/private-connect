<template>
  <div class="flex items-center justify-center p-6 bg-black-main relative">
    <div class="radial-gradient absolute top-0 md:right-14 right-5"></div>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-20 relative">
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-10 text-white">
            <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2 flex items-center gap-2 justify-center">
          <span>Ask any service</span>
          <span class="text-amber-300 text-[10px] font-medium border border-amber-300/20 bg-amber-300/10 uppercase rounded-full px-2 py-1">beta</span>
        </h1>
        <p class="text-gray-400 text-sm max-w-md mx-auto">Paste a URL or hostname and a question. We check the service (read-only) and answer from what we see.</p>
      </div>
      <!-- Header -->

      <!-- Form -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-6">
        <div class="space-y-4">
          <div>
            <label for="service" class="block text-sm font-medium text-gray-300 mb-1">Service</label>
            <input
              id="service"
              v-model="service"
              type="text"
              placeholder="https://api.example.com or my-api.internal"
              class="w-full bg-[#09090b]/50 border border-gray-500/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 font-mono text-sm"
            />
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <span class="text-gray-500 text-xs">Try:</span>
              <button
                v-for="ex in exampleServices"
                :key="ex.url"
                type="button"
                class="text-xs text-blue-300 hover:text-blue-400 border border-gray-500/20 hover:border-blue-300/20 rounded-full px-3 py-1 transition-colors"
                @click="service = ex.url"
              >
                {{ ex.label }}
              </button>
            </div>
          </div>
          <div>
            <label for="question" class="block text-sm font-medium text-gray-300 mb-1">Question</label>
            <textarea
              id="question"
              v-model="question"
              rows="3"
              placeholder="e.g. Is it healthy? What version is running?"
              class="w-full bg-[#09090b]/50 border border-gray-500/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 resize-none text-sm"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-gray-500 text-xs">Example questions:</span>
              <button
                v-for="ex in exampleQuestions"
                :key="ex"
                type="button"
                class="text-xs text-blue-300 hover:text-blue-400 border border-gray-500/20 hover:border-blue-300/20 rounded-full px-3 py-1 transition-colors"
                @click="question = ex"
              >
                {{ ex }}
              </button>
            </div>
            <button
              type="button"
              :disabled="loading"
              class="px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              @click="submit"
            >
              {{ loading ? 'Checking…' : 'Ask' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-6 p-4 rounded-xl bg-red-400/10 border border-red-400/10 text-red-400 text-sm">
        {{ error }}
      </div>

      <!-- Response card -->
      <div v-if="result" class="space-y-4">
        <!-- 1. Answer (assertive, prominent) -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <p class="text-xl font-semibold text-white">{{ result.answer }}</p>
        </div>

        <!-- 2. What I checked -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
          <h3 class="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span class="text-emerald-300">✓</span> What I checked
          </h3>
          <ul class="space-y-3">
            <li
              v-for="(r, i) in result.receipts"
              :key="i"
              class="border border-gray-500/20 rounded-lg overflow-hidden"
            >
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-[#09090b]/30 text-sm">
                <span class="font-mono font-medium text-white">{{ r.method }} {{ r.path }}</span>
                <span :class="r.ok ? 'text-emerald-300' : 'text-red-400'">
                  {{ r.status ?? r.error ?? '—' }}
                </span>
                <span class="text-gray-500">{{ r.latencyMs }}ms</span>
              </div>
              <pre
                v-if="r.bodySnippet"
                class="px-4 py-2 text-xs text-gray-400 font-mono overflow-x-auto border-t border-gray-500/20 bg-[#09090b]/20"
              >{{ r.bodySnippet }}</pre>
            </li>
          </ul>
        </div>

        <!-- 3. What I didn't do (visible restraint) — only if there are blocked actions -->
        <div
          v-if="result.blockedActions && result.blockedActions.length > 0"
          class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6"
        >
          <h3 class="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span class="text-red-400">✗</span> What I didn't do
          </h3>
          <ul class="space-y-2 text-sm">
            <li
              v-for="(action, i) in result.blockedActions"
              :key="i"
              class="flex items-center gap-2 text-gray-400"
            >
              <span class="text-red-400 font-bold">✗</span>
              <span class="font-mono">{{ action.method }} {{ action.path }}</span>
              <span class="text-gray-500">— {{ action.reason }}</span>
            </li>
          </ul>
          <p class="text-xs text-gray-500 mt-3">Read-only mode. Only GET requests are allowed.</p>
        </div>

        <!-- 4. Subtle conversion hook (only when reachable) -->
        <div
          v-if="result.reachability.classification === 'PUBLIC_OR_LOCAL'"
          class="text-center py-2"
        >
          <p class="text-xs text-gray-500">
            Want AI to safely access private services?
            <NuxtLink to="/install" class="text-blue-300 hover:text-blue-200">Enable Private Connect</NuxtLink>
          </p>
        </div>

        <!-- Phase 1: CTA when unreachable -->
        <div
          v-if="result.reachability.classification === 'UNREACHABLE_OR_PRIVATE'"
          class="bg-blue-300/10 border border-blue-300/30 rounded-xl p-6 space-y-4"
        >
          <h2 class="text-lg font-semibold text-white">Enable Private Connect to access private services safely</h2>
          <p class="text-gray-300 text-sm">This service isn’t reachable from the public internet. Install Private Connect, then retry.</p>
          <button
            type="button"
            class="px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-400 transition-colors"
            @click="showSetup = true"
          >
            Enable Private Connect
          </button>

          <!-- 2-step setup (in-page) -->
          <div v-if="showSetup" class="border-t border-blue-300/20 pt-4 mt-4 space-y-4">
            <div>
              <p class="text-sm font-medium text-gray-300 mb-2">1. Install</p>
              <div class="flex items-center gap-2 flex-wrap">
                <code class="flex-1 min-w-0 bg-[#09090b]/50 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono break-all">
                  curl -fsSL https://privateconnect.co/install.sh | bash
                </code>
                <button
                  type="button"
                  class="px-3 py-2 bg-gray-500/20 text-gray-300 text-xs rounded-lg hover:bg-gray-500/30 transition-colors"
                  @click="copyInstall"
                >
                  {{ copiedInstall ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-300 mb-2">2. Connect</p>
              <div class="flex items-center gap-2 flex-wrap">
                <code class="flex-1 min-w-0 bg-[#09090b]/50 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">connect up</code>
                <button
                  type="button"
                  class="px-3 py-2 bg-gray-500/20 text-gray-300 text-xs rounded-lg hover:bg-gray-500/30 transition-colors"
                  @click="copyConnect"
                >
                  {{ copiedConnect ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
          </div>
          <div class="border-t border-blue-300/20 pt-4 mt-4">
            <button
              type="button"
              class="px-4 py-2 border border-gray-500/30 text-gray-300 text-sm rounded-lg hover:bg-gray-500/10 transition-colors"
              @click="retry"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
      <div class="text-gray-400 mt-6">
				<a class="flex items-center justify-center gap-2 hover:text-white text-sm" href="/" rel="noopener noreferrer">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
						<path d="M16.555 5.412a8.028 8.028 0 0 0-3.503-2.81 14.899 14.899 0 0 1 1.663 4.472 8.547 8.547 0 0 0 1.84-1.662ZM13.326 7.825a13.43 13.43 0 0 0-2.413-5.773 8.087 8.087 0 0 0-1.826 0 13.43 13.43 0 0 0-2.413 5.773A8.473 8.473 0 0 0 10 8.5c1.18 0 2.304-.24 3.326-.675ZM6.514 9.376A9.98 9.98 0 0 0 10 10c1.226 0 2.4-.22 3.486-.624a13.54 13.54 0 0 1-.351 3.759A13.54 13.54 0 0 1 10 13.5c-1.079 0-2.128-.127-3.134-.366a13.538 13.538 0 0 1-.352-3.758ZM5.285 7.074a14.9 14.9 0 0 1 1.663-4.471 8.028 8.028 0 0 0-3.503 2.81c.529.638 1.149 1.199 1.84 1.66ZM17.334 6.798a7.973 7.973 0 0 1 .614 4.115 13.47 13.47 0 0 1-3.178 1.72 15.093 15.093 0 0 0 .174-3.939 10.043 10.043 0 0 0 2.39-1.896ZM2.666 6.798a10.042 10.042 0 0 0 2.39 1.896 15.196 15.196 0 0 0 .174 3.94 13.472 13.472 0 0 1-3.178-1.72 7.973 7.973 0 0 1 .615-4.115ZM10 15c.898 0 1.778-.079 2.633-.23a13.473 13.473 0 0 1-1.72 3.178 8.099 8.099 0 0 1-1.826 0 13.47 13.47 0 0 1-1.72-3.178c.855.151 1.735.23 2.633.23ZM14.357 14.357a14.912 14.912 0 0 1-1.305 3.04 8.027 8.027 0 0 0 4.345-4.345c-.953.542-1.971.981-3.04 1.305ZM6.948 17.397a8.027 8.027 0 0 1-4.345-4.345c.953.542 1.971.981 3.04 1.305a14.912 14.912 0 0 0 1.305 3.04Z" />
					</svg>
					Go to privateconnect.co →
				</a>
			</div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Ask - Private Connect',
});

definePageMeta({
  layout: false,
});

const config = useRuntimeConfig();
const apiBase = config.public.apiBase || config.public.apiUrl || 'http://localhost:3001';

const service = ref('');
const question = ref('');
const loading = ref(false);
const error = ref('');
const result = ref<{
  answer: string;
  baseUrl: string;
  receipts: Array<{
    method: string;
    path: string;
    url: string;
    status: number | null;
    latencyMs: number;
    ok: boolean;
    error?: string;
    bodySnippet?: string;
  }>;
  reachability: { reachable: boolean; classification: string; reason?: string };
  blockedActions: Array<{ method: string; path: string; reason: string }>;
} | null>(null);
const showSetup = ref(false);
const copiedInstall = ref(false);
const copiedConnect = ref(false);

const exampleServices = [
  { label: 'GitHub API', url: 'https://api.github.com' },
  { label: 'OpenAI Status', url: 'https://status.openai.com' },
  { label: 'SpaceX API', url: 'https://api.spacexdata.com' },
  { label: 'npm Registry', url: 'https://registry.npmjs.org' },
  { label: 'Railway API', url: 'https://api.railway.app' },
  { label: 'Cloudflare API', url: 'https://api.cloudflare.com' },
];

const exampleQuestions = [
  'Is it healthy?',
  'What version is it?',
  'Why is it failing?',
];

async function submit() {
  const s = (service.value || '').trim();
  const q = (question.value || '').trim();
  if (!s || !q) {
    error.value = 'Service and question are required.';
    return;
  }
  error.value = '';
  result.value = null;
  loading.value = true;
  try {
    const res = await fetch(`${apiBase}/v1/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: s, question: q }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.message || data.error || `Request failed (${res.status})`;
      return;
    }
    result.value = data;
    showSetup.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Request failed';
  } finally {
    loading.value = false;
  }
}

function retry() {
  submit();
}

const installCmd = 'curl -fsSL https://privateconnect.co/install.sh | bash';
const connectCmd = 'connect up';

function copyInstall() {
  navigator.clipboard.writeText(installCmd);
  copiedInstall.value = true;
  setTimeout(() => { copiedInstall.value = false; }, 2000);
}

function copyConnect() {
  navigator.clipboard.writeText(connectCmd);
  copiedConnect.value = true;
  setTimeout(() => { copiedConnect.value = false; }, 2000);
}
</script>
