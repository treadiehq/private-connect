<template>
  <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.1] transition-colors">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-500/10">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <NuxtLink 
            :to="`/agents/${agent.id}`"
            class="text-base font-semibold text-white hover:text-blue-300 transition-colors"
          >
            {{ agent.label }}
          </NuxtLink>
        </div>
      </div>
      <NuxtLink 
        :to="`/agents/${agent.id}`"
        class="text-sm text-gray-500 hover:text-blue-400 group transition-colors"
      >
        Details <span class="">→</span>
      </NuxtLink>
    </div>

    <!-- Status Row -->
    <div class="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
      <span class="relative flex">
        <span 
          v-if="agent.isOnline"
          class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"
        ></span>
        <span 
          :class="[
            'relative w-2 h-2 rounded-full',
            agent.isOnline ? 'bg-emerald-400' : 'bg-gray-500'
          ]"
        ></span>
      </span>
      <span class="text-sm text-gray-300">
        {{ agent.isOnline ? 'Online' : 'Offline' }}
      </span>
      <span v-if="agent.name" class="ml-2 text-xs text-gray-500">• {{ agent.name }}</span>
    </div>

    <!-- Metrics Table -->
    <div class="divide-y divide-white/[0.04]">
      <!-- Table Header -->
      <div class="flex items-center px-5 py-2 bg-white/[0.02]">
        <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</span>
        <span class="w-32 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Status</span>
      </div>

      <!-- Connection -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Connection</span>
        <span class="w-32 text-right flex items-center justify-end gap-2">
          <span :class="agent.isOnline ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-gray-500'"></span>
          <span :class="agent.isOnline ? 'text-sm text-emerald-400' : 'text-sm text-gray-400'">
            {{ agent.isOnline ? 'Connected' : 'Disconnected' }}
          </span>
        </span>
      </div>

      <!-- Last Seen -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Last Seen</span>
        <span class="w-32 text-right flex items-center justify-end gap-2">
          <span :class="isRecentlySeen ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-amber-400'"></span>
          <span class="text-sm text-gray-200">{{ formatTime(agent.lastSeenAt) }}</span>
        </span>
      </div>

      <!-- Services -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Services</span>
        <span class="w-32 text-sm text-gray-200 text-right">
          {{ agent.services?.length || 0 }} exposed
        </span>
      </div>

      <!-- Agent ID -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Agent ID</span>
        <span class="w-32 text-sm text-gray-300 text-right font-mono">{{ agent.id.slice(0, 8) }}...</span>
      </div>

      <!-- Uptime (if online) -->
      <div v-if="agent.isOnline" class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Uptime</span>
        <span class="w-32 text-sm text-gray-200 text-right">{{ calculateUptime(agent.lastSeenAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types';

const props = defineProps<{
  agent: Agent;
}>();

const isRecentlySeen = computed(() => {
  const lastSeen = new Date(props.agent.lastSeenAt);
  const now = new Date();
  const diff = now.getTime() - lastSeen.getTime();
  return diff < 300000; // 5 minutes
});

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
};

const calculateUptime = (lastSeenAt: string) => {
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diff = now.getTime() - lastSeen.getTime();
  
  // For demo, assume uptime is continuous since last seen
  // In production, you'd track actual connection start time
  if (diff < 60000) return 'Just started';
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};
</script>

