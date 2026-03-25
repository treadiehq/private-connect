<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-xl font-bold text-white mb-1">Overview</h1>
      <p class="text-sm text-gray-400">Visualize your agents, services, and connections</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="animate-spin w-8 h-8 border-2 border-blue-300 border-t-transparent rounded-full"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="flex items-center justify-center h-96">
      <div class="text-center">
        <svg class="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p class="text-sm font-medium text-red-300 mb-1">Failed to load dashboard</p>
        <p class="text-xs text-gray-500 mb-4">{{ fetchError }}</p>
        <button @click="retryFetch" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
          Retry
        </button>
      </div>
    </div>

    <!-- Network Map -->
    <NetworkMap
      v-else
      :agents="agents"
      :services="services"
      @hub-click="handleHubClick"
      @agent-click="handleAgentClick"
      @service-click="handleServiceClick"
    />

    <!-- Stats Cards -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ agents.length }}</div>
            <div class="text-xs text-gray-500">Total Agents</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="text-gray-400">{{ onlineAgents }} online</span>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ services.length }}</div>
            <div class="text-xs text-gray-500">Total Services</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-300"></span>
          <span class="text-gray-400">{{ healthyServices }} healthy</span>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ externalServices }}</div>
            <div class="text-xs text-gray-500">External Services</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-gray-400">Direct connections</span>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-amber-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ avgLatency }}ms</div>
            <div class="text-xs text-gray-500">Avg Latency</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span :class="avgLatency < 50 ? 'text-emerald-300' : avgLatency < 100 ? 'text-amber-300' : 'text-red-400'">
            {{ avgLatency < 50 ? 'Excellent' : avgLatency < 100 ? 'Good' : 'High' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Recent Activity Section -->
    <div class="mt-8 bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-500/10">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <NuxtLink 
          to="/audit"
          class="text-xs text-blue-300 hover:text-blue-400 transition-colors"
        >
          View all
        </NuxtLink>
      </div>
      
      <div v-if="auditLoading" class="p-6 text-center">
        <div class="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto"></div>
      </div>

      <div v-else-if="recentActivity.length === 0" class="py-10 px-6 text-center">
        <div class="relative w-16 h-16 mx-auto mb-4">
          <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl"></div>
          <div class="relative w-full h-full rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] flex items-center justify-center">
            <svg class="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p class="text-sm font-medium text-gray-400 mb-1">No recent activity</p>
        <p class="text-xs text-gray-600">Activity from your agents and services will appear here</p>
      </div>

      <div v-else class="divide-y divide-gray-500/10">
        <div
          v-for="event in recentActivity"
          :key="event.id"
          class="px-5 py-3 hover:bg-gray-500/5 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div
              :class="getEventIconClass(event.type)"
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            >
              <svg v-if="event.type === 'agent'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <svg v-else-if="event.type === 'share'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-white truncate">{{ formatEventName(event.event) }}</div>
              <div class="text-xs text-gray-500 truncate">
                {{ activitySubtitle(event) }}
              </div>
            </div>
            <div class="text-xs text-gray-500 shrink-0">
              {{ formatTimeAgo(event.timestamp) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Agent, Service } from '~/types';

interface AuditEvent {
  id: string;
  type: 'agent' | 'share' | 'session' | 'diagnostic';
  event: string;
  timestamp: string;
  agentId?: string;
  agentLabel?: string;
  serviceId?: string;
  serviceName?: string;
}

/** Display row: hub CONNECTED events for the same agent are folded into one row. */
type RecentActivityRow = AuditEvent & { connectionCount?: number };

useHead({ title: 'Overview - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

const router = useRouter();
const { fetchServices, fetchAgents, fetchAuditLog } = useApi();
const { connect } = useSocket();

const agents = ref<Agent[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const fetchError = ref('');
const auditLoading = ref(true);
const recentActivity = ref<RecentActivityRow[]>([]);

const DASHBOARD_AUDIT_FETCH_LIMIT = 120;
const DASHBOARD_AUDIT_ROWS = 10;

/**
 * Hub reconnects each log CONNECTED; merge duplicates per agent so the overview stays readable.
 */
function compressRecentActivity(events: AuditEvent[], maxRows: number): RecentActivityRow[] {
  const out: RecentActivityRow[] = [];
  const connectedRowIndex = new Map<string, number>();

  for (const e of events) {
    if (e.type === 'agent' && e.event === 'CONNECTED' && e.agentId) {
      const idx = connectedRowIndex.get(e.agentId);
      if (idx !== undefined) {
        const row = out[idx]!;
        row.connectionCount = (row.connectionCount ?? 1) + 1;
        continue;
      }
      if (out.length >= maxRows) {
        continue;
      }
      connectedRowIndex.set(e.agentId, out.length);
      out.push({ ...e, connectionCount: 1 });
      continue;
    }

    if (out.length >= maxRows) {
      continue;
    }
    out.push({ ...e });
  }

  return out;
}

// Computed stats
const onlineAgents = computed(() => agents.value.filter(a => a.isOnline).length);
const healthyServices = computed(() => services.value.filter(s => s.status === 'OK').length);
const externalServices = computed(() => services.value.filter(s => s.isExternal).length);

const avgLatency = computed(() => {
  const latencies = services.value
    .filter(s => s.diagnostics?.[0]?.latencyMs)
    .map(s => s.diagnostics![0].latencyMs as number);
  
  if (latencies.length === 0) return 0;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
});

// Navigation handlers
const handleHubClick = () => {
  // Could open a hub details modal
};

const handleAgentClick = (agent: Agent) => {
  router.push(`/agents/${agent.id}`);
};

const handleServiceClick = (service: Service) => {
  router.push(`/services/${service.id}`);
};

// Audit event helpers
const getEventIconClass = (type: string) => {
  switch (type) {
    case 'agent':
      return 'bg-blue-300/10 text-blue-400';
    case 'share':
      return 'bg-emerald-300/10 text-emerald-400';
    case 'session':
      return 'bg-amber-300/10 text-amber-400';
    case 'diagnostic':
      return 'bg-purple-300/10 text-purple-400';
    default:
      return 'bg-gray-500/10 text-gray-400';
  }
};

const formatEventName = (event: string) => {
  return event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const activitySubtitle = (event: RecentActivityRow) => {
  const base = event.agentLabel || event.serviceName || 'System';
  if (event.type === 'agent' && event.event === 'CONNECTED' && event.connectionCount && event.connectionCount > 1) {
    return `${base} · ${event.connectionCount} hub reconnects`;
  }
  return base;
};

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const retryFetch = async () => {
  loading.value = true;
  fetchError.value = '';
  auditLoading.value = true;
  try {
    const [agentsData, servicesData] = await Promise.all([
      fetchAgents(),
      fetchServices(),
    ]);
    agents.value = agentsData;
    services.value = servicesData;
  } catch (error: any) {
    fetchError.value = error.message || 'Could not reach the server. Check your connection.';
    loading.value = false;
    return;
  } finally {
    loading.value = false;
  }
  try {
    const auditData = await fetchAuditLog({ limit: DASHBOARD_AUDIT_FETCH_LIMIT });
    recentActivity.value = compressRecentActivity(auditData.events ?? [], DASHBOARD_AUDIT_ROWS);
  } catch (error) {
    // Audit is non-critical, degrade gracefully
  } finally {
    auditLoading.value = false;
  }
};

onMounted(async () => {
  await retryFetch();

  // Connect to realtime updates
  const socket = connect();
  
  socket?.on('service:update', (updatedService: Service) => {
    const index = services.value.findIndex(s => s.id === updatedService.id);
    if (index >= 0) {
      services.value[index] = updatedService;
    }
  });

  socket?.on('agent:update', (updatedAgent: Agent) => {
    const index = agents.value.findIndex(a => a.id === updatedAgent.id);
    if (index >= 0) {
      agents.value[index] = updatedAgent;
    }
  });
});
</script>

