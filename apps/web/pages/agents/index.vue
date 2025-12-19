<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-10">
      <h1 class="text-xl font-bold text-white">
        Agents
      </h1>
      <p class="text-sm text-gray-400 mt-1">Connected agents across your environments</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-5 animate-fade-in"
        :style="{ animationDelay: `${i * 50}ms` }"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 space-y-3">
            <div class="flex items-center gap-3">
              <SkeletonLoader class="!w-40 !h-5" />
              <SkeletonLoader class="!w-16 !h-5" />
            </div>
            <SkeletonLoader class="!w-32 !h-4" />
          </div>
          <div class="text-right space-y-2">
            <SkeletonLoader class="!w-20 !h-3" />
            <SkeletonLoader class="!w-16 !h-4" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="agents.length === 0"
      title="No agents yet"
      description="Connect an agent to start exposing local services."
      :commands="[
        { comment: 'Connect an agent', command: 'connect up --api-key YOUR_API_KEY --label YOUR_LABEL' }
      ]"
    >
      <template #icon>
        <svg class="w-12 h-12 text-purple-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </template>
    </EmptyState>

    <!-- Agents Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AgentCard
        v-for="(agent, index) in agents"
        :key="agent.id"
        :agent="agent"
        class="animate-slide-up"
        :style="{ animationDelay: `${index * 50}ms` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types';

useHead({ title: 'Agents - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

const { fetchAgents } = useApi();

const agents = ref<Agent[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    agents.value = await fetchAgents();
  } catch (error) {
    console.error('Failed to fetch agents:', error);
  } finally {
    loading.value = false;
  }
});
</script>
