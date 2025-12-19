<template>
  <div class="animate-fade-in">
    <!-- Breadcrumb Navigation -->
    <nav class="flex items-center gap-2 text-sm mb-8">
      <NuxtLink to="/agents" class="text-gray-500 hover:text-white transition-colors">
        Agents
      </NuxtLink>
      <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span v-if="agent" class="text-white font-medium">{{ agent.label }}</span>
      <SkeletonLoader v-else class="!w-24 !h-4" />
    </nav>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex items-center gap-3 text-gray-400">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading agent...</span>
      </div>
    </div>

    <!-- Agent Detail -->
    <div v-else-if="agent" class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-4 mb-3">
            <h1 class="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{{ agent.label }}</h1>
            <span 
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-lg',
                agent.isOnline 
                  ? 'bg-blue-300/10 text-blue-300 border border-blue-300/10' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/10'
              ]"
            >
              <span :class="['w-2 h-2 rounded-full', agent.isOnline ? 'bg-blue-300' : 'bg-gray-400']"></span>
              {{ agent.isOnline ? 'Online' : 'Offline' }}
            </span>
          </div>
          <p class="text-gray-400 font-mono text-sm">{{ agent.id }}</p>
        </div>
      </div>

      <!-- Agent Info -->
      <div class="grid md:grid-cols-2 gap-4">
        <!-- Agent Details Card -->
        <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="text-base font-semibold text-white">Agent Details</span>
            </div>
          </div>
          <div class="divide-y divide-white/[0.04]">
            <div class="flex items-center px-5 py-2 bg-white/[0.02]">
              <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Property</span>
              <span class="w-40 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Value</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Label</span>
              <span class="w-40 text-sm text-gray-200 text-right font-mono">{{ agent.label }}</span>
            </div>
            <div v-if="agent.name" class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Name</span>
              <span class="w-40 text-sm text-gray-200 text-right">{{ agent.name }}</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Status</span>
              <span class="w-40 text-right flex items-center justify-end gap-2">
                <span :class="agent.isOnline ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-gray-500'"></span>
                <span :class="agent.isOnline ? 'text-sm text-emerald-400' : 'text-sm text-gray-400'">
                  {{ agent.isOnline ? 'Online' : 'Offline' }}
                </span>
              </span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Last Seen</span>
              <span class="w-40 text-sm text-gray-200 text-right">{{ formatTime(agent.lastSeenAt) }}</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Registered</span>
              <span class="w-40 text-sm text-gray-200 text-right">{{ formatTime(agent.createdAt) }}</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Agent ID</span>
              <span class="w-40 text-sm text-gray-300 text-right font-mono truncate" :title="agent.id">{{ agent.id.slice(0, 12) }}...</span>
            </div>
          </div>
        </div>

        <!-- Services Card -->
        <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <span class="text-base font-semibold text-white">Services</span>
              <span class="text-xs text-gray-500">({{ agent.services?.length || 0 }})</span>
            </div>
          </div>
          <div v-if="agent.services?.length" class="divide-y divide-white/[0.04]">
            <div class="flex items-center px-5 py-2 bg-white/[0.02]">
              <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Service</span>
              <span class="w-24 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Status</span>
            </div>
            <NuxtLink
              v-for="service in agent.services"
              :key="service.id"
              :to="`/services/${service.id}`"
              class="flex items-center px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <span class="flex-1 text-sm text-gray-200 hover:text-blue-300 transition-colors">{{ service.name }}</span>
              <span class="w-24 text-right flex items-center justify-end gap-2">
                <span :class="service.status === 'OK' ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-red-400'"></span>
                <span :class="service.status === 'OK' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'">
                  {{ service.status === 'OK' ? 'Healthy' : 'Unhealthy' }}
                </span>
              </span>
            </NuxtLink>
          </div>
          <div v-else class="px-5 py-8 text-center text-sm text-gray-500">
            No services exposed by this agent
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found -->
    <div v-else class="text-center py-20">
      <h2 class="text-2xl font-bold mb-2">Agent not found</h2>
      <p class="text-gray-400">The agent you're looking for doesn't exist.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types';

definePageMeta({
  middleware: 'auth',
});

const route = useRoute();
const { fetchAgent } = useApi();

const agent = ref<Agent | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    agent.value = await fetchAgent(route.params.id as string);
  } catch (error) {
    console.error('Failed to fetch agent:', error);
  } finally {
    loading.value = false;
  }
});

const formatTime = (date: string) => {
  return new Date(date).toLocaleString();
};
</script>

