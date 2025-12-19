<template>
  <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg skeleton-shimmer"></div>
        <div class="skeleton-shimmer h-5 w-24 rounded"></div>
      </div>
      <div class="skeleton-shimmer h-4 w-16 rounded"></div>
    </div>

    <!-- Status Row -->
    <div class="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
      <div class="w-2 h-2 rounded-full skeleton-shimmer"></div>
      <div class="skeleton-shimmer h-4 w-16 rounded"></div>
    </div>

    <!-- Metrics Table -->
    <div class="divide-y divide-white/[0.04]">
      <!-- Table Header -->
      <div class="flex items-center px-5 py-2 bg-white/[0.02]">
        <div class="skeleton-shimmer h-3 w-12 rounded"></div>
        <div class="flex-1"></div>
        <div class="skeleton-shimmer h-3 w-12 rounded"></div>
      </div>

      <!-- Rows -->
      <div v-for="i in 5" :key="i" class="flex items-center px-5 py-3">
        <div class="skeleton-shimmer h-4 w-20 rounded"></div>
        <div class="flex-1"></div>
        <div class="skeleton-shimmer h-4 w-24 rounded"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite ease-in-out;
}
</style>

