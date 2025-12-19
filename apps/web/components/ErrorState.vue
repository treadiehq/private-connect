<template>
  <div class="flex flex-col items-center justify-center py-12 px-4">
    <!-- Icon with animated background -->
    <div class="relative mb-6">
      <div class="absolute inset-0 bg-red-400/20 rounded-full blur-xl animate-pulse"></div>
      <div class="relative w-16 h-16 bg-red-400/10 border border-red-400/30 rounded-full flex items-center justify-center">
        <svg v-if="type === 'network'" class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
        <svg v-else-if="type === 'server'" class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
        <svg v-else-if="type === 'auth'" class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <svg v-else class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    </div>

    <!-- Error Title -->
    <h3 class="text-lg font-semibold text-white mb-2">{{ title }}</h3>
    
    <!-- Error Message -->
    <p class="text-sm text-gray-400 text-center max-w-sm mb-6">{{ message }}</p>

    <!-- Detailed Error (collapsible) -->
    <div v-if="details" class="w-full max-w-md mb-6">
      <button 
        @click="showDetails = !showDetails"
        class="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mx-auto"
      >
        <svg 
          class="w-4 h-4 transition-transform" 
          :class="{ 'rotate-180': showDetails }"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        {{ showDetails ? 'Hide' : 'Show' }} technical details
      </button>
      <Transition name="slide">
        <div 
          v-if="showDetails"
          class="mt-3 p-3 bg-red-400/5 border border-red-400/20 rounded-lg"
        >
          <pre class="text-xs text-red-300 font-mono overflow-x-auto whitespace-pre-wrap">{{ details }}</pre>
        </div>
      </Transition>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button
        v-if="onRetry"
        @click="handleRetry"
        :disabled="retrying"
        class="flex items-center gap-2 px-4 py-2.5 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-all"
      >
        <svg 
          class="w-4 h-4" 
          :class="{ 'animate-spin': retrying }"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ retrying ? 'Retrying...' : 'Try Again' }}
      </button>
      
      <NuxtLink
        v-if="showHome"
        to="/"
        class="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-gray-200 text-sm font-medium rounded-lg transition-all"
      >
        Go Home
      </NuxtLink>
    </div>

    <!-- Auto-retry countdown -->
    <p v-if="autoRetryIn > 0" class="mt-4 text-xs text-gray-500">
      Retrying automatically in {{ autoRetryIn }}s...
    </p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  type?: 'network' | 'server' | 'auth' | 'generic';
  title?: string;
  message?: string;
  details?: string | null;
  showHome?: boolean;
  autoRetry?: number; // seconds until auto-retry
  onRetry?: () => Promise<void> | void;
}>(), {
  type: 'generic',
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again.',
  showHome: false,
  autoRetry: 0,
});

const emit = defineEmits<{
  retry: [];
}>();

const showDetails = ref(false);
const retrying = ref(false);
const autoRetryIn = ref(props.autoRetry);

let retryInterval: NodeJS.Timeout | null = null;

const handleRetry = async () => {
  if (props.onRetry) {
    retrying.value = true;
    try {
      await props.onRetry();
    } finally {
      retrying.value = false;
    }
  }
  emit('retry');
};

// Auto-retry countdown
onMounted(() => {
  if (props.autoRetry > 0) {
    autoRetryIn.value = props.autoRetry;
    retryInterval = setInterval(() => {
      autoRetryIn.value--;
      if (autoRetryIn.value <= 0) {
        if (retryInterval) clearInterval(retryInterval);
        handleRetry();
      }
    }, 1000);
  }
});

onUnmounted(() => {
  if (retryInterval) clearInterval(retryInterval);
});
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 200px;
  margin-top: 0.75rem;
}
</style>

