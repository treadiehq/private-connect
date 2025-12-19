<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="$emit('close')"
        ></div>
        
        <!-- Modal -->
        <div class="relative bg-black border border-gray-500/20 rounded-2xl shadow-2xl w-full max-w-lg animate-modal-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-500/10">
            <div class="flex items-center gap-3">
              <!-- <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div> -->
              <div>
                <h2 class="text-lg font-semibold text-white">Share Service</h2>
                <p class="text-sm text-gray-400">Create a secure link for external access</p>
              </div>
            </div>
            <button @click="$emit('close')" class="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div v-if="!createdShare" class="p-6 space-y-5">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Share Name</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="e.g., Stripe Integration Team"
                class="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <!-- Description -->
            <!-- <div>
              <label class="block text-sm font-medium text-white mb-2">Description (optional)</label>
              <input
                v-model="form.description"
                type="text"
                placeholder="What is this share for?"
                class="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div> -->

            <!-- Expiration -->
            <div>
              <label class="block text-sm font-medium text-white mb-2">Expires</label>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="option in expiryOptions"
                  :key="option.value"
                  @click="form.expiresIn = option.value"
                  :class="[
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    form.expiresIn === option.value
                      ? 'bg-blue-300 text-black border border-blue-300'
                      : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/10 border border-gray-500/10'
                  ]"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Advanced Options Toggle -->
            <button
              @click="showAdvanced = !showAdvanced"
              class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <svg 
                class="w-4 h-4 transition-transform" 
                :class="{ 'rotate-90': showAdvanced }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              Advanced options
            </button>

            <!-- Advanced Options -->
            <div v-if="showAdvanced" class="space-y-4 pl-4 border-l-2 border-gray-500/10">
              <!-- Allowed Methods -->
              <div>
                <label class="block text-sm font-medium text-white mb-2">Allowed Methods</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="method in ['GET', 'POST', 'PUT', 'DELETE']"
                    :key="method"
                    @click="toggleMethod(method)"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                      form.allowedMethods?.includes(method)
                        ? 'bg-purple-300/20 text-purple-300 border border-purple-300/30'
                        : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/10'
                    ]"
                  >
                    {{ method }}
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-1">Leave empty for all methods</p>
              </div>

              <!-- Rate Limit -->
              <div>
                <label class="block text-sm font-medium text-white mb-2">Rate Limit (requests/min)</label>
                <input
                  v-model.number="form.rateLimitPerMin"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="No limit"
                  class="w-full px-4 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                />
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
              <h3 class="text-lg font-semibold text-white mb-1">Share Created!</h3>
              <p class="text-sm text-gray-400">Copy the link below to share access</p>
            </div>

            <!-- Share URL -->
            <div class="bg-white/5 rounded-xl p-4">
              <div class="flex items-center gap-3">
                <input
                  ref="shareUrlInput"
                  :value="shareUrl"
                  readonly
                  class="flex-1 bg-transparent text-blue-300 font-mono text-sm focus:outline-none"
                />
                <button
                  @click="copyShareUrl"
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

            <div class="bg-amber-300/10 border border-amber-300/10 rounded-xl p-4 flex items-start gap-3">
              <svg class="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="text-sm">
                <p class="text-amber-300 font-medium">Keep this link secure</p>
                <p class="text-amber-200/70">Anyone with this link can access this service. You can revoke access anytime.</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-500/10">
            <button
              @click="$emit('close')"
              class="px-5 py-2.5 text-gray-400 hover:text-white transition-colors"
            >
              {{ createdShare ? 'Done' : 'Cancel' }}
            </button>
            <button
              v-if="!createdShare"
              @click="handleCreate"
              :disabled="!form.name || loading"
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
}>();

const emit = defineEmits<{
  close: [];
  created: [share: unknown];
}>();

const { createServiceShare } = useApi();

const form = ref({
  name: '',
  description: '',
  expiresIn: '7d' as '1h' | '24h' | '7d' | '30d' | 'never',
  allowedMethods: [] as string[],
  rateLimitPerMin: undefined as number | undefined,
});

const showAdvanced = ref(false);
const loading = ref(false);
const createdShare = ref<{ token: string; shareUrl: string } | null>(null);
const copied = ref(false);
const shareUrlInput = ref<HTMLInputElement>();

const expiryOptions = [
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'Never', value: 'never' },
];

const shareUrl = computed(() => {
  if (!createdShare.value) return '';
  return `${window.location.origin}${createdShare.value.shareUrl}`;
});

const toggleMethod = (method: string) => {
  const idx = form.value.allowedMethods.indexOf(method);
  if (idx >= 0) {
    form.value.allowedMethods.splice(idx, 1);
  } else {
    form.value.allowedMethods.push(method);
  }
};

const handleCreate = async () => {
  loading.value = true;
  try {
    const result = await createServiceShare(props.serviceId, {
      name: form.value.name,
      description: form.value.description || undefined,
      expiresIn: form.value.expiresIn,
      allowedMethods: form.value.allowedMethods.length > 0 ? form.value.allowedMethods : undefined,
      rateLimitPerMin: form.value.rateLimitPerMin || undefined,
    });
    createdShare.value = result.share;
    emit('created', result.share);
  } catch (error) {
    console.error('Failed to create share:', error);
  } finally {
    loading.value = false;
  }
};

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Fallback
    shareUrlInput.value?.select();
    document.execCommand('copy');
  }
};

// Reset form when modal closes
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    form.value = {
      name: '',
      description: '',
      expiresIn: '7d',
      allowedMethods: [],
      rateLimitPerMin: undefined,
    };
    showAdvanced.value = false;
    createdShare.value = null;
    copied.value = false;
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
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes modal-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.animate-modal-in {
  animation: modal-content-in 0.25s ease-out;
}

@keyframes modal-content-in {
  0% {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

