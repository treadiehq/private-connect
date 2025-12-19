<template>
  <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.1] transition-colors">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
      <div class="flex items-center gap-3">
        <div 
          :class="[
            'w-8 h-8 rounded-lg flex items-center justify-center',
            service.isExternal ? 'bg-purple-300/10' : 'bg-blue-300/10'
          ]"
        >
          <svg v-if="service.isExternal" class="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <svg v-else class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        </div>
        <div>
          <NuxtLink 
            :to="`/services/${service.id}`"
            class="text-base font-semibold text-white hover:text-blue-300 transition-colors"
          >
            {{ service.name }}
          </NuxtLink>
        </div>
      </div>
      <NuxtLink 
        :to="`/services/${service.id}`"
        class="text-sm text-gray-500 hover:text-blue-400 group transition-colors"
      >
        Details <span class="">→</span>
      </NuxtLink>
    </div>

    <!-- Status Row -->
    <div class="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
      <span 
        :class="[
          'w-2 h-2 rounded-full',
          service.status === 'OK' ? 'bg-emerald-400' : service.status === 'FAIL' ? 'bg-red-400' : 'bg-gray-500'
        ]"
      ></span>
      <span class="text-sm text-gray-300">
        {{ service.status === 'OK' ? 'Healthy' : service.status === 'FAIL' ? 'Unhealthy' : 'Unknown' }}
      </span>
      <span v-if="service.isExternal" class="ml-2 text-xs text-gray-500">• External</span>
    </div>

    <!-- Metrics Table -->
    <div class="divide-y divide-white/[0.04]">
      <!-- Table Header -->
      <div class="flex items-center px-5 py-2 bg-white/[0.02]">
        <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</span>
        <span class="w-32 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Status</span>
      </div>

      <!-- Target -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Target</span>
        <span class="w-32 text-sm text-gray-200 text-right font-mono">{{ service.targetHost }}:{{ service.targetPort }}</span>
      </div>

      <!-- Tunnel Port -->
      <div v-if="service.tunnelPort" class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Tunnel Port</span>
        <span class="w-32 text-sm text-blue-300 text-right font-mono">:{{ service.tunnelPort }}</span>
      </div>

      <!-- Connection Type -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Connection</span>
        <span class="w-32 text-sm text-right flex items-center justify-end gap-2">
          <span :class="service.isExternal ? 'text-purple-300' : 'text-blue-300'">
            {{ service.isExternal ? 'Direct' : 'Tunnel' }}
          </span>
        </span>
      </div>

      <!-- Diagnostics if available -->
      <template v-if="latestDiagnostic">
        <div class="flex items-center px-5 py-3">
          <span class="flex-1 text-sm text-gray-400">DNS</span>
          <span class="w-32 text-right flex items-center justify-end gap-2">
            <span :class="getDnsStatus === 'OK' ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-red-400'"></span>
            <span :class="getDnsStatus === 'OK' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'">{{ getDnsStatus }}</span>
          </span>
        </div>

        <div class="flex items-center px-5 py-3">
          <span class="flex-1 text-sm text-gray-400">TCP</span>
          <span class="w-32 text-right flex items-center justify-end gap-2">
            <span :class="latestDiagnostic.tcpStatus === 'OK' ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-red-400'"></span>
            <span :class="latestDiagnostic.tcpStatus === 'OK' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'">{{ latestDiagnostic.tcpStatus }}</span>
          </span>
        </div>

        <div v-if="latestDiagnostic.tlsStatus" class="flex items-center px-5 py-3">
          <span class="flex-1 text-sm text-gray-400">TLS</span>
          <span class="w-32 text-right flex items-center justify-end gap-2">
            <span :class="latestDiagnostic.tlsStatus === 'OK' ? 'w-2 h-2 rounded-full bg-emerald-400' : 'w-2 h-2 rounded-full bg-red-400'"></span>
            <span :class="latestDiagnostic.tlsStatus === 'OK' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'">{{ latestDiagnostic.tlsStatus }}</span>
          </span>
        </div>

        <div v-if="latestDiagnostic.latencyMs" class="flex items-center px-5 py-3">
          <span class="flex-1 text-sm text-gray-400">Latency</span>
          <span class="w-32 text-right flex items-center justify-end gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-sm text-gray-200 font-mono">{{ latestDiagnostic.latencyMs }}ms</span>
          </span>
        </div>
      </template>

      <!-- Last Check -->
      <div class="flex items-center px-5 py-3">
        <span class="flex-1 text-sm text-gray-400">Last Check</span>
        <span class="w-32 text-sm text-gray-300 text-right">{{ formatTime(service.lastCheckedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Service, DiagnosticResult } from '~/types';

const props = defineProps<{
  service: Service;
}>();

defineEmits<{
  check: [serviceId: string];
}>();

const latestDiagnostic = computed<DiagnosticResult | null>(() => {
  return props.service.diagnostics?.[0] || null;
});

const getDnsStatus = computed(() => {
  if (!latestDiagnostic.value) return 'N/A';
  const status = latestDiagnostic.value.dnsStatus;
  if (status.includes('OK')) return 'OK';
  return status;
});

const formatTime = (date: string | null | undefined) => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
};
</script>
