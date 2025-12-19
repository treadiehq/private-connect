<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      <TransitionGroup name="toast-list">
        <div 
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-xl min-w-[320px] max-w-md',
            getTypeClasses(toast.type)
          ]"
        >
          <!-- Icon -->
          <div :class="getIconBgClass(toast.type)" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
            <svg v-if="toast.type === 'success'" class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="toast.type === 'error'" class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <svg v-else class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p v-if="toast.title" class="text-sm font-medium text-white">{{ toast.title }}</p>
            <p :class="['text-sm', toast.title ? 'text-gray-400' : 'text-white']">{{ toast.message }}</p>
          </div>
          
          <!-- Close button -->
          <button 
            @click="remove(toast.id)"
            class="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { toasts, remove } = useToast();

const getTypeClasses = (type: string) => {
  switch (type) {
    case 'success': return 'bg-emerald-950/90 border-emerald-500/30';
    case 'error': return 'bg-red-950/90 border-red-500/30';
    default: return 'bg-gray-900/90 border-white/10';
  }
};

const getIconBgClass = (type: string) => {
  switch (type) {
    case 'success': return 'bg-emerald-500/20';
    case 'error': return 'bg-red-500/20';
    default: return 'bg-blue-500/20';
  }
};
</script>

<style scoped>
.toast-list-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-list-leave-active {
  animation: toast-out 0.2s ease-in;
}

.toast-list-move {
  transition: transform 0.3s ease;
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

