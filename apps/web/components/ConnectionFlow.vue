<template>
  <div class="relative p-6 rounded-xl bg-gray-500/5 border border-gray-500/10 overflow-hidden">
    <!-- Animated background particles -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div 
        v-for="i in 6" 
        :key="i"
        class="absolute w-1 h-1 rounded-full bg-blue-300/30 animate-float"
        :style="{
          left: `${10 + i * 15}%`,
          top: `${20 + (i % 3) * 25}%`,
          animationDelay: `${i * 0.5}s`,
          animationDuration: `${3 + i * 0.5}s`
        }"
      ></div>
    </div>

    <!-- Connection Flow for External Services (Direct) -->
    <div v-if="isExternal" class="relative flex items-center justify-center gap-2 sm:gap-4">
      <!-- Hub Node -->
      <div class="flex flex-col items-center gap-2">
        <div class="relative w-20 sm:w-28 h-14 sm:h-16 rounded-lg border bg-blue-300/10 border-blue-300/30 shadow-lg shadow-blue-300/10 flex flex-col items-center justify-center transition-all duration-300">
          <svg class="w-5 h-5 text-blue-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
          <span class="text-[10px] sm:text-xs font-medium text-gray-300">Hub</span>
          <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black bg-blue-300 animate-pulse-slow"></div>
        </div>
        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Hub</span>
      </div>

      <!-- Direct Connection Line -->
      <div class="flex-1 max-w-32 sm:max-w-48 relative">
        <div class="h-[2px] bg-gradient-to-r from-blue-300/50 via-purple-300/50 to-emerald-300/50 rounded-full"></div>
        <div v-if="isHealthy" class="absolute inset-0 overflow-hidden">
          <div class="w-4 h-[2px] bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-flow"></div>
        </div>
        <!-- All checks in one row -->
        <div class="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
          <span 
            v-for="check in ['DNS', 'TCP', 'TLS', 'HTTP']" 
            :key="check"
            :class="[
              'text-[8px] px-1 py-0.5 rounded font-medium',
              getCheckStatus(check) === 'OK' ? 'bg-emerald-300/20 text-emerald-300' : 
              getCheckStatus(check) === 'FAIL' ? 'bg-red-400/20 text-red-400' : 
              'bg-gray-500/20 text-gray-500'
            ]"
          >
            {{ check }}
          </span>
        </div>
        <!-- Direct badge -->
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2">
          <span class="text-[8px] px-2 py-0.5 rounded-full bg-purple-300/20 text-purple-300 font-medium">
            DIRECT
          </span>
        </div>
      </div>

      <!-- External Service Node -->
      <div class="flex flex-col items-center gap-2">
        <div 
          :class="[
            'relative w-20 sm:w-28 h-14 sm:h-16 rounded-lg border flex flex-col items-center justify-center transition-all duration-300',
            isHealthy 
              ? 'bg-emerald-300/10 border-emerald-300/30 shadow-lg shadow-emerald-300/10' 
              : 'bg-gray-500/10 border-gray-500/20'
          ]"
        >
          <svg class="w-5 h-5 text-emerald-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span class="text-[10px] sm:text-xs font-mono text-gray-300 truncate max-w-20 sm:max-w-24">{{ targetHost }}</span>
        </div>
        <span class="text-[10px] text-gray-500 uppercase tracking-wider">External</span>
      </div>
    </div>

    <!-- Connection Flow for Agent Services (via Tunnel) -->
    <div v-else class="relative flex items-center justify-center gap-2 sm:gap-4">
      <!-- Agent Node -->
      <div class="flex flex-col items-center gap-2">
        <div 
          :class="[
            'relative w-20 sm:w-28 h-14 sm:h-16 rounded-lg border flex flex-col items-center justify-center transition-all duration-300',
            agentOnline 
              ? 'bg-blue-300/10 border-blue-300/30 shadow-lg shadow-blue-300/10' 
              : 'bg-gray-500/10 border-gray-500/20'
          ]"
        >
          <svg class="w-5 h-5 text-blue-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span class="text-[10px] sm:text-xs font-medium text-gray-300">{{ agentLabel }}</span>
          <!-- Status indicator -->
          <div 
            :class="[
              'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black',
              agentOnline ? 'bg-blue-300 animate-pulse-slow' : 'bg-gray-500'
            ]"
          ></div>
        </div>
        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Agent</span>
      </div>

      <!-- Connection Line 1 -->
      <div class="flex-1 max-w-16 sm:max-w-24 relative">
        <div class="h-[2px] bg-gradient-to-r from-blue-300/50 to-purple-300/50 rounded-full"></div>
        <!-- Animated data flow -->
        <div 
          v-if="isHealthy"
          class="absolute inset-0 overflow-hidden"
        >
          <div class="w-4 h-[2px] bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-flow"></div>
        </div>
        <!-- Check marks -->
        <div class="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
          <span 
            v-for="check in ['DNS', 'TCP']" 
            :key="check"
            :class="[
              'text-[8px] px-1 py-0.5 rounded font-medium',
              getCheckStatus(check) === 'OK' ? 'bg-emerald-300/20 text-emerald-300' : 
              getCheckStatus(check) === 'FAIL' ? 'bg-red-400/20 text-red-400' : 
              'bg-gray-500/20 text-gray-500'
            ]"
          >
            {{ check }}
          </span>
        </div>
      </div>

      <!-- Tunnel Node -->
      <div class="flex flex-col items-center gap-2">
        <div 
          :class="[
            'relative w-20 sm:w-28 h-14 sm:h-16 rounded-lg border flex flex-col items-center justify-center transition-all duration-300',
            tunnelPort 
              ? 'bg-purple-300/10 border-purple-300/30 shadow-lg shadow-purple-300/10' 
              : 'bg-gray-500/10 border-gray-500/20'
          ]"
        >
          <svg class="w-5 h-5 text-purple-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-[10px] sm:text-xs font-mono text-gray-300">:{{ tunnelPort || '—' }}</span>
        </div>
        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Tunnel</span>
      </div>

      <!-- Connection Line 2 -->
      <div class="flex-1 max-w-16 sm:max-w-24 relative">
        <div class="h-[2px] bg-gradient-to-r from-purple-300/50 to-emerald-300/50 rounded-full"></div>
        <div 
          v-if="isHealthy"
          class="absolute inset-0 overflow-hidden"
        >
          <div class="w-4 h-[2px] bg-gradient-to-r from-transparent via-purple-300 to-transparent animate-flow" style="animation-delay: 0.5s"></div>
        </div>
        <!-- Check marks -->
        <div class="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
          <span 
            v-for="check in ['TLS', 'HTTP']" 
            :key="check"
            :class="[
              'text-[8px] px-1 py-0.5 rounded font-medium',
              getCheckStatus(check) === 'OK' ? 'bg-emerald-300/20 text-emerald-300' : 
              getCheckStatus(check) === 'FAIL' ? 'bg-red-400/20 text-red-400' : 
              'bg-gray-500/20 text-gray-500'
            ]"
          >
            {{ check }}
          </span>
        </div>
      </div>

      <!-- Service Node -->
      <div class="flex flex-col items-center gap-2">
        <div 
          :class="[
            'relative w-20 sm:w-28 h-14 sm:h-16 rounded-lg border flex flex-col items-center justify-center transition-all duration-300',
            isHealthy 
              ? 'bg-emerald-300/10 border-emerald-300/30 shadow-lg shadow-emerald-300/10' 
              : 'bg-gray-500/10 border-gray-500/20'
          ]"
        >
          <svg class="w-5 h-5 text-emerald-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
          <span class="text-[10px] sm:text-xs font-mono text-gray-300 truncate max-w-20 sm:max-w-24">{{ targetHost }}</span>
        </div>
        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Service</span>
      </div>
    </div>

    <!-- Latency indicator -->
    <div v-if="latency" class="absolute bottom-3 right-4 flex items-center gap-1.5">
      <div class="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping"></div>
      <span class="text-xs font-mono text-gray-400">{{ latency }}ms</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiagnosticResult } from '~/types';

const props = defineProps<{
  agentLabel: string;
  agentOnline: boolean;
  tunnelPort: number | null;
  targetHost: string;
  latency?: number | null;
  diagnostic?: DiagnosticResult | null;
  isExternal?: boolean;
}>();

const isHealthy = computed(() => {
  if (!props.diagnostic) return props.agentOnline;
  return props.diagnostic.tcpStatus === 'OK';
});

const getCheckStatus = (check: string) => {
  if (!props.diagnostic) return 'N/A';
  switch (check) {
    case 'DNS': return props.diagnostic.dnsStatus?.includes('OK') ? 'OK' : props.diagnostic.dnsStatus === 'FAIL' ? 'FAIL' : 'N/A';
    case 'TCP': return props.diagnostic.tcpStatus;
    case 'TLS': return props.diagnostic.tlsStatus;
    case 'HTTP': return props.diagnostic.httpStatus;
    default: return 'N/A';
  }
};
</script>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
  50% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
}

@keyframes flow {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

.animate-flow {
  animation: flow 2s linear infinite;
}
</style>

