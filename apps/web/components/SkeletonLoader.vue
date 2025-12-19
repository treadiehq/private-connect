<template>
  <div :class="['animate-pulse rounded', bgClass, sizeClass]"></div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'text' | 'title' | 'card' | 'avatar' | 'button' | 'badge';
  width?: string;
  height?: string;
}>(), {
  variant: 'text',
});

const bgClass = 'bg-gradient-to-r from-gray-500/5 via-gray-500/10 to-gray-500/5 bg-[length:200%_100%] animate-shimmer';

const sizeClass = computed(() => {
  if (props.width || props.height) {
    return '';
  }
  
  switch (props.variant) {
    case 'title': return 'h-8 w-48';
    case 'card': return 'h-32 w-full';
    case 'avatar': return 'h-10 w-10 rounded-full';
    case 'button': return 'h-10 w-24';
    case 'badge': return 'h-5 w-16';
    default: return 'h-4 w-full';
  }
});
</script>

<style scoped>
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
}
</style>

