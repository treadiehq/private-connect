<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          class="absolute inset-0 bg-[#09090b]/60 backdrop-blur-sm"
          @click="$emit('close')"
        ></div>
        
        <div class="relative bg-black-main border border-gray-500/20 rounded-2xl shadow-2xl w-full max-w-lg animate-modal-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-500/10">
            <div>
              <h2 class="text-lg font-semibold text-white">Create Agent Grant</h2>
              <p class="text-sm text-gray-400">Scoped access to {{ serviceName }}</p>
            </div>
            <button @click="$emit('close')" class="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Create Form -->
          <div v-if="!createdGrant" class="p-6 space-y-5">
            <!-- Agent Label -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Agent Label</label>
              <input
                v-model="form.agentLabel"
                type="text"
                placeholder="e.g., claude, cursor, research-agent"
                class="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <!-- Resource Type -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Resource Type</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="rt in resourceTypes"
                  :key="rt.value"
                  @click="form.resourceType = rt.value"
                  :class="[
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    form.resourceType === rt.value
                      ? 'bg-blue-300 text-black border border-blue-300'
                      : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/15 border border-gray-500/10'
                  ]"
                >
                  {{ rt.label }}
                </button>
              </div>
            </div>

            <!-- Scope -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Scope</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="s in scopeOptions"
                  :key="s.value"
                  @click="form.scope = s.value"
                  :class="[
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all text-left',
                    form.scope === s.value
                      ? 'bg-blue-300 text-black border border-blue-300'
                      : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/15 border border-gray-500/10'
                  ]"
                >
                  {{ s.label }}
                  <span class="block text-xs mt-0.5" :class="form.scope === s.value ? 'text-black/60' : 'text-gray-500'">{{ s.hint }}</span>
                </button>
              </div>
            </div>

            <!-- Expiration -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Expires</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="option in expiryOptions"
                  :key="option.value"
                  @click="form.ttl = option.value"
                  :class="[
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    form.ttl === option.value
                      ? 'bg-blue-300 text-black border border-blue-300'
                      : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/15 border border-gray-500/10'
                  ]"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Success State -->
          <div v-else class="p-6 space-y-5">
            <div class="flex items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-emerald-300/10 flex items-center justify-center">
                <svg class="w-8 h-8 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <div class="text-center">
              <h3 class="text-lg font-semibold text-white mb-1">Grant Created</h3>
              <p class="text-sm text-gray-400">
                <template v-if="createdGrant.persistent">Persistent</template>
                <template v-else>Expires in {{ createdGrant.expiresInMinutes }}m</template>
                &middot; {{ createdGrant.scope }}
              </p>
            </div>

            <!-- Token -->
            <div class="bg-white/5 rounded-xl p-4">
              <label class="block text-xs text-gray-500 mb-2">Grant Token</label>
              <div class="flex items-center gap-3">
                <input
                  :value="createdGrant.token"
                  readonly
                  class="flex-1 bg-transparent text-yellow-300 font-mono text-sm focus:outline-none"
                />
                <button
                  @click="copyToken"
                  class="px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg v-if="!copied" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ copied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <!-- Usage Example -->
            <div class="bg-black-main border border-gray-500/10 rounded-xl p-4 overflow-hidden">
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs text-gray-500">Usage example</label>
                <button
                  @click="copyCurl"
                  class="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <svg v-if="!curlCopied" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg v-else class="w-3 h-3 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ curlCopied ? 'Copied' : 'Copy' }}
                </button>
              </div>
              <code class="text-sm text-blue-300 font-mono break-all whitespace-pre-wrap leading-relaxed">{{ curlExample }}</code>
            </div>

            <!-- Warning -->
            <div class="bg-amber-300/10 border border-amber-300/10 rounded-xl p-4 flex items-start gap-3">
              <svg class="w-5 h-5 text-amber-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="text-sm">
                <p class="text-amber-300 font-medium">Store this token securely</p>
                <p class="text-amber-200/70">The token is only shown once. Give the endpoint and token to the AI agent.</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-500/10">
            <button
              @click="$emit('close')"
              class="px-5 py-2.5 text-gray-400 hover:text-white transition-colors"
            >
              {{ createdGrant ? 'Done' : 'Cancel' }}
            </button>
            <button
              v-if="!createdGrant"
              @click="handleCreate"
              :disabled="!form.agentLabel || loading"
              class="px-5 py-2 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <svg v-if="loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Create
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  serviceId: string;
  serviceName: string;
  resourceType?: string;
}>();

const emit = defineEmits<{
  close: [];
  created: [];
}>();

const { createGrant } = useApi();

const form = ref({
  agentLabel: '',
  resourceType: props.resourceType || 'db',
  scope: 'read-only',
  ttl: '5m' as string,
});

const resourceTypes = [
  { label: 'Database', value: 'db' },
  { label: 'API', value: 'api' },
  { label: 'Path', value: 'path' },
];

const scopeOptions = [
  { label: 'Read-only', value: 'read-only', hint: 'SELECT / GET only' },
  { label: 'Full access', value: 'full', hint: 'All operations' },
];

const expiryOptions = [
  { label: '5 min', value: '5m' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '1d' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'Never', value: '' },
];

const loading = ref(false);
const copied = ref(false);
const curlCopied = ref(false);
const createdGrant = ref<{
  token: string;
  endpoint: string;
  scope: string;
  persistent: boolean;
  expiresInMinutes: number | null;
} | null>(null);

const handleCreate = async () => {
  loading.value = true;
  try {
    const data: Record<string, string> = {
      agentLabel: form.value.agentLabel,
      resourceType: form.value.resourceType,
      resourceName: props.serviceName,
      scope: form.value.scope,
    };
    if (form.value.ttl) {
      data.ttl = form.value.ttl;
    }
    const result = await createGrant(data);
    createdGrant.value = result.grant;
    emit('created');
  } catch (error) {
    console.error('Failed to create grant:', error);
  } finally {
    loading.value = false;
  }
};

const config = useRuntimeConfig();
const apiBase = computed(() => config.public.apiBase || config.public.apiUrl || 'http://localhost:3001');

const curlExample = computed(() => {
  if (!createdGrant.value) return '';
  const g = createdGrant.value;
  if (form.value.resourceType === 'db') {
    return `curl -X POST ${apiBase.value}/grant/${props.serviceName}/query \\\n  -H "Authorization: Bearer ${g.token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sql": "SELECT * FROM your_table LIMIT 10"}'`;
  }
  return `curl ${apiBase.value}/grant/${props.serviceName}/ \\\n  -H "Authorization: Bearer ${g.token}"`;
});

const copyToken = async () => {
  if (!createdGrant.value) return;
  try {
    await navigator.clipboard.writeText(createdGrant.value.token);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {}
};

const copyCurl = async () => {
  try {
    await navigator.clipboard.writeText(curlExample.value);
    curlCopied.value = true;
    setTimeout(() => { curlCopied.value = false; }, 2000);
  } catch {}
};

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    form.value = {
      agentLabel: '',
      resourceType: props.resourceType || 'db',
      scope: 'read-only',
      ttl: '5m',
    };
    createdGrant.value = null;
    copied.value = false;
    curlCopied.value = false;
  }
});
</script>

<style scoped>
.modal-enter-active {
  animation: modal-in 0.2s ease-out;
}
.modal-leave-active {
  animation: modal-out 0.15s ease-in;
}
@keyframes modal-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes modal-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
.animate-modal-in {
  animation: modal-content-in 0.25s ease-out;
}
@keyframes modal-content-in {
  0% { opacity: 0; transform: scale(0.95) translateY(-10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
