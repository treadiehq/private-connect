<template>
  <Transition name="banner">
    <div 
      v-if="!isConnected && showBanner"
      class="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm"
    >
      <div class="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Spinning reconnect icon -->
          <svg 
            class="w-4 h-4 text-black animate-spin"
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span class="text-sm font-medium text-black">
            Connection lost. Reconnecting...
          </span>
        </div>
        <button 
          @click="dismissBanner"
          class="text-black/60 hover:text-black transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { isConnected } = useSocket();
const showBanner = ref(true);

const dismissBanner = () => {
  showBanner.value = false;
  // Re-enable after 30 seconds
  setTimeout(() => {
    showBanner.value = true;
  }, 30000);
};
</script>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

