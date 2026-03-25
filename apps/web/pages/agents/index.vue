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

    <!-- Error State -->
    <div v-else-if="fetchError" class="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <svg class="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p class="text-sm font-medium text-red-300 mb-1">Failed to load agents</p>
      <p class="text-xs text-gray-500 mb-4">{{ fetchError }}</p>
      <button @click="retryFetch" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="agents.length === 0"
      title="No agents yet"
      description="Connect an agent to start exposing local services."
      :commands="[
        { comment: 'Connect an agent', command: 'connect up' }
      ]"
    >
      <template #icon>
        <svg class="w-12 h-12 text-purple-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        @delete="confirmDelete"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="agentToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-agent-title" @click.self="agentToDelete = null">
      <div class="bg-black-main border border-white/[0.08] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 id="delete-agent-title" class="text-lg font-semibold text-white mb-2">Remove Agent</h3>
        <p class="text-sm text-gray-400 mb-1">
          Are you sure you want to remove <span class="text-white font-medium">{{ agentToDelete.label }}</span>?
        </p>
        <p class="text-sm text-gray-500 mb-6">
          This will permanently delete the agent and all its services, sessions, and audit logs. This action cannot be undone.
        </p>
        <div class="flex items-center justify-end gap-3">
          <button
            @click="agentToDelete = null"
            class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleDelete"
            :disabled="deleting"
            class="px-4 py-2 text-sm font-medium text-white bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg v-if="deleting" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ deleting ? 'Removing...' : 'Remove' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types';

useHead({ title: 'Agents - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

const { fetchAgents, deleteAgent } = useApi();

const agents = ref<Agent[]>([]);
const loading = ref(true);
const fetchError = ref('');
const agentToDelete = ref<Agent | null>(null);
const deleting = ref(false);
const { error: showError } = useToast();

const retryFetch = async () => {
  loading.value = true;
  fetchError.value = '';
  try {
    agents.value = await fetchAgents();
  } catch (error: any) {
    fetchError.value = error.message || 'Could not reach the server. Check your connection.';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    agents.value = await fetchAgents();
  } catch (error: any) {
    fetchError.value = error.message || 'Could not reach the server. Check your connection.';
  } finally {
    loading.value = false;
  }
});

const confirmDelete = (agentId: string) => {
  agentToDelete.value = agents.value.find(a => a.id === agentId) || null;
};

const handleDelete = async () => {
  if (!agentToDelete.value) return;
  deleting.value = true;
  try {
    await deleteAgent(agentToDelete.value.id);
    agents.value = agents.value.filter(a => a.id !== agentToDelete.value!.id);
    agentToDelete.value = null;
  } catch (error: any) {
    showError(error.message || 'Failed to delete agent');
  } finally {
    deleting.value = false;
  }
};
</script>
