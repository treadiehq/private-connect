<template>
  <div 
    class="relative w-full rounded-xl border border-white/[0.06] overflow-hidden select-none"
    :style="{ height: `${mapHeight}px` }"
  >
    <!-- Animated grid background -->
    <div class="absolute inset-0 opacity-30">
      <div class="absolute inset-0" style="background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0); background-size: 32px 32px;"></div>
    </div>

    <!-- Zoom Controls -->
    <div class="absolute top-4 right-4 z-30 flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-500/10 p-1">
      <button 
        @click="zoomIn" 
        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-500/10 rounded transition-colors"
        :disabled="zoom >= 2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      <div class="text-[10px] text-center text-gray-500 py-0.5">{{ Math.round(zoom * 100) }}%</div>
      <button 
        @click="zoomOut" 
        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-500/10 rounded transition-colors"
        :disabled="zoom <= 0.5"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
      <button 
        @click="resetView" 
        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-500/10 rounded transition-colors border-t border-gray-500/10 mt-1"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- SVG Canvas for connections -->
    <svg 
      ref="svgCanvas"
      class="absolute inset-0 w-full h-full pointer-events-none z-10"
      :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <!-- Glow filters -->
        <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Gradients for connections -->
        <linearGradient id="gradient-healthy" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#93c5fd" />
          <stop offset="50%" stop-color="#c4b5fd" />
          <stop offset="100%" stop-color="#6ee7b7" />
        </linearGradient>
        <linearGradient id="gradient-unhealthy" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6b7280" />
          <stop offset="100%" stop-color="#f87171" />
        </linearGradient>
        <linearGradient id="gradient-offline" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#4b5563" />
          <stop offset="100%" stop-color="#6b7280" />
        </linearGradient>
      </defs>

      <!-- Agent Connections (curved paths) -->
      <g v-for="(agent, index) in agents" :key="`conn-agent-${agent.id}`">
        <path
          :d="getAgentPath(index)"
          fill="none"
          :stroke="agent.isOnline ? 'url(#gradient-healthy)' : 'url(#gradient-offline)'"
          :stroke-width="getConnectionWidth(agent)"
          :stroke-opacity="focusedNode && focusedNode !== agent.id ? 0.2 : 1"
          stroke-linecap="round"
          class="transition-all duration-300"
        />
        <!-- Animated packets -->
        <g v-if="agent.isOnline">
          <circle
            v-for="p in 3"
            :key="p"
            :r="4"
            :fill="getPacketColor('agent')"
            :filter="'url(#glow-blue)'"
            :opacity="focusedNode && focusedNode !== agent.id ? 0.2 : 1"
          >
            <animateMotion 
              :dur="`${1.5 + p * 0.3}s`" 
              repeatCount="indefinite"
              :begin="`${p * 0.5}s`"
            >
              <mpath :href="`#agent-path-${agent.id}`" />
            </animateMotion>
          </circle>
        </g>
        <path
          :id="`agent-path-${agent.id}`"
          :d="getAgentPath(index)"
          fill="none"
          stroke="none"
        />
        
        <!-- Connection label (latency) - only show if there's data -->
        <g v-if="agent.isOnline && getAgentLatency(agent)" :transform="getAgentLabelPosition(index)">
          <rect
            x="-20"
            y="-10"
            width="40"
            height="20"
            rx="4"
            fill="rgba(0,0,0,0.8)"
            :opacity="focusedNode && focusedNode !== agent.id ? 0.2 : 1"
          />
          <text
            text-anchor="middle"
            dominant-baseline="middle"
            fill="#9ca3af"
            font-size="10"
            font-family="monospace"
            :opacity="focusedNode && focusedNode !== agent.id ? 0.2 : 1"
          >
            {{ getAgentLatency(agent) }}
          </text>
        </g>
      </g>

      <!-- Service Connections (curved paths) -->
      <g v-for="(service, index) in services" :key="`conn-service-${service.id}`">
        <path
          :d="getServicePath(index)"
          fill="none"
          :stroke="service.status === 'OK' ? 'url(#gradient-healthy)' : service.status === 'FAIL' ? 'url(#gradient-unhealthy)' : 'url(#gradient-offline)'"
          :stroke-width="getServiceConnectionWidth(service)"
          :stroke-opacity="focusedNode && focusedNode !== service.id ? 0.2 : 1"
          stroke-linecap="round"
          class="transition-all duration-300"
        />
        <!-- Animated packets -->
        <g v-if="service.status === 'OK'">
          <circle
            v-for="p in 3"
            :key="p"
            :r="4"
            :fill="getPacketColor(service.protocol)"
            :filter="'url(#glow-green)'"
            :opacity="focusedNode && focusedNode !== service.id ? 0.2 : 1"
          >
            <animateMotion 
              :dur="`${1.5 + p * 0.3}s`" 
              repeatCount="indefinite"
              :begin="`${index * 0.2 + p * 0.5}s`"
            >
              <mpath :href="`#service-path-${service.id}`" />
            </animateMotion>
          </circle>
        </g>
        <path
          :id="`service-path-${service.id}`"
          :d="getServicePath(index)"
          fill="none"
          stroke="none"
        />
        
        <!-- Connection label (latency + protocol) - only show if there's data -->
        <g v-if="getServiceLabel(service)" :transform="getServiceLabelPosition(index)">
          <rect
            x="-30"
            y="-10"
            width="60"
            height="20"
            rx="4"
            fill="rgba(0,0,0,0.8)"
            :opacity="focusedNode && focusedNode !== service.id ? 0.2 : 1"
          />
          <text
            text-anchor="middle"
            dominant-baseline="middle"
            fill="#9ca3af"
            font-size="10"
            font-family="monospace"
            :opacity="focusedNode && focusedNode !== service.id ? 0.2 : 1"
          >
            {{ getServiceLabel(service) }}
          </text>
        </g>
      </g>
    </svg>

    <!-- Zoomable/Pannable container -->
    <div 
      ref="mapContainer"
      class="absolute inset-0 z-20"
      :style="{ 
        transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
        transformOrigin: 'center center',
        transition: isDragging ? 'none' : 'transform 0.3s ease-out'
      }"
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
      @wheel="handleWheel"
    >
      <!-- Hub -->
      <div 
        class="absolute left-[38%] top-1/2 -translate-x-1/2 -translate-y-1/2"
        @click="handleHubClick"
        @mouseenter="hoveredNode = 'hub'"
        @mouseleave="hoveredNode = null"
      >
        <div class="relative">
          <!-- Pulse rings -->
          <div class="absolute inset-0 -m-6 rounded-full border-2 border-blue-300/30 animate-ping-slow"></div>
          <div class="absolute inset-0 -m-12 rounded-full border border-blue-300/20 animate-ping-slower"></div>
          
          <!-- Hub glow -->
          <div class="absolute inset-0 -m-2 rounded-2xl bg-blue-300/10 blur-xl"></div>
          
          <!-- Hub node -->
          <div 
            :class="[
              'relative w-24 h-24 rounded-2xl bg-blue-300/10 border-2 flex flex-col items-center justify-center shadow-2xl cursor-pointer transition-all duration-300',
              focusedNode === 'hub' || hoveredNode === 'hub' ? 'border-blue-300 scale-110' : 'border-blue-300/50'
            ]"
          >
            <svg class="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <span class="text-sm font-medium text-white mt-1">Hub</span>
          </div>
        </div>

        <!-- Hub Tooltip -->
        <Transition name="tooltip">
          <div 
            v-if="hoveredNode === 'hub'"
            class="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-sm border border-gray-500/20 rounded-xl p-4 min-w-48 z-50 pointer-events-none"
          >
            <div class="text-sm font-semibold text-white mb-2">Private Connect Hub</div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-500">Agents:</span>
                <span class="text-white">{{ agents.length }} ({{ agents.filter(a => a.isOnline).length }} online)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Services:</span>
                <span class="text-white">{{ services.length }} ({{ services.filter(s => s.status === 'OK').length }} healthy)</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Agents -->
      <div 
        v-for="(agent, index) in agents" 
        :key="agent.id"
        class="absolute"
        :style="getAgentPosition(index)"
      >
        <div 
          class="relative"
          @click="handleAgentClick(agent)"
          @mouseenter="hoveredNode = agent.id"
          @mouseleave="hoveredNode = null"
        >
          <!-- Agent glow -->
          <div 
            v-if="agent.isOnline"
            class="absolute inset-0 -m-1 rounded-xl bg-blue-300/20 blur-lg transition-opacity"
            :class="focusedNode === agent.id || hoveredNode === agent.id ? 'opacity-100' : 'opacity-50'"
          ></div>

          <!-- Agent node -->
          <div 
            :class="[
              'relative w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300',
              focusedNode === agent.id || hoveredNode === agent.id ? 'scale-110' : '',
              focusedNode && focusedNode !== agent.id ? 'opacity-30' : '',
              agent.isOnline 
                ? 'bg-blue-300/10 border-blue-300/30 shadow-lg shadow-blue-300/10' 
                : 'bg-gray-500/10 border-gray-500/30'
            ]"
          >
            <svg class="w-6 h-6" :class="agent.isOnline ? 'text-blue-300' : 'text-gray-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span class="text-[10px] text-gray-300 mt-0.5 truncate max-w-14">{{ agent.label }}</span>
            <!-- Status dot -->
            <div 
              :class="[
                'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black',
                agent.isOnline ? 'bg-emerald-300' : 'bg-gray-500'
              ]"
            ></div>
            <!-- Mini sparkline -->
            <div 
              v-if="agent.isOnline"
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-px"
            >
              <div 
                v-for="i in 5" 
                :key="i"
                class="w-1 bg-blue-300/60 rounded-full"
                :style="{ height: `${4 + Math.random() * 6}px` }"
              ></div>
            </div>
          </div>

          <!-- Agent Tooltip -->
          <Transition name="tooltip">
            <div 
              v-if="hoveredNode === agent.id"
              class="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-sm border border-gray-500/20 rounded-xl p-4 min-w-52 z-50 pointer-events-none"
            >
              <div class="flex items-center gap-2 mb-3">
                <div :class="['w-2 h-2 rounded-full', agent.isOnline ? 'bg-emerald-300' : 'bg-gray-500']"></div>
                <span class="text-sm font-semibold text-white">{{ agent.label }}</span>
              </div>
              <div class="space-y-1.5 text-xs">
                <div class="flex justify-between">
                  <span class="text-gray-500">Status:</span>
                  <span :class="agent.isOnline ? 'text-emerald-300' : 'text-gray-400'">{{ agent.isOnline ? 'Online' : 'Offline' }}</span>
                </div>
                <div v-if="agent.name" class="flex justify-between">
                  <span class="text-gray-500">Name:</span>
                  <span class="text-white">{{ agent.name }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Services:</span>
                  <span class="text-white">{{ agent.services?.length || 0 }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Last seen:</span>
                  <span class="text-white">{{ formatTime(agent.lastSeenAt) }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Services -->
      <div 
        v-for="(service, index) in services" 
        :key="service.id"
        class="absolute"
        :style="getServicePosition(index)"
      >
        <div 
          class="relative"
          @click="handleServiceClick(service)"
          @mouseenter="hoveredNode = service.id"
          @mouseleave="hoveredNode = null"
        >
          <!-- Service glow -->
          <div 
            v-if="service.status === 'OK'"
            class="absolute inset-0 -m-1 rounded-xl bg-emerald-300/20 blur-lg transition-opacity"
            :class="focusedNode === service.id || hoveredNode === service.id ? 'opacity-100' : 'opacity-50'"
          ></div>
          <div 
            v-else-if="service.status === 'FAIL'"
            class="absolute inset-0 -m-1 rounded-xl bg-red-400/20 blur-lg animate-pulse"
          ></div>

          <!-- Service node -->
          <div 
            :class="[
              'relative w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300',
              focusedNode === service.id || hoveredNode === service.id ? 'scale-110' : '',
              focusedNode && focusedNode !== service.id ? 'opacity-30' : '',
              service.status === 'OK' 
                ? 'bg-gradient-to-br from-emerald-300/10 to-emerald-300/5 border-emerald-300/50 shadow-lg shadow-emerald-300/10' 
                : service.status === 'FAIL'
                ? 'bg-red-400/10 border-red-400/50 shadow-lg shadow-red-400/10'
                : 'bg-gray-500/10 border-gray-500/30'
            ]"
          >
            <svg 
              v-if="service.isExternal"
              class="w-6 h-6" 
              :class="service.status === 'OK' ? 'text-emerald-300' : service.status === 'FAIL' ? 'text-red-400' : 'text-gray-500'" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <svg 
              v-else
              class="w-6 h-6" 
              :class="service.status === 'OK' ? 'text-emerald-300' : service.status === 'FAIL' ? 'text-red-400' : 'text-gray-500'" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <span class="text-[10px] text-gray-300 mt-0.5 truncate max-w-14">{{ service.name }}</span>
            <!-- Status dot -->
            <div 
              :class="[
                'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black',
                service.status === 'OK' ? 'bg-emerald-300' : service.status === 'FAIL' ? 'bg-red-400' : 'bg-gray-500'
              ]"
            ></div>
            <!-- Protocol badge -->
            <div 
              v-if="service.protocol && service.protocol !== 'auto'"
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/80 rounded text-[8px] font-mono uppercase"
              :class="getProtocolColor(service.protocol)"
            >
              {{ service.protocol }}
            </div>
          </div>

          <!-- Service Tooltip -->
          <Transition name="tooltip">
            <div 
              v-if="hoveredNode === service.id"
              class="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-sm border border-gray-500/20 rounded-xl p-4 min-w-56 z-50 pointer-events-none"
            >
              <div class="flex items-center gap-2 mb-3">
                <div :class="['w-2 h-2 rounded-full', service.status === 'OK' ? 'bg-emerald-300' : service.status === 'FAIL' ? 'bg-red-400' : 'bg-gray-500']"></div>
                <span class="text-sm font-semibold text-white">{{ service.name }}</span>
                <span 
                  v-if="service.isExternal"
                  class="px-1.5 py-0.5 bg-purple-300/20 text-purple-300 text-[10px] rounded"
                >External</span>
              </div>
              <div class="space-y-1.5 text-xs">
                <div class="flex justify-between">
                  <span class="text-gray-500">Status:</span>
                  <span :class="service.status === 'OK' ? 'text-emerald-300' : service.status === 'FAIL' ? 'text-red-400' : 'text-gray-400'">
                    {{ service.status === 'OK' ? 'Healthy' : service.status === 'FAIL' ? 'Unhealthy' : 'Unknown' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Target:</span>
                  <span class="text-white font-mono">{{ service.targetHost }}:{{ service.targetPort }}</span>
                </div>
                <div v-if="service.protocol" class="flex justify-between">
                  <span class="text-gray-500">Protocol:</span>
                  <span class="text-white uppercase">{{ service.protocol }}</span>
                </div>
                <div v-if="getServiceLatency(service)" class="flex justify-between">
                  <span class="text-gray-500">Latency:</span>
                  <span :class="getLatencyColor(getServiceLatency(service))">{{ getServiceLatency(service) }}ms</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Last check:</span>
                  <span class="text-white">{{ formatTime(service.lastCheckedAt) }}</span>
                </div>
              </div>
              <!-- Mini latency chart -->
              <div v-if="service.diagnostics?.length > 1" class="mt-3 pt-3 border-t border-gray-500/20">
                <div class="text-[10px] text-gray-500 mb-1">Latency History</div>
                <div class="flex items-end gap-px h-8">
                  <div 
                    v-for="(diag, i) in service.diagnostics.slice(0, 10).reverse()" 
                    :key="i"
                    class="flex-1 rounded-t"
                    :class="diag.latencyMs ? (diag.latencyMs < 50 ? 'bg-emerald-300' : diag.latencyMs < 100 ? 'bg-amber-300' : 'bg-red-400') : 'bg-gray-600'"
                    :style="{ height: diag.latencyMs ? `${Math.min(100, (diag.latencyMs / 200) * 100)}%` : '10%' }"
                  ></div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="absolute bottom-4 left-4 z-30 flex items-center gap-4 text-xs text-gray-500 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-500/20">
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-emerald-300"></div>
        <span>Healthy</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-red-400"></div>
        <span>Unhealthy</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-gray-500"></div>
        <span>Unknown</span>
      </div>
      <div class="border-l border-gray-500/20 pl-4 flex items-center gap-1.5">
        <div class="w-3 h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 rounded"></div>
        <span>Active</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="absolute bottom-4 right-4 z-30 flex items-center gap-4 text-xs text-gray-400 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/5">
      <span>{{ agents.filter(a => a.isOnline).length }}/{{ agents.length }} agents online</span>
      <span>{{ services.filter(s => s.status === 'OK').length }}/{{ services.length }} services healthy</span>
    </div>

    <!-- Click outside to unfocus -->
    <div 
      v-if="focusedNode"
      class="absolute inset-0 z-10"
      @click="focusedNode = null"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type { Agent, Service } from '~/types';

const props = defineProps<{
  agents: Agent[];
  services: Service[];
}>();

const emit = defineEmits<{
  hubClick: [];
  agentClick: [agent: Agent];
  serviceClick: [service: Service];
}>();

// Zoom & Pan state
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

// Interaction state
const hoveredNode = ref<string | null>(null);
const focusedNode = ref<string | null>(null);

// Canvas dimensions
const canvasWidth = 800;
const canvasHeight = 400;
const mapHeight = 400;

// Zoom controls
const zoomIn = () => { zoom.value = Math.min(2, zoom.value + 0.1); };
const zoomOut = () => { zoom.value = Math.max(0.5, zoom.value - 0.1); };
const resetView = () => { zoom.value = 1; panX.value = 0; panY.value = 0; };

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  zoom.value = Math.max(0.5, Math.min(2, zoom.value + delta));
};

// Pan controls
const startDrag = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    isDragging.value = true;
    dragStart.value = { x: e.clientX - panX.value, y: e.clientY - panY.value };
  }
};
const drag = (e: MouseEvent) => {
  if (isDragging.value) {
    panX.value = e.clientX - dragStart.value.x;
    panY.value = e.clientY - dragStart.value.y;
  }
};
const endDrag = () => { isDragging.value = false; };

// Click handlers
const handleHubClick = () => {
  focusedNode.value = focusedNode.value === 'hub' ? null : 'hub';
  emit('hubClick');
};
const handleAgentClick = (agent: Agent) => {
  focusedNode.value = focusedNode.value === agent.id ? null : agent.id;
  emit('agentClick', agent);
};
const handleServiceClick = (service: Service) => {
  focusedNode.value = focusedNode.value === service.id ? null : service.id;
  emit('serviceClick', service);
};

// Position calculations
const getAgentPosition = (index: number) => {
  const total = props.agents.length;
  const spacing = Math.min(80, 300 / total);
  const startY = 50 - ((total - 1) * spacing) / 2 / 4;
  return { left: '15%', top: `${startY + index * spacing / 4}%`, transform: 'translate(-50%, -50%)' };
};

const getServicePosition = (index: number) => {
  const total = props.services.length;
  const spacing = Math.min(80, 300 / total);
  const startY = 50 - ((total - 1) * spacing) / 2 / 4;
  return { left: '72%', top: `${startY + index * spacing / 4}%`, transform: 'translate(-50%, -50%)' };
};

// SVG Path calculations (curved bezier paths)
const getAgentPath = (index: number) => {
  const agentX = canvasWidth * 0.15;
  const hubX = canvasWidth * 0.38;
  const total = props.agents.length;
  const spacing = Math.min(80, 300 / total);
  const startY = canvasHeight / 2 - ((total - 1) * spacing) / 2;
  const agentY = startY + index * spacing;
  const hubY = canvasHeight / 2;
  
  // Bezier curve control points
  const cx1 = agentX + (hubX - agentX) * 0.4;
  const cx2 = agentX + (hubX - agentX) * 0.6;
  
  return `M ${agentX + 32} ${agentY} C ${cx1} ${agentY}, ${cx2} ${hubY}, ${hubX - 48} ${hubY}`;
};

const getServicePath = (index: number) => {
  const serviceX = canvasWidth * 0.72;
  const hubX = canvasWidth * 0.38;
  const total = props.services.length;
  const spacing = Math.min(80, 300 / total);
  const startY = canvasHeight / 2 - ((total - 1) * spacing) / 2;
  const serviceY = startY + index * spacing;
  const hubY = canvasHeight / 2;
  
  // Bezier curve control points
  const cx1 = hubX + (serviceX - hubX) * 0.4;
  const cx2 = hubX + (serviceX - hubX) * 0.6;
  
  return `M ${hubX + 48} ${hubY} C ${cx1} ${hubY}, ${cx2} ${serviceY}, ${serviceX - 32} ${serviceY}`;
};

// Label positions (midpoint of curves)
const getAgentLabelPosition = (index: number) => {
  const agentX = canvasWidth * 0.15;
  const hubX = canvasWidth * 0.38;
  const total = props.agents.length;
  const spacing = Math.min(80, 300 / total);
  const startY = canvasHeight / 2 - ((total - 1) * spacing) / 2;
  const agentY = startY + index * spacing;
  const hubY = canvasHeight / 2;
  
  const midX = (agentX + hubX) / 2;
  const midY = (agentY + hubY) / 2;
  
  return `translate(${midX}, ${midY - 15})`;
};

const getServiceLabelPosition = (index: number) => {
  const serviceX = canvasWidth * 0.72;
  const hubX = canvasWidth * 0.38;
  const total = props.services.length;
  const spacing = Math.min(80, 300 / total);
  const startY = canvasHeight / 2 - ((total - 1) * spacing) / 2;
  const serviceY = startY + index * spacing;
  const hubY = canvasHeight / 2;
  
  const midX = (hubX + serviceX) / 2;
  const midY = (serviceY + hubY) / 2;
  
  return `translate(${midX}, ${midY - 15})`;
};

// Connection width based on latency (thicker = faster)
const getConnectionWidth = (agent: Agent) => {
  if (!agent.isOnline) return 1;
  return 2;
};

const getServiceConnectionWidth = (service: Service) => {
  const latency = getServiceLatency(service);
  if (!latency) return 2;
  if (latency < 50) return 3;
  if (latency < 100) return 2.5;
  return 2;
};

// Packet colors based on protocol
const getPacketColor = (protocol: string) => {
  switch (protocol?.toLowerCase()) {
    case 'https': return '#93c5fd'; // Blue
    case 'http': return '#fbbf24'; // Amber
    case 'tcp': return '#c4b5fd'; // Purple
    case 'agent': return '#93c5fd'; // Blue
    default: return '#6ee7b7'; // Green
  }
};

const getProtocolColor = (protocol: string) => {
  switch (protocol?.toLowerCase()) {
    case 'https': return 'text-blue-300';
    case 'http': return 'text-amber-300';
    case 'tcp': return 'text-purple-300';
    default: return 'text-gray-400';
  }
};

// Data helpers
const getAgentLatency = (agent: Agent) => {
  // Get average latency from agent's services
  const services = props.services.filter(s => s.agentId === agent.id);
  const latencies = services
    .map(s => s.diagnostics?.[0]?.latencyMs)
    .filter((l): l is number => l !== null && l !== undefined);
  
  if (latencies.length === 0) return null;
  return `${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)}ms`;
};

const getServiceLatency = (service: Service) => {
  return service.diagnostics?.[0]?.latencyMs || null;
};

const getServiceLabel = (service: Service) => {
  const latency = getServiceLatency(service);
  const protocol = service.protocol?.toUpperCase() || '';
  if (latency) return `${latency}ms`;
  if (protocol && protocol !== 'AUTO') return protocol;
  return null; // Don't show label if no data
};

const getLatencyColor = (latency: number | null) => {
  if (!latency) return 'text-gray-400';
  if (latency < 50) return 'text-emerald-300';
  if (latency < 100) return 'text-amber-400';
  return 'text-red-400';
};

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

<style scoped>
@keyframes ping-slow {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes ping-slower {
  0% { transform: scale(1); opacity: 0.3; }
  100% { transform: scale(2); opacity: 0; }
}

.animate-ping-slow {
  animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.animate-ping-slower {
  animation: ping-slower 4s cubic-bezier(0, 0, 0.2, 1) infinite;
  animation-delay: 1s;
}

/* Tooltip transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.95);
}
</style>
