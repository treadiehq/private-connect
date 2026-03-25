<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-bold tracking-tight">AI Copilot</h1>
      <p class="text-sm text-gray-400 mt-1">Configure AI-powered debugging assistance for your debug sessions</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg class="animate-spin h-8 w-8 text-blue-300" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Error State -->
    <div v-else-if="configError" class="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <svg class="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p class="text-sm font-medium text-red-300 mb-1">Failed to load AI configuration</p>
      <p class="text-xs text-gray-500 mb-4">{{ configError }}</p>
      <button @click="loadConfig" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
        Retry
      </button>
    </div>

    <div v-else class="space-y-6">
      <!-- Provider Selection -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">AI Provider</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Ollama (Local) -->
          <button
            @click="selectProvider('ollama')"
            :class="[
              'p-4 rounded-lg border text-left transition-all',
              config.provider === 'ollama' 
                ? 'border-blue-300 bg-blue-300/10' 
                : 'border-gray-500/10 hover:border-gray-500/10'
            ]"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-emerald-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <span class="font-medium">Ollama</span>
              <span class="text-xs bg-emerald-300/20 text-emerald-300 px-2 py-0.5 rounded">Local</span>
            </div>
            <p class="text-sm text-gray-400">Run AI locally. Your data never leaves your machine.</p>
          </button>

          <!-- OpenAI -->
          <button
            @click="selectProvider('openai')"
            :class="[
              'p-4 rounded-lg border text-left transition-all',
              config.provider === 'openai' 
                ? 'border-blue-300 bg-blue-300/10' 
                : 'border-gray-500/10 hover:border-gray-500/10'
            ]"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.516 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                </svg>
              </div>
              <span class="font-medium">OpenAI</span>
            </div>
            <p class="text-sm text-gray-400">GPT-5.4 and other models. Requires API key.</p>
          </button>

          <!-- Anthropic -->
          <button
            @click="selectProvider('anthropic')"
            :class="[
              'p-4 rounded-lg border text-left transition-all',
              config.provider === 'anthropic' 
                ? 'border-blue-300 bg-blue-300/10' 
                : 'border-gray-500/10 hover:border-gray-500/10'
            ]"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-orange-300/10 flex items-center justify-center">
                <span class="text-orange-300 font-bold text-sm">A</span>
              </div>
              <span class="font-medium">Anthropic</span>
            </div>
            <p class="text-sm text-gray-400">Claude models with excellent reasoning. Requires API key.</p>
          </button>
        </div>
      </div>

      <!-- Provider Configuration -->
      <div v-if="config.provider" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">Configuration</h3>
        
        <div class="space-y-4">
          <!-- Model Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <div class="relative">
              <select
                v-model="config.model"
                class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg pl-4 pr-10 py-2.5 text-white focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer"
              >
                <option v-for="model in availableModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
              <svg class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
              </svg>
            </div>
          </div>

          <!-- API Key (for cloud providers) -->
          <div v-if="config.provider !== 'ollama'">
            <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
            <input
              v-model="config.apiKey"
              type="password"
              placeholder="Enter your API key"
              class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
            <p class="text-xs text-gray-500 mt-1">
              Your API key is encrypted and stored securely.
            </p>
          </div>

          <!-- Ollama URL -->
          <div v-if="config.provider === 'ollama'">
            <label class="block text-sm font-medium text-gray-300 mb-2">Ollama URL</label>
            <input
              v-model="config.ollamaUrl"
              type="text"
              placeholder="http://localhost:11434"
              class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
            <p class="text-xs text-gray-500 mt-1">
              Leave empty to use the default (http://localhost:11434)
            </p>
          </div>

          <!-- Auto Analyze -->
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">Auto-analyze errors</div>
              <p class="text-sm text-gray-400">Automatically analyze traffic when errors are detected</p>
            </div>
            <button
              @click="config.autoAnalyze = !config.autoAnalyze"
              :class="[
                'relative w-12 h-6 rounded-full transition-colors',
                config.autoAnalyze ? 'bg-blue-300' : 'bg-gray-500/10'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  config.autoAnalyze ? 'left-7' : 'left-1'
                ]"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex items-center justify-between">
        <div v-if="saved" class="text-green-300 text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Configuration saved
        </div>
        <div v-else-if="saveError" class="text-red-400 text-sm">{{ saveError }}</div>
        <div v-else></div>
        
        <div class="flex items-center gap-3">
          <button
            @click="testConfig"
            :disabled="!config.provider || testing"
            class="px-4 py-2 bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg v-if="testing" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <button
            @click="saveConfig"
            :disabled="!config.provider || saving"
            class="px-4 py-2 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 text-black text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg v-if="saving" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ saving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </div>

      <!-- Test Result -->
      <div v-if="testResult" class="bg-gray-500/10 border rounded-lg p-4" :class="testResult.success ? 'border-gray-500/10' : 'border-red-400'">
        <div class="flex items-center gap-2 mb-2">
          <span v-if="testResult.success" class="text-green-300 font-medium">Connection successful</span>
          <span v-else class="text-red-400 font-medium">Connection failed</span>
        </div>
        <p class="text-sm text-gray-400">{{ testResult.message }}</p>
      </div>

      <!-- PII Warning -->
      <!-- <div v-if="config.provider && config.provider !== 'ollama'" class="bg-amber-300/10 border border-amber-300/10 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div class="font-medium text-amber-300">Privacy Notice</div>
            <p class="text-sm text-gray-400 mt-1">
              When using cloud providers, your traffic data is sent to their servers for analysis.
              Private Connect automatically redacts common PII patterns (emails, API keys, etc.) before sending.
              For maximum privacy, use Ollama to run AI locally.
            </p>
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
});

useHead({
  title: 'AI Copilot Settings - Private Connect',
});

const { apiFetch } = useApi();

const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const config = ref({
  provider: '' as '' | 'ollama' | 'openai' | 'anthropic',
  model: '',
  apiKey: '',
  ollamaUrl: '',
  autoAnalyze: false,
});

const models = {
  ollama: [
    { id: 'llama3', name: 'Llama 3 (8B)' },
    { id: 'llama3:70b', name: 'Llama 3 (70B)' },
    { id: 'codellama', name: 'Code Llama' },
    { id: 'mixtral', name: 'Mixtral 8x7B' },
    { id: 'mistral', name: 'Mistral 7B' },
  ],
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
  ],
  anthropic: [
    { id: 'claude-opus-4.6-20260205', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4.6-20260217', name: 'Claude Sonnet 4.6' },
  ],
};

const availableModels = computed(() => {
  if (!config.value.provider) return [];
  return models[config.value.provider] || [];
});

const selectProvider = (provider: 'ollama' | 'openai' | 'anthropic') => {
  config.value.provider = provider;
  // Set default model
  const providerModels = models[provider];
  if (providerModels && providerModels.length > 0) {
    config.value.model = providerModels[0].id;
  }
  saved.value = false;
  testResult.value = null;
};

const configError = ref('');

const loadConfig = async () => {
  loading.value = true;
  configError.value = '';
  try {
    const data = await apiFetch('/v1/ai/config');
    if (data.config) {
      config.value = {
        provider: data.config.provider || '',
        model: data.config.model || '',
        apiKey: data.config.apiKey || '',
        ollamaUrl: data.config.ollamaUrl || '',
        autoAnalyze: data.config.autoAnalyze || false,
      };
    }
  } catch (error: any) {
    configError.value = error.message || 'Could not reach the server. Check your connection.';
  } finally {
    loading.value = false;
  }
};

const saveConfig = async () => {
  saving.value = true;
  saved.value = false;
  saveError.value = null;
  
  try {
    await apiFetch('/v1/ai/config', {
      method: 'PUT',
      body: JSON.stringify(config.value),
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (error: unknown) {
    const err = error as Error;
    saveError.value = err.message;
  } finally {
    saving.value = false;
  }
};

const testConfig = async () => {
  testing.value = true;
  testResult.value = null;
  
  // Save first
  await saveConfig();
  
  try {
    const data = await apiFetch('/v1/ai/test', { method: 'POST' });
    testResult.value = {
      success: data.success,
      message: data.success 
        ? `Response: "${data.response}"` 
        : `Error: ${data.error}`,
    };
  } catch (error: unknown) {
    const err = error as Error;
    testResult.value = {
      success: false,
      message: err.message,
    };
  } finally {
    testing.value = false;
  }
};

onMounted(() => {
  loadConfig();
});
</script>
