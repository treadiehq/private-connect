<template>
  <div 
    :class="[
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
      connected ? 'bg-blue-300/10 text-blue-300' : 'bg-gray-500/10 text-gray-500'
    ]"
  >
    <span 
      :class="[
        'relative flex h-2 w-2',
        connected && 'animate-pulse'
      ]"
    >
      <span 
        v-if="connected"
        class="absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75 animate-ping"
      ></span>
      <span 
        :class="[
          'relative inline-flex rounded-full h-2 w-2',
          connected ? 'bg-blue-300' : 'bg-gray-500'
        ]"
      ></span>
    </span>
    {{ connected ? 'Live' : 'Offline' }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  connected: boolean;
}>();
</script>

