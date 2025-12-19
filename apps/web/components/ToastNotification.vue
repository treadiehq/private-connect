<template>
  <Teleport to="body">
    <Transition name="toast">
      <div 
        v-if="visible"
        :class="[
          'fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-xl',
          typeClasses
        ]"
      >
        <!-- Icon -->
        <div :class="iconBgClass" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
          <svg v-if="type === 'success'" class="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="type === 'error'" class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg v-else class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p v-if="title" class="text-sm font-medium text-white">{{ title }}</p>
          <p :class="['text-sm', title ? 'text-gray-400' : 'text-white']">{{ message }}</p>
        </div>
        
        <!-- Close button -->
        <button 
          @click="close"
          class="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  duration?: number;
}>(), {
  type: 'info',
  duration: 4000,
});

const emit = defineEmits<{
  close: [];
}>();

const visible = ref(true);

const typeClasses = computed(() => {
  switch (props.type) {
    case 'success': return 'bg-emerald-950/90 border-emerald-500/30';
    case 'error': return 'bg-red-950/90 border-red-500/30';
    default: return 'bg-gray-900/90 border-white/10';
  }
});

const iconBgClass = computed(() => {
  switch (props.type) {
    case 'success': return 'bg-emerald-300/20';
    case 'error': return 'bg-red-400/20';
    default: return 'bg-blue-300/20';
  }
});

const close = () => {
  visible.value = false;
  emit('close');
};

onMounted(() => {
  if (props.duration > 0) {
    setTimeout(close, props.duration);
  }
});
</script>

<style scoped>
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.2s ease-in;
}

@keyframes toast-in {
  0% {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
}
</style>

