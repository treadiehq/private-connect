<template>
  <span 
    :class="[
      'inline-flex items-center gap-1.5 font-medium transition-all duration-300',
      sizeClasses,
      colorClasses,
    ]"
  >
    <span class="relative flex">
      <!-- Ping animation for healthy status -->
      <span 
        v-if="status === 'OK'" 
        :class="['absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', pingColorClass]"
      ></span>
      <span :class="['relative rounded-full', dotSizeClass, dotColorClass]"></span>
    </span>
    {{ displayStatus }}
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  status: 'OK' | 'FAIL' | 'UNKNOWN' | string;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  size: 'md',
});

const displayStatus = computed(() => {
  if (props.status === 'OK') return 'Healthy';
  if (props.status === 'FAIL') return 'Unhealthy';
  if (props.status === 'UNKNOWN') return 'Unknown';
  return props.status;
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-[10px] px-2 py-0.5 rounded';
    case 'lg': return 'text-xs px-3 py-1.5 rounded-lg';
    default: return 'text-[10px] px-2.5 py-1 rounded-md';
  }
});

const dotSizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-1.5 h-1.5';
    case 'lg': return 'w-2.5 h-2.5';
    default: return 'w-2 h-2';
  }
});

const colorClasses = computed(() => {
  switch (props.status) {
    case 'OK': return 'bg-emerald-300/10 text-emerald-300 border border-emerald-300/20';
    case 'FAIL': return 'bg-red-400/10 text-red-400 border border-red-400/20';
    default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  }
});

const dotColorClass = computed(() => {
  switch (props.status) {
    case 'OK': return 'bg-emerald-300';
    case 'FAIL': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
});

const pingColorClass = computed(() => {
  switch (props.status) {
    case 'OK': return 'bg-emerald-300';
    default: return 'bg-transparent';
  }
});
</script>
