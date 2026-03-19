<template>
  <div class="min-h-screen bg-black relative antialiased">
    <!-- Background gradient -->
    <!-- <div class="radial-gradient absolute top-0 right-14 pointer-events-none"></div> -->
    
    <!-- Header -->
    <div class="border-b border-gray-500/10 bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="text-gray-400 hover:text-white transition-colors">
            <!-- <span class="font-medium text-sm sm:text-base">Private Connect</span> -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4 text-white">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
          </NuxtLink>
          <span class="text-gray-500/40">/</span>
          <span class="text-white font-medium text-sm sm:text-base">Debug Session</span>
          <span class="hidden sm:inline-flex px-2 py-0.5 text-xs font-mono bg-gray-500/10 border border-gray-500/10 text-gray-500 rounded">
            {{ route.params.token }}
          </span>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Connection Status -->
          <div class="flex items-center gap-2 text-xs sm:text-sm">
            <span 
              class="w-2 h-2 rounded-full" 
              :class="isSessionEnded ? 'bg-gray-500' : (isConnected ? 'bg-emerald-300 animate-pulse' : 'bg-red-400')"
            ></span>
            <span :class="isSessionEnded ? 'text-gray-500' : (isConnected ? 'text-emerald-300' : 'text-red-400')">
              {{ isSessionEnded ? 'Ended' : (isConnected ? 'Live' : 'Disconnected') }}
            </span>
          </div>
          <!-- Packet Count -->
          <div class="hidden sm:block text-xs sm:text-sm text-gray-500">
            {{ packets.length }} packets
          </div>
          <!-- Viewer Presence -->
          <div 
            v-if="viewerCount > 0"
            class="flex items-center gap-2 px-2 py-1 bg-blue-300/10 border border-blue-300/10 rounded-lg cursor-pointer hover:bg-blue-300/20 transition"
            @click="showViewers = !showViewers"
          >
            <div class="flex -space-x-2">
              <div 
                v-for="(viewer, idx) in viewers.slice(0, 3)" 
                :key="idx"
                class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-300 border-2 border-black flex items-center justify-center text-[10px] sm:text-xs font-bold text-black"
                :title="viewer.name"
              >
                {{ viewer.name.charAt(0).toUpperCase() }}
              </div>
              <div 
                v-if="viewerCount > 3"
                class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-500/50 border-2 border-black flex items-center justify-center text-[10px] sm:text-xs text-gray-400"
              >
                +{{ viewerCount - 3 }}
              </div>
            </div>
            <span class="hidden sm:inline text-xs text-blue-300">
              {{ viewerCount }} {{ viewerCount === 1 ? 'viewer' : 'viewers' }}
            </span>
          </div>
          <!-- Export Button -->
          <div class="relative">
            <button
              @click="showExportMenu = !showExportMenu"
              class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-white"
            >
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span class="hidden sm:inline">Export</span>
            </button>
            <div 
              v-if="showExportMenu"
              class="absolute right-0 mt-2 w-48 bg-black border border-gray-500/20 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <button
                @click="exportSession('json')"
                class="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-500/10 flex items-center gap-2 transition"
              >
                <span class="text-blue-300">{}</span> Export as JSON
              </button>
              <button
                @click="exportSession('markdown')"
                class="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-500/10 flex items-center gap-2 transition"
              >
                <span class="text-purple-300">#</span> Export as Markdown
              </button>
            </div>
          </div>
          <!-- Close Tunnel Button -->
          <button
            v-if="!isSessionEnded && isConnected"
            @click="closeTunnel"
            :disabled="closingTunnel"
            class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 bg-red-400/10 border border-red-400/10 text-red-400 hover:bg-red-400/20 disabled:opacity-50"
          >
            <svg v-if="closingTunnel" class="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="hidden sm:inline">{{ closingTunnel ? 'Closing...' : 'Close' }}</span>
          </button>
          <!-- AI Chat Toggle -->
          <button
            @click="toggleAIChat"
            :disabled="enablingAI"
            class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 sm:gap-2"
            :class="showAIChat ? 'bg-blue-300 text-black' : 'bg-blue-300/10 border border-blue-300/10 text-blue-300 hover:bg-blue-300/20'"
          >
            <svg v-if="enablingAI" class="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
            </svg>
            <span class="hidden sm:inline">{{ enablingAI ? 'Enabling...' : showAIChat ? 'Hide AI' : 'Ask AI' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-32 relative z-10">
      <div class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 rounded-full border-2 border-gray-500/20 border-t-blue-400 animate-spin"></div>
        <span class="text-gray-500 text-sm">Connecting to debug session...</span>
      </div>
    </div>

    <!-- Session Ended State -->
    <div v-else-if="isSessionEnded" class="flex flex-col items-center justify-center py-32 relative z-10">
      <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-8 text-center max-w-md">
        <div class="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto mb-5">
          <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="text-white font-medium text-lg mb-2">Session Ended</div>
        <div class="text-gray-500 text-sm mb-6">
          This debug session has ended. The tunnel may have expired or been closed.
        </div>
        <NuxtLink 
          to="/"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-200 text-black font-medium rounded-lg transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </NuxtLink>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-32 relative z-10">
      <div class="bg-red-400/10 border border-red-400/10 rounded-xl p-8 text-center max-w-xl">
        <div class="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="text-white font-medium mb-2">Failed to connect</div>
        <div class="text-gray-500 text-sm mb-6">{{ error }}</div>
        <button 
          @click="reconnect"
          class="px-5 py-2 bg-white hover:bg-gray-200 text-black font-medium rounded-lg transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <!-- Packet List (2/3 width) -->
        <div class="lg:col-span-2">
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
            <!-- Filter Bar -->
            <div class="border-b border-gray-500/10 p-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <div class="relative">
                <select 
                  v-model="protocolFilter"
                  class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-4 pr-9 py-2 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer"
                >
                  <option value="">All Protocols</option>
                  <option value="http">HTTP</option>
                  <option value="graphql">GraphQL</option>
                  <option value="grpc">gRPC</option>
                  <option value="postgres">PostgreSQL</option>
                  <option value="redis">Redis</option>
                  <option value="mysql">MySQL</option>
                  <option value="unknown">Unknown</option>
                </select>
                <svg class="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div class="relative">
                <select 
                  v-model="directionFilter"
                  class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-4 pr-9 py-2 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer"
                >
                  <option value="">All Directions</option>
                  <option value="inbound">Inbound (← Response)</option>
                  <option value="outbound">Outbound (→ Request)</option>
                </select>
                <svg class="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div class="flex-1"></div>
              <button 
                @click="clearPackets"
                class="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            <!-- Packet List -->
            <div class="divide-y divide-gray-500/10 max-h-[600px] overflow-y-auto">
              <!-- Empty state: Error or session not found -->
              <div v-if="error" class="p-12 text-center">
                <div class="w-16 h-16 rounded-full bg-red-400/5 border border-red-400/10 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="text-white font-medium mb-1">Session Error</div>
                <div class="text-sm text-gray-500 mb-4">{{ error }}</div>
                <NuxtLink 
                  to="/"
                  class="px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors inline-block"
                >
                  Go Home
                </NuxtLink>
              </div>
              <!-- Empty state: Session ended -->
              <div v-else-if="filteredPackets.length === 0 && session?.status === 'ended'" class="p-12 text-center">
                <div class="w-16 h-16 rounded-full bg-red-400/5 border border-red-400/10 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div class="text-white font-medium mb-1">Session Ended</div>
                <div class="text-sm text-gray-500">This debug session has ended. No new packets will be captured.</div>
              </div>
              <!-- Empty state: Disconnected -->
              <div v-else-if="filteredPackets.length === 0 && !isConnected" class="p-12 text-center">
                <div class="w-16 h-16 rounded-full bg-amber-400/5 border border-amber-400/10 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="text-white font-medium mb-1">Connection Lost</div>
                <div class="text-sm text-gray-500 mb-4">The tunnel may have closed or expired.</div>
                <button 
                  @click="reconnect"
                  class="px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  Try Reconnecting
                </button>
              </div>
              <!-- Empty state: Waiting for traffic -->
              <div v-else-if="filteredPackets.length === 0" class="p-12 text-center">
                <div class="w-16 h-16 rounded-full bg-gray-500/5 border border-gray-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="text-white font-medium mb-1">Waiting for traffic...</div>
                <div class="text-sm text-gray-500 mb-4">Packets will appear here as they flow through the tunnel</div>
                <div v-if="sessionStatusMessage" class="text-xs px-3 py-2 rounded-lg inline-block" :class="sessionStatusMessage.includes('expired') || sessionStatusMessage.includes('ended') || sessionStatusMessage.includes('not found') ? 'bg-red-400/10 text-red-400' : 'bg-emerald-300/10 text-emerald-300'">
                  {{ sessionStatusMessage }}
                </div>
                <div v-else class="text-xs text-gray-600">
                  If the tunnel has closed, no new packets will be captured.
                  <button 
                    @click="checkSessionStatus"
                    class="text-blue-300 hover:text-blue-200 hover:underline ml-1"
                  >
                    Check status
                  </button>
                </div>
              </div>
              <div
                v-for="packet in filteredPackets"
                :key="packet.id"
                @click="selectedPacket = packet"
                class="p-3 hover:bg-gray-500/5 cursor-pointer transition-colors"
                :class="{ 'bg-blue-300/10 border-l-2 border-l-blue-300': selectedPacket?.id === packet.id }"
              >
                <div class="flex items-center gap-2 sm:gap-3">
                  <!-- Direction Arrow -->
                  <div 
                    class="w-5 sm:w-6 text-center text-base sm:text-lg font-medium"
                    :class="packet.direction === 'inbound' ? 'text-emerald-300' : 'text-blue-300'"
                  >
                    {{ packet.direction === 'inbound' ? '←' : '→' }}
                  </div>
                  
                  <!-- Protocol Badge -->
                  <span 
                    class="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded border"
                    :class="getProtocolClass(packet.protocol)"
                  >
                    {{ packet.protocol.toUpperCase() }}
                  </span>
                  
                  <!-- Summary -->
                  <div class="flex-1 font-mono text-xs sm:text-sm truncate">
                    <span class="text-white">{{ getPacketSummary(packet) }}</span>
                  </div>
                  
                  <!-- Size -->
                  <span class="hidden sm:inline text-xs text-gray-500">
                    {{ formatBytes(packet.payloadSize) }}
                  </span>
                  
                  <!-- Time -->
                  <span class="text-[10px] sm:text-xs text-gray-500 w-16 sm:w-20 text-right">
                    {{ formatTime(packet.capturedAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Load More -->
            <div v-if="packets.length >= 50" class="border-t border-gray-500/10 p-3 text-center">
              <button 
                @click="loadMore"
                class="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                :disabled="loadingMore"
              >
                {{ loadingMore ? 'Loading...' : 'Load older packets' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Detail Panel (1/3 width) -->
        <div class="lg:col-span-1">
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl sticky top-20 overflow-hidden">
            <div v-if="!selectedPacket" class="p-8 text-center">
              <div class="w-12 h-12 rounded-full bg-gray-500/5 border border-gray-500/10 flex items-center justify-center mx-auto mb-3">
                <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div class="text-white font-medium mb-1">No packet selected</div>
              <div class="text-sm text-gray-500">Click a packet to view details</div>
            </div>
            <div v-else>
              <!-- Packet Header -->
              <div class="border-b border-gray-500/10 p-4">
                <div class="flex items-center justify-between mb-2">
                  <span 
                    class="px-2 py-0.5 text-xs font-mono rounded border"
                    :class="getProtocolClass(selectedPacket.protocol)"
                  >
                    {{ selectedPacket.protocol.toUpperCase() }}
                  </span>
                  <span class="text-xs text-gray-500 font-mono">
                    #{{ selectedPacket.sequence }}
                  </span>
                </div>
                <div class="text-sm text-gray-400">
                  <span :class="selectedPacket.direction === 'inbound' ? 'text-emerald-300' : 'text-blue-300'">
                    {{ selectedPacket.direction === 'inbound' ? '← Response' : '→ Request' }}
                  </span>
                  <span class="mx-1.5 text-gray-600">•</span>
                  {{ formatBytes(selectedPacket.payloadSize) }}
                  <span class="mx-1.5 text-gray-600">•</span>
                  {{ new Date(selectedPacket.capturedAt).toLocaleTimeString() }}
                </div>
              </div>

              <!-- Parsed Content -->
              <div v-if="parsedData" class="border-b border-gray-500/10 p-4">
                <div class="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">
                  Parsed {{ selectedPacket.protocol.toUpperCase() }}
                </div>
                
                <!-- HTTP Request -->
                <div v-if="selectedPacket.protocol === 'http' && parsedData.method" class="mb-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-1 text-xs font-bold rounded bg-blue-300/10 text-blue-300 border border-blue-300/20">
                      {{ parsedData.method }}
                    </span>
                    <span class="font-mono text-sm text-white break-all">{{ parsedData.path }}</span>
                    <span v-if="parsedData.version" class="text-xs text-gray-500">{{ parsedData.version }}</span>
                  </div>
                </div>
                
                <!-- HTTP Response -->
                <div v-else-if="selectedPacket.protocol === 'http' && parsedData.status" class="mb-3">
                  <div class="flex items-center gap-2">
                    <span 
                      class="px-2 py-1 text-xs font-bold rounded border"
                      :class="getStatusClass(parsedData.status)"
                    >
                      {{ parsedData.status }}
                    </span>
                    <span class="text-sm text-gray-400">{{ parsedData.statusText }}</span>
                    <span v-if="parsedData.version" class="text-xs text-gray-500">{{ parsedData.version }}</span>
                  </div>
                </div>

                <!-- Headers table -->
                <div v-if="parsedData.headers && Object.keys(parsedData.headers).length > 0" class="mb-3">
                  <div class="text-xs text-gray-500 mb-2 font-medium">Headers</div>
                  <div class="bg-black/40 rounded-lg border border-gray-500/10 overflow-hidden max-h-48 overflow-y-auto">
                    <div 
                      v-for="(value, key) in parsedData.headers" 
                      :key="key"
                      class="flex border-b border-gray-500/5 last:border-0"
                    >
                      <div class="px-3 py-1.5 text-xs font-mono text-emerald-300/80 bg-gray-500/5 w-44 shrink-0 truncate">
                        {{ key }}
                      </div>
                      <div class="px-3 py-1.5 text-xs font-mono text-gray-300 break-all flex-1">
                        {{ value }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Body Preview -->
                <div v-if="parsedData.bodyPreview" class="mb-3">
                  <div class="text-xs text-gray-500 mb-2 font-medium">Body</div>
                  <pre class="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-black/40 rounded-lg p-3 max-h-40 overflow-auto border border-gray-500/10">{{ formatBodyPreview(parsedData.bodyPreview) }}</pre>
                </div>

                <!-- Fallback: Show all parsed fields as table for non-HTTP or missing structure -->
                <div v-if="selectedPacket.protocol !== 'http' || (!parsedData.method && !parsedData.status && !parsedData.headers)">
                  <div class="bg-black/40 rounded-lg border border-gray-500/10 overflow-hidden">
                    <div 
                      v-for="(value, key) in parsedData" 
                      :key="key"
                      class="flex border-b border-gray-500/5 last:border-0"
                    >
                      <div class="px-3 py-1.5 text-xs font-mono text-gray-500 bg-gray-500/5 w-32 shrink-0">
                        {{ key }}
                      </div>
                      <div class="px-3 py-1.5 text-xs font-mono text-gray-300 break-all flex-1">
                        {{ typeof value === 'object' ? JSON.stringify(value) : value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Raw Payload Preview -->
              <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs text-gray-500 uppercase tracking-wider font-medium">
                    Raw Payload
                    <span class="text-gray-600 normal-case ml-1">({{ formatBytes(selectedPacket.payloadSize) }})</span>
                  </div>
                  <button 
                    v-if="selectedPacket.payload"
                    @click="copyPayload"
                    class="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                </div>
                <div v-if="selectedPacket.payload" class="relative">
                  <pre class="font-mono text-xs text-gray-300 bg-black/40 rounded-lg border border-gray-500/10 p-3 max-h-40 overflow-auto whitespace-pre-wrap break-all">{{ truncatePayload(selectedPacket.payload) }}</pre>
                  <div v-if="isPayloadTruncated(selectedPacket.payload)" class="mt-2 text-xs text-gray-500">
                    Showing first 2KB of {{ formatBytes(selectedPacket.payloadSize) }}
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500">
                  Payload too large to display inline.
                  <button 
                    @click="loadFullPacket"
                    class="text-blue-300 hover:text-blue-200 hover:underline ml-1 transition-colors"
                  >
                    Load full payload
                  </button>
                </div>
              </div>

              <!-- Replay Button -->
              <div class="border-t border-gray-500/10 p-4">
                <button 
                  @click="replayRequest"
                  :disabled="selectedPacket.direction !== 'outbound' || selectedPacket.protocol !== 'http' || replaying"
                  class="w-full py-2.5 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
                  :class="selectedPacket.direction === 'outbound' && selectedPacket.protocol === 'http' 
                    ? 'bg-white hover:bg-gray-200 text-black' 
                    : 'bg-gray-500/10 text-gray-500 cursor-not-allowed'"
                >
                  <svg v-if="replaying" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ replaying ? 'Replaying...' : (selectedPacket.direction === 'outbound' && selectedPacket.protocol === 'http' ? 'Replay Request' : 'Replay not available') }}
                </button>
                
                <!-- Replay Result -->
                <div v-if="replayResult" class="mt-3 p-3 rounded-lg text-sm" :class="replayResult.success ? 'bg-emerald-300/10 border border-emerald-300/10' : 'bg-red-400/10 border border-red-400/10'">
                  <div v-if="replayResult.success" class="space-y-2">
                    <div class="flex justify-between">
                      <span class="text-gray-400">Status</span>
                      <span :class="replayResult.status >= 400 ? 'text-red-400' : 'text-emerald-300'" class="font-mono">
                        {{ replayResult.status }} {{ replayResult.statusText }}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-400">Latency</span>
                      <span class="text-white font-mono">{{ replayResult.latencyMs }}ms</span>
                    </div>
                    <div v-if="replayResult.body" class="mt-2">
                      <div class="text-gray-500 text-xs mb-1 font-medium">Response Body</div>
                      <pre class="text-xs text-gray-300 bg-black/40 rounded-lg p-2 max-h-32 overflow-auto border border-gray-500/10">{{ replayResult.body.substring(0, 500) }}</pre>
                    </div>
                  </div>
                  <div v-else class="text-red-400">
                    Error: {{ replayResult.error }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Chat Panel -->
      <div v-if="aiEnabled && showAIChat" class="mt-6">
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
          <!-- Chat Header -->
          <div class="border-b border-gray-500/10 p-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
                </svg>
              </div>
              <span class="font-medium text-white text-sm">AI Debug Copilot</span>
            </div>
            <div class="text-xs text-gray-500">
              Analyzing {{ packets.length }} packets
            </div>
          </div>

          <!-- Chat Messages -->
          <div class="max-h-80 overflow-y-auto p-4 space-y-4">
            <div v-if="aiMessages.length === 0" class="text-center py-8">
              <div class="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
                </svg>
              </div>
              <p class="text-white font-medium mb-1">Ask me anything about this traffic!</p>
              <p class="text-sm text-gray-500 mb-4">I can help analyze patterns, find errors, and more</p>
              <div class="flex flex-wrap gap-2 justify-center">
                <button 
                  @click="askAI('Why am I seeing errors?')"
                  class="text-xs bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 hover:border-gray-500/20 text-gray-400 px-3 py-1.5 rounded-full transition"
                >
                  Why am I seeing errors?
                </button>
                <button 
                  @click="askAI('What queries are slow?')"
                  class="text-xs bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 hover:border-gray-500/20 text-gray-400 px-3 py-1.5 rounded-full transition"
                >
                  What queries are slow?
                </button>
                <button 
                  @click="askAI('Summarize this traffic')"
                  class="text-xs bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 hover:border-gray-500/20 text-gray-400 px-3 py-1.5 rounded-full transition"
                >
                  Summarize this traffic
                </button>
              </div>
            </div>

            <div v-for="(msg, idx) in aiMessages" :key="idx" class="flex gap-3">
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                :class="msg.role === 'user' ? 'bg-blue-300/10' : 'bg-purple-300/10'"
              >
                <span v-if="msg.role === 'user'" class="text-xs font-bold text-blue-300">You</span>
                <svg v-else class="w-4 h-4 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
                </svg>
              </div>
              <div class="flex-1 pt-1">
                <div 
                  class="text-sm"
                  :class="msg.role === 'user' ? 'text-gray-300' : 'text-white'"
                >
                  <pre v-if="msg.role === 'assistant'" class="whitespace-pre-wrap font-sans">{{ msg.content }}</pre>
                  <p v-else>{{ msg.content }}</p>
                </div>
              </div>
            </div>

            <!-- Typing indicator -->
            <div v-if="aiThinking" class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-300/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
                </svg>
              </div>
              <div class="flex items-center gap-1 pt-2">
                <span class="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                <span class="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
              </div>
            </div>
          </div>

          <!-- Chat Input -->
          <div class="border-t border-purple-300/10 p-4">
            <form @submit.prevent="sendMessage" class="flex gap-2">
              <input
                v-model="aiInput"
                type="text"
                placeholder="Ask about the traffic..."
                class="flex-1 bg-black border border-gray-500/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-300/50 focus:border-transparent outline-none transition"
                :disabled="aiThinking"
              />
              <button
                type="submit"
                :disabled="!aiInput.trim() || aiThinking"
                class="px-4 py-2.5 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-colors flex items-center justify-center"
              >
                <svg v-if="aiThinking" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Close Tunnel Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCloseModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showCloseModal = false"></div>
          
          <!-- Modal -->
          <div class="relative bg-black border border-gray-500/20 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <!-- Icon -->
            <div class="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-5">
              <svg class="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <!-- Content -->
            <div class="text-center mb-6">
              <h3 class="text-xl font-semibold text-white mb-2">Close Tunnel?</h3>
              <p class="text-gray-400 text-sm">
                This will end the debug session and close the tunnel. Any traffic currently being inspected will stop.
              </p>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-3">
              <button
                @click="showCloseModal = false"
                class="flex-1 px-4 py-2.5 bg-gray-500/10 hover:bg-gray-500/20 text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="confirmCloseTunnel"
                :disabled="closingTunnel"
                class="flex-1 px-4 py-2.5 bg-red-400 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg v-if="closingTunnel" class="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ closingTunnel ? 'Closing...' : 'Close Tunnel' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { DebugPacket } from '~/composables/useDebugSocket';

// No layout for this public page
definePageMeta({
  layout: false,
});

const route = useRoute();
const config = useRuntimeConfig();
const { 
  connect, 
  disconnect, 
  requestHistory, 
  requestPacketDetails,
  clearPackets: clearPacketsFromSocket,
  isConnected, 
  session, 
  packets, 
  error,
  viewers,
  viewerCount,
} = useDebugSocket();

const loading = ref(true);
const loadingMore = ref(false);
const selectedPacket = ref<DebugPacket | null>(null);
const protocolFilter = ref('');
const directionFilter = ref('');
const showViewers = ref(false);
const showExportMenu = ref(false);

// AI Chat state
const showAIChat = ref(false);
const aiInput = ref('');
const aiMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
const aiThinking = ref(false);
const enablingAI = ref(false);
const aiEnabled = ref(false);

watch(() => session.value?.aiEnabled, (val) => {
  if (val !== undefined) aiEnabled.value = val;
}, { immediate: true });

const toggleAIChat = async () => {
  if (!aiEnabled.value) {
    enablingAI.value = true;
    try {
      const token = route.params.token as string;
      const res = await fetch(`${config.public.apiUrl}/v1/debug/public/${token}/ai/enable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      if (res.ok) {
        aiEnabled.value = true;
        showAIChat.value = true;
      }
    } finally {
      enablingAI.value = false;
    }
  } else {
    showAIChat.value = !showAIChat.value;
  }
};

// Close tunnel state
const showCloseModal = ref(false);
const closingTunnel = ref(false);
const tunnelClosed = ref(false);

// Detect if session has ended based on error message or manual close
const isSessionEnded = computed(() => {
  if (tunnelClosed.value) return true;
  if (session.value?.status === 'ended') return true;
  if (!error.value) return false;
  const msg = error.value.toLowerCase();
  return msg.includes('not active') || msg.includes('ended') || msg.includes('expired');
});

// Page title
useHead({
  title: `Debug Session - Private Connect`,
});

// Clear loading and fetch history once session data arrives
watch(session, (val) => {
  if (val && loading.value) {
    loading.value = false;
    requestHistory(50);
  }
});

watch(error, (val) => {
  if (val) {
    loading.value = false;
  }
});

// Connect on mount
onMounted(() => {
  const token = route.params.token as string;
  connect(token);
});

// Cleanup on unmount
onUnmounted(() => {
  disconnect();
});

// Filtered packets
const filteredPackets = computed(() => {
  return packets.value.filter(p => {
    if (protocolFilter.value && p.protocol !== protocolFilter.value) return false;
    if (directionFilter.value && p.direction !== directionFilter.value) return false;
    return true;
  });
});

// Load more packets
const loadMore = async () => {
  if (loadingMore.value) return;
  loadingMore.value = true;
  
  const lastPacket = packets.value[packets.value.length - 1];
  await requestHistory(50, lastPacket?.id);
  
  loadingMore.value = false;
};

// Clear packets from view
const clearPackets = () => {
  clearPacketsFromSocket();
  selectedPacket.value = null;
};

// Reconnect
const reconnect = () => {
  loading.value = true;
  const token = route.params.token as string;
  connect(token);
};

// Show close tunnel modal
const closeTunnel = () => {
  if (!session.value) return;
  showCloseModal.value = true;
};

// Confirm and close tunnel
const confirmCloseTunnel = async () => {
  if (closingTunnel.value || !session.value) return;
  const token = route.params.token as string;

  closingTunnel.value = true;

  try {
    // End the debug session (which will also close the linked tunnel)
    const response = await fetch(`${config.public.apiUrl}/v1/debug/public/${token}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      // Disconnect and show ended state
      disconnect();
      tunnelClosed.value = true;
      showCloseModal.value = false;
    } else {
      const data = await response.json();
      console.error('Failed to close session:', data.message);
    }
  } catch (err: any) {
    console.error('Failed to close session:', err.message);
  } finally {
    closingTunnel.value = false;
  }
};

// Check session status from API
const sessionStatusMessage = ref<string | null>(null);
const checkSessionStatus = async () => {
  const token = route.params.token as string;
  try {
    const response = await fetch(`${config.public.apiUrl}/v1/debug/public/${token}`);
    const data = await response.json();
    
    if (!response.ok) {
      sessionStatusMessage.value = data.message || 'Session not found or expired';
    } else if (data.status === 'ended') {
      sessionStatusMessage.value = 'This session has ended';
    } else if (data.status === 'paused') {
      sessionStatusMessage.value = 'This session is paused';
    } else if (data.status === 'active') {
      // Only show "active" if status is explicitly "active"
      if (data.expiresAt) {
        const expiresAt = new Date(data.expiresAt);
        if (expiresAt < new Date()) {
          sessionStatusMessage.value = 'This session has expired';
        } else {
          const minutesLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);
          sessionStatusMessage.value = `Session active. Expires in ${minutesLeft} minutes.`;
        }
      } else {
        sessionStatusMessage.value = 'Session is active. Make requests to see traffic.';
      }
    } else {
      // Unknown status - be conservative
      sessionStatusMessage.value = `Session status: ${data.status || 'unknown'}`;
    }
  } catch (err) {
    sessionStatusMessage.value = 'Could not check session status';
  }
};

// Load full packet details
const loadFullPacket = async () => {
  if (!selectedPacket.value) return;
  const full = await requestPacketDetails(selectedPacket.value.id);
  if (full) {
    selectedPacket.value = { ...selectedPacket.value, payload: full.payload };
  }
};

// Replay state
const replaying = ref(false);
const replayResult = ref<any>(null);

// Replay request
const replayRequest = async () => {
  if (!selectedPacket.value || selectedPacket.value.direction !== 'outbound') return;
  if (selectedPacket.value.protocol !== 'http') {
    alert('Replay only supported for HTTP requests');
    return;
  }
  
  replaying.value = true;
  replayResult.value = null;
  
  try {
    const token = route.params.token as string;
    const response = await fetch(
      `${config.public.apiUrl}/v1/debug/public/${token}/packets/${selectedPacket.value.id}/replay`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    
    replayResult.value = await response.json();
  } catch (error: unknown) {
    const err = error as Error;
    replayResult.value = { success: false, error: err.message };
  } finally {
    replaying.value = false;
  }
};

// Helper functions
const getProtocolClass = (protocol: string) => {
  switch (protocol) {
    case 'http': return 'bg-blue-300/10 border-blue-300/20 text-blue-300';
    case 'postgres': return 'bg-emerald-300/10 border-emerald-300/20 text-emerald-300';
    case 'redis': return 'bg-red-300/10 border-red-300/20 text-red-300';
    case 'mysql': return 'bg-amber-300/10 border-amber-300/20 text-amber-300';
    case 'graphql': return 'bg-pink-300/10 border-pink-300/20 text-pink-300';
    case 'grpc': return 'bg-cyan-300/10 border-cyan-300/20 text-cyan-300';
    default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
  }
};

const getPacketSummary = (packet: DebugPacket) => {
  if (!packet.parsed) return `${packet.payloadSize} bytes`;
  
  const p = packet.parsed;
  switch (packet.protocol) {
    case 'http':
      if (p.type === 'request') return `${p.method} ${p.path}`;
      if (p.type === 'response') return `${p.status} ${p.statusText}`;
      break;
    case 'postgres':
      if (p.type === 'query') return p.query?.substring(0, 50) + (p.query?.length > 50 ? '...' : '');
      if (p.type === 'command_complete') return p.tag;
      if (p.type === 'error') return 'ERROR';
      return p.type;
    case 'redis':
      if (p.type === 'command') return `${p.command} ${(p.args || []).join(' ')}`;
      if (p.type === 'error') return p.message;
      return p.type;
    case 'graphql':
      if (p.type === 'request') {
        const opName = p.operationName || p.operationType;
        return `${p.operationType?.toUpperCase()} ${opName}`;
      }
      if (p.type === 'response') {
        if (p.hasErrors) return `ERROR: ${p.errors?.[0] || 'Unknown'}`;
        return `DATA: ${(p.dataFields || []).join(', ')}`;
      }
      return p.type;
    case 'grpc':
      if (p.service && p.method) {
        const statusStr = p.status !== undefined ? ` [${p.status}]` : '';
        return `${p.service}/${p.method}${statusStr}`;
      }
      if (p.frameType) return `${p.frameType} frame`;
      return p.type;
  }
  
  return `${packet.payloadSize} bytes`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const formatTime = (date: string) => {
  const d = new Date(date);
  return d.toLocaleTimeString();
};

const decodePayload = (base64: string) => {
  try {
    const decoded = atob(base64);
    // Try to pretty-print if it looks like JSON
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(decoded), null, 2);
      } catch {
        return decoded;
      }
    }
    // Check if it's printable text
    if (/^[\x20-\x7E\s]*$/.test(decoded.substring(0, 100))) {
      return decoded;
    }
    // Show as hex for binary data
    return base64.substring(0, 200) + (base64.length > 200 ? '...' : '');
  } catch {
    return base64;
  }
};

// Parse the parsed field (it may come as a JSON string)
const getParsedData = (packet: DebugPacket | null) => {
  if (!packet?.parsed) return null;
  if (typeof packet.parsed === 'string') {
    try {
      return JSON.parse(packet.parsed);
    } catch {
      return null;
    }
  }
  return packet.parsed;
};

// Computed parsed data for selected packet
const parsedData = computed(() => getParsedData(selectedPacket.value));

// HTTP status styling
const getStatusClass = (status: number) => {
  if (status >= 500) return 'bg-red-400/10 text-red-400 border-red-400/20';
  if (status >= 400) return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
  if (status >= 300) return 'bg-blue-300/10 text-blue-300 border-blue-300/20';
  if (status >= 200) return 'bg-emerald-300/10 text-emerald-300 border-emerald-300/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

// Format body preview (try to pretty-print JSON)
const formatBodyPreview = (body: string) => {
  if (!body) return '';
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return body;
    }
  }
  return body;
};

// Format payload for display with line breaks
const formatPayload = (base64: string) => {
  try {
    const decoded = atob(base64);
    // Try to pretty-print if it looks like JSON
    if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(decoded), null, 2);
      } catch {
        return decoded;
      }
    }
    return decoded;
  } catch {
    return base64;
  }
};

// Truncate payload for display (limit to 2KB)
const MAX_PAYLOAD_DISPLAY = 2048;

const truncatePayload = (base64: string) => {
  try {
    const decoded = atob(base64);
    if (decoded.length <= MAX_PAYLOAD_DISPLAY) {
      return decoded;
    }
    return decoded.substring(0, MAX_PAYLOAD_DISPLAY);
  } catch {
    return base64.substring(0, MAX_PAYLOAD_DISPLAY);
  }
};

const isPayloadTruncated = (base64: string) => {
  try {
    const decoded = atob(base64);
    return decoded.length > MAX_PAYLOAD_DISPLAY;
  } catch {
    return base64.length > MAX_PAYLOAD_DISPLAY;
  }
};

// Copy payload to clipboard
const copyPayload = async () => {
  if (!selectedPacket.value?.payload) return;
  try {
    const decoded = atob(selectedPacket.value.payload);
    await navigator.clipboard.writeText(decoded);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

// AI Chat functions
const askAI = (question: string) => {
  aiInput.value = question;
  sendMessage();
};

const sendMessage = async () => {
  const question = aiInput.value.trim();
  if (!question || aiThinking.value) return;

  // Add user message
  aiMessages.value.push({ role: 'user', content: question });
  aiInput.value = '';
  aiThinking.value = true;

  try {
    // Build packet context for the AI
    const packetContext = packets.value.slice(0, 20).map(p => ({
      direction: p.direction,
      protocol: p.protocol,
      parsed: p.parsed,
      payloadSize: p.payloadSize,
    }));

    // Call AI analyze endpoint (this is a simplified version - would need session ID for full implementation)
    // For now, we'll use a simple prompt-based approach
    const token = route.params.token as string;
    
    // Since this is a public page, we'll use a simplified chat that doesn't require auth
    // In production, this would call /v1/ai/chat with proper session context
    const response = await fetch(`${config.public.apiUrl}/v1/debug/public/${token}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        packetContext,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      aiMessages.value.push({ 
        role: 'assistant', 
        content: data.response || data.analysis || 'I analyzed the traffic but could not generate a response.',
      });
    } else {
      aiMessages.value.push({ 
        role: 'assistant', 
        content: `AI analysis is not available. Please configure AI settings in your workspace to enable this feature.`,
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    aiMessages.value.push({ 
      role: 'assistant', 
      content: `Sorry, I encountered an error: ${err.message}. Please check your AI configuration in workspace settings.`,
    });
  } finally {
    aiThinking.value = false;
  }
};

const getProtocolSummary = () => {
  const protocols: Record<string, number> = {};
  for (const p of packets.value) {
    protocols[p.protocol] = (protocols[p.protocol] || 0) + 1;
  }
  return Object.entries(protocols)
    .map(([proto, count]) => `${count} ${proto.toUpperCase()} packets`)
    .join(', ');
};

// Export session
const exportSession = async (format: 'json' | 'markdown') => {
  showExportMenu.value = false;
  
  try {
    const token = route.params.token as string;
    const response = await fetch(
      `${config.public.apiUrl}/v1/debug/public/${token}/export?format=${format}`
    );
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const data = await response.json();
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (format === 'markdown') {
      content = data.content;
      filename = `debug-session-${token}.md`;
      mimeType = 'text/markdown';
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `debug-session-${token}.json`;
      mimeType = 'application/json';
    }
    
    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    const err = error as Error;
    alert(`Export failed: ${err.message}`);
  }
};
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
</style>
