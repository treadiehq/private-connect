<template>
  <div 
    :class="[
      'relative rounded-lg p-4 text-center transition-all duration-300 overflow-hidden',
      statusBgClass
    ]"
  >
    <!-- Glow effect for OK status -->
    <!-- <div 
      v-if="status === 'OK' || status.includes('OK')"
      class="absolute inset-0 bg-gradient-to-t from-emerald-300/10 to-transparent"
    ></div> -->
    
    <div class="relative">
      <div class="flex items-center justify-center gap-1.5 mb-2">
        <!-- Status icon -->
        <div :class="['w-1.5 h-1.5 rounded-full', statusDotClass]"></div>
        <span class="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{{ label }}</span>
      </div>
      
      <div :class="['font-mono text-sm font-semibold', statusColor]">
        {{ displayStatus }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  status: string;
}>();

const displayStatus = computed(() => {
  if (props.status === 'OK' || props.status.includes('OK')) return '✓ OK';
  if (props.status === 'FAIL') return '✗ FAIL';
  if (props.status === 'N/A') return '—';
  return props.status;
});

const statusColor = computed(() => {
  if (props.status === 'OK' || props.status.includes('OK')) return 'text-emerald-300';
  if (props.status === 'FAIL') return 'text-red-400';
  if (props.status === 'N/A') return 'text-gray-500';
  return 'text-gray-300';
});

const statusBgClass = computed(() => {
  if (props.status === 'OK' || props.status.includes('OK')) return 'bg-emerald-300/5 border border-emerald-300/10';
  if (props.status === 'FAIL') return 'bg-red-400/5 border border-red-400/10';
  return 'bg-gray-500/5 border border-gray-500/10';
});

const statusDotClass = computed(() => {
  if (props.status === 'OK' || props.status.includes('OK')) return 'bg-emerald-300 animate-pulse';
  if (props.status === 'FAIL') return 'bg-red-400';
  return 'bg-gray-500';
});
</script>
