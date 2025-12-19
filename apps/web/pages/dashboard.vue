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
  </div>
</template>

<script setup lang="ts">
import type { Agent, Service } from '~/types';

definePageMeta({
  middleware: 'auth',
});

const router = useRouter();
const { fetchServices, fetchAgents } = useApi();
const { connect } = useSocket();

const agents = ref<Agent[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);

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

// Fetch data
onMounted(async () => {
  try {
    const [agentsData, servicesData] = await Promise.all([
      fetchAgents(),
      fetchServices(),
    ]);
    agents.value = agentsData;
    services.value = servicesData;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    loading.value = false;
  }

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

