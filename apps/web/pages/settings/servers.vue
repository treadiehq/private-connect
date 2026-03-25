<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Server</h1>
        <p class="text-sm text-gray-400 mt-1">Manage local servers, and AI assistant MCP connections.</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Discover Button -->
        <button
          @click="startDiscovery"
          :disabled="discovering"
          class="px-4 py-2 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg v-if="discovering" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {{ discovering ? 'Scanning...' : 'Discover Servers' }}
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="mb-6 border-b border-gray-500/20">
      <div class="flex gap-1" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`panel-${tab.id}`"
          @click="activeTab = tab.id"
          :class="[
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === tab.id
              ? 'text-white border-b-2 border-blue-300'
              : 'text-gray-400 hover:text-gray-300'
          ]"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="ml-2 text-xs text-gray-500">
            ({{ tab.count }})
          </span>
        </button>
      </div>
    </div>

    <!-- Servers Tab -->
    <div v-if="activeTab === 'servers'" class="space-y-6">
      <!-- Bulk Actions Bar -->
      <div v-if="selectedServers.length > 0" class="bg-blue-300/10 border border-blue-300/20 rounded-lg px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-sm text-white font-medium">{{ selectedServers.length }} server{{ selectedServers.length > 1 ? 's' : '' }} selected</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="bulkAddSelected"
            class="px-3 py-1.5 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-colors"
          >
            Add Selected
          </button>
          <button
            @click="bulkDelete"
            class="px-3 py-1.5 bg-red-400 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Delete Selected
          </button>
          <button
            @click="clearSelection"
            class="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Discovery Results -->
      <div v-if="discoveredServers.length > 0" class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-500/10 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-white">Discovered Servers</h3>
            <p class="text-xs text-gray-400 mt-1">Found {{ discoveredServers.length }} server{{ discoveredServers.length > 1 ? 's' : '' }} on localhost</p>
          </div>
          <button
            @click="discoveredServers = []"
            class="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
        <div class="divide-y divide-purple-300/10">
          <div
            v-for="server in discoveredServers"
            :key="`discovered-${server.host}-${server.port}`"
            class="px-5 py-3 flex items-center justify-between hover:bg-gray-500/5 transition-colors"
          >
            <div class="flex items-center gap-3 flex-1">
              <input
                type="checkbox"
                :value="`${server.host}:${server.port}`"
                v-model="selectedDiscoveredServers"
                class="w-4 h-4 rounded border-gray-500/20 bg-gray-500/10 text-blue-300 focus:ring-blue-300"
              />
              <div class="w-2 h-2 rounded-full bg-emerald-300"></div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm text-white">{{ server.host }}:{{ server.port }}</span>
                  <span v-if="server.type" class="px-2 py-0.5 text-xs bg-blue-300/10 text-blue-300 rounded">{{ server.type }}</span>
                </div>
                <div v-if="server.name" class="text-xs text-gray-500 mt-0.5">{{ server.name }}</div>
              </div>
            </div>
            <button
              @click="addDiscoveredServer(server)"
              class="px-3 py-1.5 bg-blue-300 hover:bg-blue-400 text-black text-xs font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
        <div v-if="selectedDiscoveredServers.length > 0" class="px-5 py-3 border-t border-gray-500/10 bg-gray-500/5">
          <button
            @click="bulkAddDiscovered"
            class="w-full px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-colors"
          >
            Add {{ selectedDiscoveredServers.length }} Selected Server{{ selectedDiscoveredServers.length > 1 ? 's' : '' }}
          </button>
        </div>
      </div>

      <!-- Server List -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-500/10 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-white">Local Servers</h2>
            <p class="text-xs text-gray-500 mt-1">Manage servers running on localhost</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
              <input
                v-model="healthMonitoringEnabled"
                type="checkbox"
                class="w-3.5 h-3.5 rounded border-gray-500/20 bg-gray-500/10 text-blue-300 focus:ring-blue-300 focus:ring-offset-0"
              />
              Auto health-check
            </label>
            <span class="text-gray-600">|</span>
            <button
              @click="selectAll"
              class="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Select All
            </button>
            <span class="text-gray-600">|</span>
            <button
              @click="refreshHealth"
              :disabled="refreshingHealth"
              class="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <svg v-if="refreshingHealth" class="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refresh Health
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loadingServers" class="p-8 text-center">
          <svg class="animate-spin h-6 w-6 text-blue-300 mx-auto" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <!-- Empty State -->
        <div v-else-if="localServers.length === 0" class="p-8 text-center">
          <svg class="w-12 h-12 text-gray-500/50 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p class="text-gray-400 mb-4">No local servers configured</p>
          <button
            @click="startDiscovery"
            class="px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-colors"
          >
            Discover Servers
          </button>
        </div>

        <!-- Server List -->
        <div v-else class="divide-y divide-gray-500/10">
          <div
            v-for="server in localServers"
            :key="server.id"
            class="px-5 py-4 hover:bg-gray-500/5 transition-colors flex items-center justify-between group"
            :class="{ 'bg-blue-300/5': selectedServers.includes(server.id) }"
          >
            <div class="flex items-center gap-4 flex-1">
              <!-- Checkbox for bulk selection -->
              <input
                type="checkbox"
                :checked="selectedServers.includes(server.id)"
                @change="toggleServerSelection(server.id)"
                class="w-4 h-4 rounded border-gray-500/10 bg-gray-500/10 text-blue-300 focus:ring-blue-300"
              />

              <!-- Status Indicator -->
              <div class="relative">
                <span
                  :class="[
                    'w-3 h-3 rounded-full transition-all',
                    server.status === 'online' ? 'bg-emerald-300' : 'bg-red-400',
                    server.healthCheckInProgress ? 'animate-pulse' : ''
                  ]"
                ></span>
                <span
                  v-if="server.status === 'online' && !server.healthCheckInProgress"
                  class="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-75"
                ></span>
              </div>

              <!-- Server Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3">
                  <span class="font-mono text-sm text-white">{{ server.host }}:{{ server.port }}</span>
                  <span v-if="server.version" class="text-xs text-gray-500">v{{ server.version }}</span>
                  <span v-if="server.lastHealthCheck" class="text-xs text-gray-600">
                    ({{ formatHealthTime(server.lastHealthCheck) }})
                  </span>
                </div>
                <div v-if="server.name" class="text-xs text-gray-500 mt-0.5">{{ server.name }}</div>
                <div v-if="server.latency !== undefined" class="text-xs text-gray-500 mt-0.5">
                  Latency: <span :class="server.latency < 50 ? 'text-emerald-300' : server.latency < 100 ? 'text-amber-300' : 'text-red-400'">
                    {{ server.latency }}ms
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  @click="checkServerHealth(server)"
                  :disabled="server.healthCheckInProgress"
                  class="p-1.5 text-gray-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  title="Check health"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  v-if="server.isDefault"
                  class="px-2 py-1 text-xs bg-blue-300/10 text-blue-300 rounded border border-blue-300/10"
                  disabled
                >
                  Default
                </button>
                <button
                  @click="editServer(server)"
                  class="p-1.5 text-gray-400 hover:text-blue-300 transition-colors"
                  title="Edit server"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  @click="removeServer(server.id)"
                  class="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                  title="Remove server"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Server Input -->
        <div class="px-5 py-4 border-t border-gray-500/10 bg-gray-500/5">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-gray-500"></div>
            <input
              v-model="newServerUrl"
              type="text"
              placeholder="http://localhost:4096"
              class="flex-1 px-4 py-2.5 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-all placeholder:text-gray-600 text-sm"
              @keyup.enter="addServer"
            />
            <button
              @click="addServer"
              :disabled="!newServerUrl.trim() || addingServer"
              class="px-4 py-2.5 bg-gray-500/20 hover:bg-gray-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {{ addingServer ? 'Adding...' : 'Save' }}
            </button>
            <button
              @click="newServerUrl = ''"
              class="px-4 py-2.5 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MCP Tab -->
    <div v-if="activeTab === 'mcp'" class="space-y-6">
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">MCP Integration</h2>
            <p class="text-xs text-gray-500 mt-1">Model Context Protocol for AI assistants</p>
          </div>
          <div class="flex items-center gap-2">
            <div
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2',
                mcpStatus === 'connected' ? 'bg-emerald-300/10 text-emerald-300' : 'bg-gray-500/10 text-gray-400'
              ]"
            >
              <svg
                v-if="checkingMcpStatus"
                class="animate-spin h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ mcpStatus === 'connected' ? 'Connected' : 'Not Connected' }}
            </div>
            <button
              @click="checkMcp"
              :disabled="checkingMcpStatus"
              class="p-1.5 text-gray-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              title="Refresh MCP status"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="mcpStatus === 'connected'" class="space-y-3">
          <div class="p-4 bg-emerald-300/10 border border-emerald-300/10 rounded-lg">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-emerald-300 mb-1">MCP Server is running</p>
                <p class="text-xs text-gray-400 mb-3">Your AI assistant can now access Private Connect services.</p>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <code class="text-xs text-blue-300 font-mono bg-gray-900/50 px-2 py-1 rounded">connect mcp serve</code>
                  </div>
                  <p class="text-xs text-gray-500">Status updates automatically every 10 seconds.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else>
          <p class="text-sm text-gray-400 mb-4">Start the MCP server to enable AI assistant integration with Private Connect.</p>
          <div class="space-y-3">
            <div class="p-4 bg-gray-500/10 rounded-lg border border-gray-500/10">
              <p class="text-xs text-gray-400 mb-3">Run this command in your terminal:</p>
              <div class="flex items-center gap-2 mb-3">
                <code class="text-xs text-blue-300 font-mono bg-[#09090b]/50 px-3 py-2 rounded flex-1">connect mcp serve</code>
                <button
                  @click="copyCommand('connect mcp serve')"
                  class="px-3 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
                  title="Copy command"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>
              <div class="space-y-2 text-xs text-gray-500">
                <p><strong>Prerequisites and tip:</strong></p>
                <ul class="list-disc list-inside ml-2 space-y-1">
                  <li>Make sure you've run <code class="text-gray-300">connect up</code> first to authenticate</li>
                  <li>The <code class="text-gray-300">connect</code> CLI must be installed and in your PATH</li>
                  <li>Once running, the status will update automatically</li>
                  <li>After starting the MCP server, configure it in your AI tool (Cursor, Claude Desktop, etc.) using the setup command: <code class="text-xs text-blue-300 font-mono block mt-2 bg-[#09090b]/50 px-2 py-1 rounded">connect mcp setup</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LSP Tab (Future) - Commented out -->
    <!--
    <div v-if="activeTab === 'lsp'" class="space-y-6">
      <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
        <svg class="w-12 h-12 text-gray-500/50 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <h3 class="text-base font-medium text-white mb-2">Language Server Protocol</h3>
        <p class="text-sm text-gray-400">LSP integration coming soon</p>
      </div>
    </div>
    -->

    <!-- Plugins Tab (Future) - Commented out -->
    <!--
    <div v-if="activeTab === 'plugins'" class="space-y-6">
      <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
        <svg class="w-12 h-12 text-gray-500/50 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 class="text-base font-medium text-white mb-2">Plugins & Extensions</h3>
        <p class="text-sm text-gray-400">Plugin system coming soon</p>
      </div>
    </div>
    -->

    <!-- Confirm Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="confirmModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          @click.self="confirmModal = null"
        >
          <div class="absolute inset-0 bg-[#09090b]/70 backdrop-blur-sm"></div>
          <div class="relative bg-black-main border border-gray-500/20 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 id="confirm-modal-title" class="text-lg font-semibold text-white mb-2">Confirm</h3>
            <p class="text-sm text-gray-400 mb-6">{{ confirmModal.message }}</p>
            <div class="flex gap-3">
              <button
                @click="confirmModal = null"
                class="flex-1 py-2 bg-gray-500/10 hover:bg-gray-500/15 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                @click="runConfirmAction"
                :disabled="confirmRunning"
                class="flex-1 py-2 bg-red-400 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {{ confirmRunning ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Service } from '~/types';

useHead({ title: 'Server Management - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

interface LocalServer {
  id: string;
  host: string;
  port: number;
  name?: string;
  version?: string;
  status: 'online' | 'offline';
  isDefault?: boolean;
  lastHealthCheck?: Date;
  latency?: number;
  healthCheckInProgress?: boolean;
}

interface DiscoveredServer {
  host: string;
  port: number;
  type?: string;
  name?: string;
}

const { fetchServices, createExternalService, runCheck, deleteService, checkMcpStatus } = useApi();
const { connect } = useSocket();
const { success, error: showError } = useToast();

const activeTab = ref<'servers' | 'mcp'>('servers');
const loadingServers = ref(false);
const localServers = ref<LocalServer[]>([]);
const selectedServers = ref<string[]>([]);
const newServerUrl = ref('');
const addingServer = ref(false);
const showAddServerModal = ref(false);
const mcpStatus = ref<'connected' | 'disconnected'>('disconnected');
const checkingMcpStatus = ref(false);
const mcpStatusInterval = ref<NodeJS.Timeout | null>(null);
const discovering = ref(false);
const discoveredServers = ref<DiscoveredServer[]>([]);
const selectedDiscoveredServers = ref<string[]>([]);
const healthMonitoringEnabled = ref(true);
const healthCheckInterval = ref<NodeJS.Timeout | null>(null);
const refreshingHealth = ref(false);
const confirmModal = ref<{ message: string; action: () => Promise<void> } | null>(null);
const confirmRunning = ref(false);

// Common ports to scan
const COMMON_PORTS = [3000, 3001, 4000, 5000, 5173, 5174, 8000, 8080, 8081, 8443, 8787, 8762, 4096, 5432, 6379, 3306, 27017, 9200];

// Map services to local servers format
const tabs = computed(() => [
  { id: 'servers' as const, label: 'Servers', count: localServers.value.length },
  { id: 'mcp' as const, label: 'MCP', count: mcpStatus.value === 'connected' ? 1 : 0 },
  // { id: 'lsp' as const, label: 'LSP', count: 0 },
  // { id: 'plugins' as const, label: 'Plugins', count: 0 },
]);

// Load servers from services
const loadServers = async () => {
  loadingServers.value = true;
  try {
    const services = await fetchServices();
    // Filter localhost services and map to server format
    localServers.value = services
      .filter((s: Service) => s.targetHost === 'localhost' || s.targetHost === '127.0.0.1')
      .map((s: Service) => ({
        id: s.id,
        host: s.targetHost,
        port: s.targetPort,
        name: s.name,
        status: s.status === 'OK' ? 'online' as const : 'offline' as const,
        isDefault: false,
        lastHealthCheck: s.lastCheckedAt ? new Date(s.lastCheckedAt) : undefined,
        latency: s.diagnostics?.[0]?.latencyMs || undefined,
        healthCheckInProgress: false,
      }));
  } catch (error) {
    console.error('Failed to load servers:', error);
  } finally {
    loadingServers.value = false;
  }
};

// Server Discovery (client-side port scanning)
const startDiscovery = async () => {
  discovering.value = true;
  discoveredServers.value = [];
  selectedDiscoveredServers.value = [];

  try {
    // Scan common ports
    const results: DiscoveredServer[] = [];
    
    // Use Promise.allSettled to scan ports in parallel (batches of 5)
    const batchSize = 5;
    for (let i = 0; i < COMMON_PORTS.length; i += batchSize) {
      const batch = COMMON_PORTS.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(port => checkPort('localhost', port))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const port = batch[index];
          results.push({
            host: 'localhost',
            port,
            type: detectServiceType(port),
            name: `localhost:${port}`,
          });
        }
      });
    }

    // Filter out already added servers
    const existingPorts = new Set(localServers.value.map(s => s.port));
    discoveredServers.value = results.filter(s => !existingPorts.has(s.port));

    if (discoveredServers.value.length === 0) {
      success('No new servers discovered');
    } else {
      success(`Discovered ${discoveredServers.value.length} server${discoveredServers.value.length > 1 ? 's' : ''}`);
    }
  } catch (error) {
    console.error('Discovery failed:', error);
    showError('Failed to discover servers');
  } finally {
    discovering.value = false;
  }
};

// Check if a port is open (client-side)
// Note: Browser security limits make this imperfect, but we try multiple methods
const checkPort = async (host: string, port: number): Promise<number | null> => {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 1500);

    const finish = (result: number | null) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(result);
      }
    };

    // Method 1: Try fetch with no-cors (most reliable for HTTP services)
    fetch(`http://${host}:${port}`, { 
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(1200)
    })
      .then(() => finish(port))
      .catch(() => {
        // Method 2: Try loading an image (works for HTTP servers)
        const img = new Image();
        img.onerror = () => finish(port); // Port is open (even if not HTTP)
        img.onload = () => finish(port);
        img.onabort = () => finish(null);
        
        // Set a shorter timeout for image
        setTimeout(() => {
          if (!resolved) {
            img.onerror = null;
            img.onload = null;
            img.onabort = null;
          }
        }, 1000);
        
        img.src = `http://${host}:${port}/favicon.ico?t=${Date.now()}`;
      });
  });
};

// Detect service type from port
const detectServiceType = (port: number): string => {
  const portMap: Record<number, string> = {
    3000: 'web',
    3001: 'web',
    4000: 'web',
    5000: 'web',
    5173: 'vite',
    5174: 'vite',
    8000: 'web',
    8080: 'web',
    8081: 'web',
    8443: 'https',
    5432: 'postgres',
    6379: 'redis',
    3306: 'mysql',
    27017: 'mongodb',
    9200: 'elasticsearch',
  };
  return portMap[port] || 'unknown';
};

// Add discovered server
const addDiscoveredServer = async (server: DiscoveredServer) => {
  try {
    await createExternalService(
      server.name || `${server.host}-${server.port}`,
      server.host,
      server.port,
      server.type === 'https' || server.port === 8443 ? 'https' : 'http'
    );
    await loadServers();
    discoveredServers.value = discoveredServers.value.filter(
      s => !(s.host === server.host && s.port === server.port)
    );
    success('Server added successfully');
  } catch (error: any) {
    showError(error.message || 'Failed to add server');
  }
};

// Bulk add discovered servers
const bulkAddDiscovered = async () => {
  const toAdd = discoveredServers.value.filter(s =>
    selectedDiscoveredServers.value.includes(`${s.host}:${s.port}`)
  );

  for (const server of toAdd) {
    await addDiscoveredServer(server);
  }
  selectedDiscoveredServers.value = [];
};

// Bulk operations
const toggleServerSelection = (serverId: string) => {
  const index = selectedServers.value.indexOf(serverId);
  if (index > -1) {
    selectedServers.value.splice(index, 1);
  } else {
    selectedServers.value.push(serverId);
  }
};

const selectAll = () => {
  if (selectedServers.value.length === localServers.value.length) {
    selectedServers.value = [];
  } else {
    selectedServers.value = localServers.value.map(s => s.id);
  }
};

const clearSelection = () => {
  selectedServers.value = [];
};

const bulkAddSelected = async () => {
  // This would add selected discovered servers
  if (selectedDiscoveredServers.value.length > 0) {
    await bulkAddDiscovered();
  }
};

const bulkDelete = async () => {
  if (selectedServers.value.length === 0) return;
  const count = selectedServers.value.length;
  confirmModal.value = {
    message: `Delete ${count} server${count > 1 ? 's' : ''}? This action cannot be undone.`,
    action: async () => {
      try {
        await Promise.all(
          selectedServers.value.map(serverId => deleteService(serverId))
        );
        selectedServers.value = [];
        await loadServers();
        success(`Deleted ${count} server${count > 1 ? 's' : ''}`);
      } catch (error: any) {
        showError(error.message || 'Failed to delete servers');
      }
    },
  };
};

const runConfirmAction = async () => {
  if (!confirmModal.value) return;
  confirmRunning.value = true;
  try {
    await confirmModal.value.action();
  } finally {
    confirmRunning.value = false;
    confirmModal.value = null;
  }
};

// Health monitoring
const checkServerHealth = async (server: LocalServer) => {
  const serverIndex = localServers.value.findIndex(s => s.id === server.id);
  if (serverIndex === -1) return;

  localServers.value[serverIndex].healthCheckInProgress = true;

  try {
    const result = await runCheck(server.id);
    if (result.service) {
      localServers.value[serverIndex].status = result.service.status === 'OK' ? 'online' : 'offline';
      localServers.value[serverIndex].lastHealthCheck = new Date();
      localServers.value[serverIndex].latency = result.diagnostic?.latencyMs;
    }
    success('Health check completed');
  } catch (error) {
    console.error('Health check failed:', error);
    showError('Health check failed');
  } finally {
    localServers.value[serverIndex].healthCheckInProgress = false;
  }
};

const refreshHealth = async () => {
  refreshingHealth.value = true;
  try {
    await Promise.all(
      localServers.value.map(server => checkServerHealth(server))
    );
  } finally {
    refreshingHealth.value = false;
  }
};

const formatHealthTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
};

// Auto-refresh health monitoring
watch(healthMonitoringEnabled, (enabled) => {
  if (enabled) {
    healthCheckInterval.value = setInterval(() => {
      refreshHealth();
    }, 30000); // Every 30 seconds
  } else {
    if (healthCheckInterval.value) {
      clearInterval(healthCheckInterval.value);
      healthCheckInterval.value = null;
    }
  }
});

const addServer = async () => {
  if (!newServerUrl.value.trim()) return;

  addingServer.value = true;
  try {
    // Parse URL (e.g., http://localhost:4096)
    const url = new URL(newServerUrl.value);
    const host = url.hostname;
    const port = parseInt(url.port || (url.protocol === 'https:' ? '443' : '80'), 10);

    await createExternalService(
      `${host}-${port}`,
      host,
      port,
      url.protocol === 'https:' ? 'https' : 'http'
    );

    newServerUrl.value = '';
    await loadServers();
    success('Server added successfully');
  } catch (error: any) {
    showError(error.message || 'Failed to add server');
  } finally {
    addingServer.value = false;
  }
};

const editServer = (server: LocalServer) => {
  navigateTo(`/services/${server.id}`);
};

const removeServer = (serverId: string) => {
  confirmModal.value = {
    message: 'Are you sure you want to remove this server? This action cannot be undone.',
    action: async () => {
      try {
        await deleteService(serverId);
        await loadServers();
        success('Server removed successfully');
      } catch (error) {
        console.error('Failed to remove server:', error);
        showError('Failed to remove server');
      }
    },
  };
};

const copyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    success('Command copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    showError('Failed to copy command. Please copy manually.');
  }
};

// Check MCP status
const checkMcp = async () => {
  if (checkingMcpStatus.value) return;
  
  checkingMcpStatus.value = true;
  try {
    const isConnected = await checkMcpStatus();
    mcpStatus.value = isConnected ? 'connected' : 'disconnected';
  } catch (error) {
    console.error('Failed to check MCP status:', error);
    mcpStatus.value = 'disconnected';
  } finally {
    checkingMcpStatus.value = false;
  }
};

// Watch for tab changes to start/stop MCP polling
watch(activeTab, (tab) => {
  if (tab === 'mcp') {
    // Check immediately when switching to MCP tab
    checkMcp();
    // Then poll every 10 seconds
    if (mcpStatusInterval.value) {
      clearInterval(mcpStatusInterval.value);
    }
    mcpStatusInterval.value = setInterval(() => {
      checkMcp();
    }, 10000); // Check every 10 seconds
  } else {
    // Stop polling when leaving MCP tab
    if (mcpStatusInterval.value) {
      clearInterval(mcpStatusInterval.value);
      mcpStatusInterval.value = null;
    }
  }
}, { immediate: true });

onMounted(async () => {
  await loadServers();

  if (localServers.value.length === 0) {
    startDiscovery();
  }

  // Connect to realtime updates
  const socket = connect();
  socket?.on('service:update', () => {
    loadServers();
  });
  socket?.on('service:delete', () => {
    loadServers();
  });
  socket?.on('agent:status', () => {
    // When agent status changes, check MCP status if on MCP tab
    if (activeTab.value === 'mcp') {
      checkMcp();
    }
  });

  // Start health monitoring if enabled
  if (healthMonitoringEnabled.value) {
    healthCheckInterval.value = setInterval(() => {
      refreshHealth();
    }, 30000);
  }
});

onUnmounted(() => {
  if (healthCheckInterval.value) {
    clearInterval(healthCheckInterval.value);
  }
  if (mcpStatusInterval.value) {
    clearInterval(mcpStatusInterval.value);
  }
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
