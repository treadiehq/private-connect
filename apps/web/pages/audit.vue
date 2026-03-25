<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-xl font-bold text-white mb-1">Audit Log</h1>
        <p class="text-sm text-gray-400">Track all activity across your workspace</p>
      </div>
      <button
        @click="refreshData"
        :disabled="loading"
        class="px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/10 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Refresh</span>
      </button>
    </div>

    <!-- Stats Cards -->
    <div v-if="stats" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ stats.totalEvents.toLocaleString() }}</div>
            <div class="text-xs text-gray-500">Total Events (30d)</div>
          </div>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-blue-300">{{ stats.eventsByType.agent.toLocaleString() }}</div>
            <div class="text-xs text-gray-500">Agent Events</div>
          </div>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-emerald-300">{{ stats.eventsByType.share.toLocaleString() }}</div>
            <div class="text-xs text-gray-500">Share Access</div>
          </div>
        </div>
      </div>

      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-purple-300">{{ stats.eventsByType.diagnostic.toLocaleString() }}</div>
            <div class="text-xs text-gray-500">Diagnostics</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 mb-6">
      <div class="flex flex-wrap items-end gap-6">
        <!-- Type Filter -->
        <div>
          <label class="block text-xs text-gray-500 mb-2">Event Type</label>
          <div class="relative">
            <select
              v-model="filters.type"
              @change="applyFilters"
              class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="">All Types</option>
              <option value="agent">Agent Events</option>
              <option value="share">Share Access</option>
              <option value="session">Sessions</option>
              <option value="diagnostic">Diagnostics</option>
            </select>
            <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Agent Filter -->
        <div>
          <label class="block text-xs text-gray-500 mb-2">Agent</label>
          <div class="relative">
            <select
              v-model="filters.agentId"
              @change="applyFilters"
              class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="">All Agents</option>
              <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                {{ agent.label || agent.name || agent.id.slice(0, 8) }}
              </option>
            </select>
            <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Time Range Filter -->
        <div>
          <label class="block text-xs text-gray-500 mb-2">Time Range</label>
          <div class="relative">
            <select
              v-model="filters.timeRange"
              @change="applyFilters"
              class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Limit -->
        <div>
          <label class="block text-xs text-gray-500 mb-2">Show</label>
          <div class="relative">
            <select
              v-model="filters.limit"
              @change="applyFilters"
              class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer min-w-[150px]"
            >
              <option :value="50">50 events</option>
              <option :value="100">100 events</option>
              <option :value="250">250 events</option>
            </select>
            <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Events Timeline -->
    <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
      <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-500/10">
        <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-sm font-semibold text-white">Activity Timeline</h2>
      </div>

      <div v-if="loading" class="p-8 text-center">
        <div class="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto"></div>
        <p class="text-sm text-gray-500 mt-3">Loading events...</p>
      </div>

      <div v-else-if="fetchError" class="p-8 text-center">
        <svg class="w-8 h-8 text-red-400/60 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p class="text-sm font-medium text-red-300 mb-1">Failed to load audit data</p>
        <p class="text-xs text-gray-500 mb-3">{{ fetchError }}</p>
        <button @click="loadData" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
          Retry
        </button>
      </div>

      <div v-else-if="events.length === 0" class="p-8 text-center text-gray-500 text-sm">
        No events found for the selected filters.
      </div>

      <div v-else class="divide-y divide-gray-500/10">
        <div
          v-for="event in events"
          :key="event.id"
          class="px-5 py-4 hover:bg-gray-500/5 transition-colors"
        >
          <div class="flex items-start gap-4">
            <!-- Event Type Icon -->
            <div
              :class="getEventIconClass(event.type)"
              class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            >
              <component :is="getEventIcon(event.type)" class="w-5 h-5" />
            </div>

            <!-- Event Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-white">{{ formatEventName(event.event) }}</span>
                <span
                  :class="getEventBadgeClass(event.type)"
                  class="px-2 py-0.5 text-xs rounded-full"
                >
                  {{ event.type }}
                </span>
              </div>

              <div class="text-sm text-gray-400">
                <span v-if="event.agentLabel">Agent: {{ event.agentLabel }}</span>
                <span v-if="event.agentLabel && event.serviceName"> &middot; </span>
                <span v-if="event.serviceName">Service: {{ event.serviceName }}</span>
              </div>

              <div v-if="event.ipAddress" class="text-xs text-gray-500 mt-1">
                IP: {{ event.ipAddress }}
              </div>

              <!-- Event Details Expansion -->
              <div v-if="event.details" class="mt-2">
                <button
                  @click="toggleDetails(event.id)"
                  class="text-xs text-blue-300 hover:text-blue-400 transition-colors"
                >
                  {{ expandedEvents.has(event.id) ? 'Hide details' : 'Show details' }}
                </button>
                <pre
                  v-if="expandedEvents.has(event.id)"
                  class="mt-2 p-3 bg-gray-500/10 border border-gray-500/10 rounded-lg text-xs text-gray-300 overflow-x-auto"
                >{{ JSON.stringify(event.details, null, 2) }}</pre>
              </div>
            </div>

            <!-- Timestamp -->
            <div class="shrink-0 text-right">
              <div class="text-sm text-gray-400">{{ formatTime(event.timestamp) }}</div>
              <div class="text-xs text-gray-500">{{ formatDate(event.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';

interface AuditEvent {
  id: string;
  type: 'agent' | 'share' | 'session' | 'diagnostic';
  event: string;
  timestamp: string;
  agentId?: string;
  agentLabel?: string;
  serviceId?: string;
  serviceName?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

interface AuditStats {
  totalEvents: number;
  eventsByType: {
    agent: number;
    share: number;
    session: number;
    diagnostic: number;
  };
  eventsByDay: { date: string; count: number }[];
  topAgents: { agentId: string; label: string; count: number }[];
  topServices: { serviceId: string; name: string; count: number }[];
}

interface Agent {
  id: string;
  name?: string;
  label: string;
}

useHead({ title: 'Audit Log - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

const { fetchAuditLog, fetchAuditStats, fetchAgents } = useApi();

const loading = ref(true);
const events = ref<AuditEvent[]>([]);
const stats = ref<AuditStats | null>(null);
const agents = ref<Agent[]>([]);
const expandedEvents = ref(new Set<string>());

const filters = ref({
  type: '' as '' | 'agent' | 'share' | 'session' | 'diagnostic',
  agentId: '',
  timeRange: '24h',
  limit: 100,
});

const getTimeRangeSince = (range: string): string => {
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
};

const fetchError = ref('');

const loadData = async () => {
  loading.value = true;
  fetchError.value = '';
  try {
    const [eventsRes, statsRes, agentsRes] = await Promise.all([
      fetchAuditLog({
        limit: filters.value.limit,
        type: filters.value.type || undefined,
        agentId: filters.value.agentId || undefined,
        since: getTimeRangeSince(filters.value.timeRange),
      }),
      fetchAuditStats(),
      fetchAgents(),
    ]);
    events.value = eventsRes.events;
    stats.value = statsRes;
    agents.value = agentsRes;
  } catch (error: any) {
    fetchError.value = error.message || 'Could not reach the server. Check your connection.';
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  loadData();
};

const refreshData = () => {
  loadData();
};

const toggleDetails = (eventId: string) => {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value.delete(eventId);
  } else {
    expandedEvents.value.add(eventId);
  }
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleDateString();
};

const formatEventName = (event: string) => {
  return event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getEventIconClass = (type: string) => {
  switch (type) {
    case 'agent':
      return 'bg-blue-300/10 text-blue-300';
    case 'share':
      return 'bg-emerald-300/10 text-emerald-300';
    case 'session':
      return 'bg-amber-300/10 text-amber-300';
    case 'diagnostic':
      return 'bg-purple-300/10 text-purple-300';
    default:
      return 'bg-gray-500/10 text-gray-400';
  }
};

const getEventBadgeClass = (type: string) => {
  switch (type) {
    case 'agent':
      return 'bg-blue-300/10 text-blue-300';
    case 'share':
      return 'bg-emerald-300/10 text-emerald-300';
    case 'session':
      return 'bg-amber-300/10 text-amber-300';
    case 'diagnostic':
      return 'bg-purple-300/10 text-purple-300';
    default:
      return 'bg-gray-500/10 text-gray-400';
  }
};

// Simple icon components
const getEventIcon = (type: string) => {
  const iconClass = 'w-5 h-5';
  switch (type) {
    case 'agent':
      return h('svg', { class: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' })
      ]);
    case 'share':
      return h('svg', { class: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' })
      ]);
    case 'session':
      return h('svg', { class: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' })
      ]);
    case 'diagnostic':
      return h('svg', { class: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
      ]);
    default:
      return h('svg', { class: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
      ]);
  }
};

onMounted(() => {
  loadData();
});
</script>
