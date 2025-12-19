<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <ServiceCardSkeleton
      v-for="i in count"
      :key="i"
      class="animate-fade-in"
      :style="{ animationDelay: `${i * 50}ms` }"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  count?: number;
}>(), {
  count: 3,
});
</script>
