<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Loading -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-xl bg-blue-300/10 flex items-center justify-center">
          <svg class="animate-spin h-6 w-6 text-blue-300" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-gray-400">Connecting to tunnel...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-3">Tunnel Unavailable</h1>
        <p class="text-gray-400 mb-6">{{ error }}</p>
        <a href="https://privateconnect.co" class="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Go to Private Connect</span>
        </a>
      </div>
    </div>

    <!-- Database Client -->
    <div v-else-if="tunnelInfo && tunnelInfo.serviceType === 'database'" class="h-screen flex flex-col">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-6 py-3 bg-gray-500/5 border-b border-gray-500/10">
        <div class="flex items-center gap-4">
          <a href="https://privateconnect.co" class="text-gray-500 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <div class="h-6 w-px bg-gray-500/20"></div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-white">{{ tunnelInfo.databaseType }}</span>
              <span class="text-xs bg-emerald-300/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/20">
                {{ tunnelInfo.databaseType }}
              </span>
              <span v-if="!tunnelInfo.connected" class="text-xs bg-amber-300/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-300/20">
                Disconnected
              </span>
            </div>
            <p class="text-xs text-gray-500">Temporary tunnel &middot; expires {{ formatExpiry(tunnelInfo.expiresAt) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs text-gray-600">No installation required</span>
          <a href="https://privateconnect.co" class="text-xs text-blue-300 hover:text-blue-400 transition-colors hidden sm:block">
            Powered by Private Connect
          </a>
        </div>
      </div>

      <!-- SQL Client -->
      <div class="flex-1">
        <WebSQLClient
          :token="tunnelId"
          :service-name="tunnelInfo.databaseType || 'Database'"
          :connection-info="`localhost:${tunnelInfo.localPort}`"
          :is-connected="tunnelInfo.connected"
          :query-url="queryUrl"
        />
      </div>
    </div>

    <!-- Unsupported service type -->
    <div v-else-if="tunnelInfo" class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-xl bg-gray-500/10 border border-gray-500/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-3">Tunnel Active</h1>
        <p class="text-gray-400 mb-6">This tunnel is active but the web viewer is only available for database services.</p>
        <p class="text-sm text-gray-500">Use the CLI to connect directly.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
});

interface TunnelInfo {
  tunnelId: string;
  type: string;
  localPort: number;
  connected: boolean;
  expiresAt: string;
  serviceType: string;
  databaseType: string | null;
}

const route = useRoute();
const config = useRuntimeConfig();
const tunnelId = computed(() => route.params.tunnelId as string);

const loading = ref(true);
const error = ref<string | null>(null);
const tunnelInfo = ref<TunnelInfo | null>(null);

const queryUrl = computed(() =>
  `${config.public.apiBase}/v1/tunnels/temporary/${tunnelId.value}/query`
);

const formatExpiry = (date: string): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'expired';
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return `on ${d.toLocaleDateString()}`;
};

const loadTunnelInfo = async () => {
  try {
    const response = await fetch(
      `${config.public.apiBase}/v1/tunnels/temporary/${tunnelId.value}/info`,
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'This tunnel has expired or does not exist');
    }

    tunnelInfo.value = await response.json();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  loadTunnelInfo();
  pollInterval = setInterval(loadTunnelInfo, 10000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});

useHead({
  title: computed(() =>
    tunnelInfo.value
      ? `${tunnelInfo.value.databaseType || 'Tunnel'} - Private Connect`
      : 'Tunnel - Private Connect',
  ),
});
</script>
