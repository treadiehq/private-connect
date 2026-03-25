<template>
  <div class="animate-fade-in">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex items-center gap-3 text-gray-400">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading diagnostic...</span>
      </div>
    </div>

    <!-- Diagnostic Detail -->
    <div v-else-if="diagnostic" class="max-w-2xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="mb-4">
          <StatusPill :status="diagnostic.tcpStatus === 'OK' ? 'OK' : 'FAIL'" size="lg" />
        </div>
        <h1 class="text-2xl font-bold mb-2">
          Diagnostic Result
        </h1>
        <p class="text-gray-400">
          {{ diagnostic.service?.name }} • {{ formatTime(diagnostic.createdAt) }}
        </p>
      </div>

      <!-- Diagnostic Card -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-6">
        <!-- Service Info -->
        <div class="mb-6 pb-6 border-b border-gray-500/10">
          <h3 class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Service</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="flex-1 text-sm text-gray-400">Name</span>
              <span class="text-sm text-white text-right font-mono">{{ diagnostic.service?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="flex-1 text-sm text-gray-400">Target</span>
              <span class="text-sm text-white text-right font-mono">{{ diagnostic.service?.targetHost }}:{{ diagnostic.service?.targetPort }}</span>
            </div>
          </div>
        </div>

        <!-- Metrics -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <DiagnosticItem label="DNS" :status="diagnostic.dnsStatus" />
          <DiagnosticItem label="TCP" :status="diagnostic.tcpStatus" />
          <DiagnosticItem label="TLS" :status="diagnostic.tlsStatus || 'N/A'" />
          <DiagnosticItem label="Latency" :status="diagnostic.latencyMs ? `${diagnostic.latencyMs}ms` : 'N/A'" />
        </div>

        <!-- Message -->
        <div class="bg-gray-500/10 rounded-lg p-4 mb-6">
          <div class="font-mono text-sm" :class="diagnostic.message === 'OK' ? 'text-blue-300' : 'text-red-400'">
            {{ diagnostic.message }}
          </div>
        </div>

        <!-- Metadata -->
        <div class="text-sm text-gray-500 space-y-1">
          <div class="flex justify-between">
            <span class="flex-1 text-sm text-gray-400">Perspective</span>
            <span class="text-sm text-white text-right font-mono">{{ diagnostic.perspective === 'hub' ? 'Hub' : 'Agent' }}</span>
          </div>
          <div v-if="diagnostic.sourceAgent" class="flex justify-between">
            <span class="flex-1 text-sm text-gray-400">Source</span>
            <span class="text-sm text-white text-right font-mono">{{ diagnostic.sourceAgent.label }}</span>
          </div>
          <div class="flex justify-between">
            <span class="flex-1 text-sm text-gray-400">Timestamp</span>
            <span class="text-sm text-white text-right font-mono">{{ new Date(diagnostic.createdAt).toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Back link -->
      <div class="text-center mt-6">
        <NuxtLink 
          v-if="diagnostic.service?.id"
          :to="`/services/${diagnostic.service.id}`" 
          class="text-blue-300 hover:underline"
        >
          View Service Details →
        </NuxtLink>
      </div>
    </div>

    <!-- Not Found (404) -->
    <div v-else-if="notFound" class="text-center py-20">
      <h2 class="text-2xl font-bold mb-2">Diagnostic not found</h2>
      <p class="text-gray-400 mb-4">This diagnostic result may have expired or doesn't exist.</p>
      <NuxtLink to="/services" class="text-blue-300 hover:text-blue-200 text-sm">&larr; Back to services</NuxtLink>
    </div>

    <!-- Error State -->
    <div v-else class="text-center py-20">
      <svg class="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <h2 class="text-lg font-semibold text-red-300 mb-1">Failed to load diagnostic</h2>
      <p class="text-sm text-gray-500 mb-4">{{ fetchError }}</p>
      <button @click="retryFetch" class="px-4 py-2 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors">
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiagnosticResult } from '~/types';
import { ApiError } from '~/composables/useApi';

const route = useRoute();
const { fetchDiagnosticByShareToken } = useApi();

const diagnostic = ref<DiagnosticResult | null>(null);
const loading = ref(true);
const notFound = ref(false);
const fetchError = ref('');

const pageTitle = computed(() => 
  diagnostic.value?.service?.name 
    ? `${diagnostic.value.service.name} Diagnostic - Private Connect` 
    : 'Diagnostic - Private Connect'
)
useHead({ title: pageTitle })

const retryFetch = async () => {
  loading.value = true;
  fetchError.value = '';
  notFound.value = false;
  try {
    diagnostic.value = await fetchDiagnosticByShareToken(route.params.token as string);
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

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
};
</script>

