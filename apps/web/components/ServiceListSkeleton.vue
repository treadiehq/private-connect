<template>
  <div class="space-y-4">
    <div
      v-for="i in count"
      :key="i"
      class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 animate-fade-in"
      :style="{ animationDelay: `${i * 50}ms` }"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1 space-y-3">
          <div class="flex items-center gap-3">
            <SkeletonLoader variant="text" class="!w-40 !h-5" />
            <SkeletonLoader variant="badge" class="!w-16" />
          </div>
          <div class="flex items-center gap-4">
            <SkeletonLoader variant="text" class="!w-48" />
            <SkeletonLoader variant="text" class="!w-16" />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right space-y-2">
            <SkeletonLoader class="!w-20 !h-3" />
            <SkeletonLoader class="!w-16 !h-4" />
          </div>
          <SkeletonLoader class="!w-8 !h-8 !rounded-lg" />
          <SkeletonLoader class="!w-8 !h-8 !rounded-lg" />
        </div>
      </div>
      <div class="mt-4 pt-4 border-t border-gray-500/10">
        <div class="flex items-center gap-6">
          <SkeletonLoader class="!w-20 !h-3" />
          <SkeletonLoader class="!w-20 !h-3" />
          <SkeletonLoader class="!w-24 !h-3" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  count?: number;
}>(), {
  count: 3,
});
</script>

