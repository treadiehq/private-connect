<template>
  <span class="flex items-center gap-1.5 text-gray-500">
    {{ label }}:
    <span :class="statusClass">{{ status }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  status: string;
}>();

const statusClass = computed(() => {
  if (props.status === 'OK' || props.status.includes('OK')) return 'text-emerald-300';
  if (props.status === 'FAIL') return 'text-red-400';
  return 'text-gray-400';
});
</script>

