<template>
  <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-500/10">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <span class="text-base font-semibold text-white">Agent Grants</span>
      </div>
      <button
        @click="$emit('create')"
        class="flex items-center gap-2 text-sm px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-lg transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Grant
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <svg class="animate-spin h-6 w-6 text-blue-300" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Empty State -->
    <div v-else-if="grants.length === 0" class="p-8 text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <h3 class="text-sm font-medium text-white mb-1">No agent grants</h3>
      <p class="text-xs text-gray-500 mb-4">Create a grant to give an AI agent scoped access to this service</p>
    </div>

    <!-- Grants List -->
    <div v-else class="divide-y divide-gray-500/10">
      <div
        v-for="grant in grants"
        :key="grant.id"
        class="px-5 py-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg bg-gray-500/5 border border-gray-500/10 flex items-center justify-center shrink-0">
              <span class="text-sm font-medium text-gray-400">{{ grant.agentLabel.slice(0, 2).toUpperCase() }}</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-white">{{ grant.agentLabel }}</span>
                <span class="text-xs font-mono text-gray-500">{{ grant.tokenPrefix }}•••</span>
              </div>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  :class="[
                    'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
                    grant.scope === 'read-only'
                      ? 'bg-emerald-300/10 text-emerald-300'
                      : 'bg-amber-300/10 text-amber-300'
                  ]"
                >
                  <svg v-if="grant.scope === 'read-only'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ grant.scope }}
                </span>
                <span
                  v-if="grant.persistent"
                  class="px-2 py-0.5 rounded text-xs font-medium bg-purple-300/10 text-purple-300"
                >
                  persistent
                </span>
                <span v-else-if="grant.expiresAt" class="text-xs text-gray-500">
                  expires {{ formatTime(grant.expiresAt) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Stats -->
            <div class="text-right text-sm mr-2 hidden sm:block">
              <div v-if="grant.accessLogCount > 0" class="text-gray-400">{{ grant.accessLogCount }} requests</div>
              <div class="text-gray-500 text-xs">{{ grant.resourceType }}</div>
            </div>

            <!-- View logs -->
            <button
              v-if="grant.accessLogCount > 0"
              @click="toggleLogs(grant.id)"
              class="p-2 text-gray-400 hover:text-blue-300 transition-colors"
              title="View access logs"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>

            <!-- Revoke -->
            <button
              @click="handleRevoke(grant.id)"
              :disabled="revoking === grant.id"
              class="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Revoke grant"
            >
              <svg v-if="revoking !== grant.id" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <svg v-else class="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Access Logs (expandable) -->
        <Transition name="expand">
          <div v-if="expandedLogs === grant.id" class="mt-4 ml-14">
            <div v-if="logsLoading" class="flex items-center gap-2 py-3 text-sm text-gray-500">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Loading logs...
            </div>
            <div v-else-if="accessLogs.length === 0" class="py-3 text-sm text-gray-500">
              No access logs yet
            </div>
            <div v-else class="bg-gray-500/5 border border-gray-500/10 rounded-lg overflow-hidden">
              <!-- Log header -->
              <div class="flex items-center px-3 py-1.5 bg-gray-500/10 text-xs text-gray-500 font-medium uppercase tracking-wider">
                <span class="w-5"></span>
                <span class="flex-1">Request</span>
                <span class="w-16 text-right">Status</span>
                <span class="w-16 text-right">Time</span>
                <span class="w-20 text-right">When</span>
              </div>
              <div class="divide-y divide-gray-500/5 max-h-56 overflow-y-auto">
                <div
                  v-for="log in accessLogs"
                  :key="log.id"
                  class="flex items-center px-3 py-2 text-xs"
                >
                  <span class="w-5 shrink-0">
                    <span
                      :class="[
                        'block w-2 h-2 rounded-full',
                        log.allowed ? 'bg-emerald-300' : 'bg-red-400'
                      ]"
                    ></span>
                  </span>
                  <span class="flex-1 font-mono text-gray-400 truncate">
                    {{ log.requestSummary || log.requestType }}
                  </span>
                  <span class="w-16 text-right font-mono" :class="log.allowed ? 'text-gray-400' : 'text-red-400'">
                    {{ log.responseStatus || '—' }}
                  </span>
                  <span class="w-16 text-right text-gray-500">
                    {{ log.latencyMs ? `${log.latencyMs}ms` : '—' }}
                  </span>
                  <span class="w-20 text-right text-gray-500">
                    {{ formatTime(log.createdAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Grant, GrantAccessLog } from '~/types';

defineProps<{
  grants: Grant[];
  loading: boolean;
}>();

const emit = defineEmits<{
  create: [];
  revoked: [grantId: string];
}>();

const { revokeGrant, fetchGrantAccessLogs } = useApi();
const { success, error: showError } = useToast();

const revoking = ref<string | null>(null);
const expandedLogs = ref<string | null>(null);
const accessLogs = ref<GrantAccessLog[]>([]);
const logsLoading = ref(false);

const formatTime = (date: string | null | undefined) => {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const handleRevoke = async (grantId: string) => {
  revoking.value = grantId;
  try {
    await revokeGrant(grantId);
    success('Grant revoked');
    emit('revoked', grantId);
  } catch (err: any) {
    showError(err?.message || 'Failed to revoke grant');
  } finally {
    revoking.value = null;
  }
};

const toggleLogs = async (grantId: string) => {
  if (expandedLogs.value === grantId) {
    expandedLogs.value = null;
    return;
  }

  expandedLogs.value = grantId;
  logsLoading.value = true;
  try {
    const data = await fetchGrantAccessLogs(grantId);
    accessLogs.value = data.logs;
  } catch {
    accessLogs.value = [];
  } finally {
    logsLoading.value = false;
  }
};
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 400px;
}
</style>
