<template>
  <div class="min-h-screen bg-black">
    <LandingHeader />
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-20">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mt-4 mb-2 flex items-center gap-2">
          <span>Ask any service</span>
          <span class="text-amber-300 text-[10px] font-medium border border-amber-300/20 bg-amber-300/10 uppercase rounded-full px-2 py-1">beta</span>
        </h1>
        <p class="text-gray-400">Paste a URL or hostname and a question. We check the service (read-only) and answer from what we see.</p>
      </div>

      <!-- Form -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-6">
        <div class="space-y-4">
          <div>
            <label for="service" class="block text-sm font-medium text-gray-300 mb-1">Service</label>
            <input
              id="service"
              v-model="service"
              type="text"
              placeholder="http://localhost:3000 or my-api.internal"
              class="w-full bg-black/50 border border-gray-500/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 font-mono text-sm"
            />
          </div>
          <div>
            <label for="question" class="block text-sm font-medium text-gray-300 mb-1">Question</label>
            <textarea
              id="question"
              v-model="question"
              rows="3"
              placeholder="e.g. Is it healthy? What version is running?"
              class="w-full bg-black/50 border border-gray-500/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 resize-none text-sm"
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
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-black/30 text-sm">
                <span class="font-mono font-medium text-white">{{ r.method }} {{ r.path }}</span>
                <span :class="r.ok ? 'text-emerald-300' : 'text-red-400'">
                  {{ r.status ?? r.error ?? '—' }}
                </span>
                <span class="text-gray-500">{{ r.latencyMs }}ms</span>
              </div>
              <pre
                v-if="r.bodySnippet"
                class="px-4 py-2 text-xs text-gray-400 font-mono overflow-x-auto border-t border-gray-500/20 bg-black/20"
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
                <code class="flex-1 min-w-0 bg-black/50 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono break-all">
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
                <code class="flex-1 min-w-0 bg-black/50 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">connect up</code>
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

const exampleQuestions = [
  'Is it healthy?',
  'What version is running?',
  'Why might it be failing?',
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
