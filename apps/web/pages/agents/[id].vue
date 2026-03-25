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
        <button
          @click="showDeleteConfirm = true"
          :disabled="deleting"
          class="px-4 py-2 text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg hover:bg-red-400/20 hover:border-red-400/30 transition-colors disabled:opacity-50"
        >
          Remove Agent
        </button>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" @click.self="showDeleteConfirm = false">
        <div class="bg-black-main border border-white/[0.08] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <h3 id="delete-confirm-title" class="text-lg font-semibold text-white mb-2">Remove Agent</h3>
          <p class="text-sm text-gray-400 mb-1">
            Are you sure you want to remove <span class="text-white font-medium">{{ agent.label }}</span>?
          </p>
          <p class="text-sm text-gray-500 mb-6">
            This will permanently delete the agent and all its services, sessions, and audit logs. This action cannot be undone.
          </p>
          <div class="flex items-center justify-end gap-3">
            <button
              @click="showDeleteConfirm = false"
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
              {{ deleting ? 'Removing...' : 'Remove Agent' }}
            </button>
          </div>
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
              <span class="text-sm text-gray-200 text-right font-mono whitespace-nowrap">{{ agent.label }}</span>
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
          <div v-else class="px-5 py-10 text-center">
            <div class="relative w-16 h-16 mx-auto mb-4">
              <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl"></div>
              <div class="relative w-full h-full rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] flex items-center justify-center">
                <svg class="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
            </div>
            <p class="text-sm font-medium text-gray-300 mb-1">No services exposed</p>
            <p class="text-xs text-gray-500 mb-4 max-w-xs mx-auto">Expose a local service from this agent to make it reachable from other devices.</p>
            <div class="inline-flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 font-mono text-xs">
              <span class="text-blue-400 select-none">$</span>
              <code class="text-gray-300">connect expose localhost:3000</code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found (404) -->
    <div v-else-if="notFound" class="text-center py-20">
      <h2 class="text-2xl font-bold mb-2">Agent not found</h2>
      <p class="text-gray-400">The agent you're looking for doesn't exist.</p>
    </div>

    <!-- Error State (non-404) -->
    <div v-else class="text-center py-20">
      <svg class="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <h2 class="text-lg font-semibold text-red-300 mb-1">Failed to load agent</h2>
      <p class="text-sm text-gray-500 mb-4">{{ fetchError }}</p>
      <button @click="retryFetch" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types';
import { ApiError } from '~/composables/useApi';

definePageMeta({
  middleware: 'auth',
});

const route = useRoute();
const router = useRouter();
const { fetchAgent, deleteAgent } = useApi();
const { error: showError } = useToast();

const agent = ref<Agent | null>(null);
const loading = ref(true);
const notFound = ref(false);
const fetchError = ref('');
const showDeleteConfirm = ref(false);
const deleting = ref(false);

const pageTitle = computed(() => 
  agent.value ? `${agent.value.label} - Private Connect` : 'Agent - Private Connect'
)
useHead({ title: pageTitle })

const retryFetch = async () => {
  loading.value = true;
  fetchError.value = '';
  notFound.value = false;
  try {
    agent.value = await fetchAgent(route.params.id as string);
  } catch (error: any) {
    if (error instanceof ApiError && error.status === 404) {
      notFound.value = true;
    } else {
      fetchError.value = error.message || 'Could not reach the server. Check your connection.';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(retryFetch);

const handleDelete = async () => {
  if (!agent.value) return;
  deleting.value = true;
  try {
    await deleteAgent(agent.value.id);
    router.push('/agents');
  } catch (error: any) {
    showError(error.message || 'Failed to delete agent');
    deleting.value = false;
    showDeleteConfirm.value = false;
  }
};

const formatTime = (date: string) => {
  return new Date(date).toLocaleString();
};
</script>

