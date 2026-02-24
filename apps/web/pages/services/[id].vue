<template>
  <div class="animate-fade-in">
    <!-- Breadcrumb Navigation -->
    <nav class="flex items-center gap-2 text-sm mb-8">
      <NuxtLink to="/services" class="text-gray-500 hover:text-white transition-colors">
        Services
      </NuxtLink>
      <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span v-if="service" class="text-white font-medium">{{ service.name }}</span>
      <SkeletonLoader v-else class="!w-24 !h-4" />
    </nav>

    <!-- Loading State with Skeleton -->
    <ServiceDetailSkeleton v-if="loading" />

    <!-- Service Detail -->
    <div v-else-if="service" class="space-y-8">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-4 mb-3">
            <h1 class="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {{ service.name }}
            </h1>
            <button
              @click="showRenameModal = true"
              class="p-1.5 rounded-lg hover:bg-gray-500/20 text-gray-500 hover:text-gray-300 transition-colors"
              title="Rename service"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <StatusPill :status="service.status" size="lg" />
          </div>
          <p class="text-gray-400 font-mono text-sm">
            {{ service.targetHost }}:{{ service.targetPort }}
            <template v-if="service.tunnelPort">
              <span class="mx-2 text-gray-600">→</span>
              <span class="text-blue-300">localhost:{{ service.tunnelPort }}</span>
            </template>
          </p>
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Delete button -->
          <button
            @click="showDeleteModal = true"
            class="flex items-center text-sm gap-2 px-4 py-2.5 bg-gray-500/10 hover:bg-red-500/20 border border-gray-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-lg font-medium transition-all"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>

          <!-- Share button -->
          <button
            @click="showShareModal = true"
            class="flex items-center text-sm gap-2 px-4 py-2.5 bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-white rounded-lg font-medium transition-all"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          <!-- Run check dropdown -->
          <div class="relative">
            <button
              @click="showAgentDropdown = !showAgentDropdown"
              :disabled="checking"
              class="flex items-center text-sm gap-2 px-5 py-2.5 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg font-semibold transition-all"
            >
            <svg v-if="checking" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Run Check
            <svg class="w-4 h-4 -mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <Transition name="dropdown">
            <div 
              v-if="showAgentDropdown"
              class="absolute right-0 mt-2 w-52 bg-black border border-gray-500/20 rounded-xl shadow-2xl z-10 overflow-hidden"
            >
              <button
                @click="handleCheck"
                class="w-full px-4 py-3 text-left text-sm hover:bg-gray-500/10 transition-colors flex items-center gap-3 border-b border-gray-500/10"
              >
                <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <div>
                  <div class="font-medium text-white">Hub</div>
                  <div class="text-xs text-gray-500">Check from server</div>
                </div>
              </button>
              <div v-if="onlineAgents.length > 0" class="py-1">
                <button
                  v-for="agent in onlineAgents"
                  :key="agent.id"
                  @click="handleReachCheck(agent.id)"
                  class="w-full px-4 py-3 text-left text-sm hover:bg-gray-500/10 transition-colors flex items-center gap-3"
                >
                  <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                    <span class="w-2 h-2 rounded-full bg-purple-300"></span>
                  </div>
                  <div>
                    <div class="font-medium text-white">{{ agent.label }}</div>
                    <div class="text-xs text-gray-500">Agent</div>
                  </div>
                </button>
              </div>
              <div v-else class="px-4 py-3 text-xs text-gray-500 italic">
                No agents online
              </div>
            </div>
          </Transition>
        </div>
        </div>
      </div>

      <!-- Share Modal -->
      <ShareModal
        :is-open="showShareModal"
        :service-id="service.id"
        :service-name="service.name"
        @close="showShareModal = false"
        @created="handleShareCreated"
      />

      <!-- Custom Subdomain Modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div 
            v-if="showSubdomainModal" 
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
            @click.self="showSubdomainModal = false"
          >
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
            <div class="relative bg-black border border-gray-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 class="text-lg font-semibold text-white mb-2">Custom Public URL</h3>
              <p class="text-sm text-gray-400 mb-4">
                Set a custom subdomain for this service. Anyone with the URL can access it.
              </p>
              
              <!-- Subdomain input -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-2">Subdomain</label>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 text-sm">app.privateconnect.co/w/</span>
                  <input
                    v-model="subdomainInput"
                    type="text"
                    placeholder="my-staging-api"
                    class="flex-1 bg-gray-500/10 border border-gray-500/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                    :class="{ 
                      'border-red-400': subdomainError,
                      'border-green-300': subdomainAvailable && subdomainInput
                    }"
                    @input="checkSubdomainDebounced"
                  />
                </div>
                
                <!-- Status message -->
                <div class="mt-2 text-sm">
                  <span v-if="checkingSubdomain" class="text-gray-400">Checking availability...</span>
                  <span v-else-if="subdomainError" class="text-red-400">{{ subdomainError }}</span>
                  <span v-else-if="subdomainAvailable && subdomainInput" class="text-green-300">✓ Available</span>
                  <span v-else-if="!subdomainInput" class="text-gray-500">3-32 chars, lowercase, hyphens allowed</span>
                </div>
              </div>
              
              <!-- Preview -->
              <div v-if="subdomainInput && subdomainAvailable" class="mb-4 p-3 bg-gray-500/10 border border-gray-500/10 rounded-lg">
                <div class="text-xs text-gray-500 mb-1">Public URL</div>
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm text-cyan-300 font-mono truncate">https://app.privateconnect.co/w/{{ subdomainInput }}</div>
                  <button
                    @click="copyToClipboard(`https://app.privateconnect.co/w/${subdomainInput}`)"
                    class="text-gray-500 hover:text-white transition-colors shrink-0 p-1"
                    title="Copy URL"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center justify-between">
                <button
                  v-if="service.publicSubdomain"
                  @click="clearSubdomain"
                  :disabled="savingSubdomain"
                  class="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove public URL
                </button>
                <span v-else></span>
                
                <div class="flex gap-3">
                  <button
                    @click="showSubdomainModal = false"
                    class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    @click="saveSubdomain"
                    :disabled="!subdomainInput || !subdomainAvailable || savingSubdomain"
                    class="px-4 py-2 text-sm bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
                  >
                    {{ savingSubdomain ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Rename Modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div 
            v-if="showRenameModal" 
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
            @click.self="showRenameModal = false"
          >
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
            <div class="relative bg-black border border-gray-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 class="text-lg font-semibold text-white mb-2">Rename Service</h3>
              <p class="text-sm text-gray-400 mb-4">
                Change the display name for this service.
              </p>
              
              <!-- Name input -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  v-model="renameInput"
                  type="text"
                  placeholder="my-api"
                  class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  :class="{ 
                    'border-red-400': renameError,
                    'border-green-300': renameAvailable && renameInput && renameInput !== service?.name
                  }"
                  @input="checkRenameDebounced"
                  @keydown.enter="saveRename"
                />
                
                <!-- Status message -->
                <div class="mt-2 text-sm">
                  <span v-if="checkingRename" class="text-gray-400">Checking availability...</span>
                  <span v-else-if="renameError" class="text-red-400">{{ renameError }}</span>
                  <span v-else-if="renameInput === service?.name" class="text-gray-500">Current name</span>
                  <span v-else-if="renameAvailable && renameInput" class="text-green-300">✓ Available</span>
                  <span v-else-if="!renameInput" class="text-gray-500">Letters, numbers, hyphens, underscores</span>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center justify-end gap-3">
                <button
                  @click="showRenameModal = false"
                  class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="saveRename"
                  :disabled="!renameInput || !renameAvailable || savingRename || renameInput === service?.name"
                  class="px-4 py-2 text-sm bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
                >
                  {{ savingRename ? 'Saving...' : 'Rename' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Delete Confirmation Modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div 
            v-if="showDeleteModal" 
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
            @click.self="showDeleteModal = false"
          >
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
            <div class="relative bg-black border border-gray-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 class="text-lg font-semibold text-white mb-2">Delete Service</h3>
              <p class="text-sm text-gray-400 mb-4">
                Are you sure you want to delete <span class="text-white font-medium">{{ service.name }}</span>? This will stop all tunnels and remove the service permanently.
              </p>
              
              <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
                <p class="text-sm text-red-400">
                  This action cannot be undone. All shares and diagnostics will also be deleted.
                </p>
              </div>
              
              <div class="flex items-center justify-end gap-3">
                <button
                  @click="showDeleteModal = false"
                  class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleDeleteService"
                  :disabled="deleting"
                  class="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {{ deleting ? 'Deleting...' : 'Delete Service' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Connection Flow Visualization -->
      <ConnectionFlow
        :agent-label="service.agent?.label || 'Agent'"
        :agent-online="service.agent?.isOnline || false"
        :tunnel-port="service.tunnelPort"
        :target-host="service.targetHost"
        :latency="latestDiagnostic?.latencyMs"
        :diagnostic="latestDiagnostic"
        :is-external="service.isExternal"
      />

      <!-- Service Info Cards -->
      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Connection Details Card -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-500/10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span class="text-base font-semibold text-white">Connection Details</span>
            </div>
          </div>
          <div class="divide-y divide-gray-500/10">
            <div class="flex items-center px-5 py-2 bg-gray-500/10">
              <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Property</span>
              <span class="w-40 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Value</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Target</span>
              <span class="w-40 text-sm text-gray-200 text-right font-mono">{{ service.targetHost }}:{{ service.targetPort }}</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Tunnel Port</span>
              <span class="w-40 text-sm text-right font-mono" :class="service.tunnelPort ? 'text-blue-300' : 'text-gray-500'">
                {{ service.tunnelPort || '—' }}
              </span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Protocol</span>
              <span class="w-40 text-sm text-gray-200 text-right font-mono">{{ service.protocol }}</span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Connection</span>
              <span class="w-40 text-sm text-right" :class="service.isExternal ? 'text-purple-300' : 'text-blue-300'">
                {{ service.isExternal ? 'Direct' : 'Tunnel' }}
              </span>
            </div>
            <!-- Public URL row -->
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Public URL</span>
              <div class="flex items-center gap-2">
                <button
                  v-if="service.publicSubdomain"
                  @click.stop="copyPublicUrl"
                  class="text-gray-500 hover:text-white transition-colors p-1"
                  :title="publicUrlCopied ? 'Copied!' : 'Copy URL'"
                >
                  <svg v-if="!publicUrlCopied" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  @click="showSubdomainModal = true"
                  class="text-sm text-right font-mono truncate transition-colors flex items-center gap-2"
                  :class="service.publicSubdomain ? 'text-cyan-300 hover:text-cyan-400' : 'text-gray-500 hover:text-gray-400'"
                >
                  <template v-if="service.publicSubdomain">
                    app.privateconnect.co/w/{{ service.publicSubdomain }}
                  </template>
                  <template v-else>
                    Set custom URL
                  </template>
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="service.agentId" class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Agent</span>
              <NuxtLink :to="`/agents/${service.agentId}`" class="w-40 text-sm text-blue-300 hover:text-blue-200 text-right font-mono truncate transition-colors">
                {{ service.agent?.label || service.agentId?.slice(0, 12) }}...
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Status Card -->
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-500/10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span class="text-base font-semibold text-white">Status</span>
            </div>
          </div>
          <div class="divide-y divide-gray-500/10">
            <div class="flex items-center px-5 py-2 bg-gray-500/10">
              <span class="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</span>
              <span class="w-32 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Status</span>
            </div>
            <div v-if="service.agentId" class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Agent Status</span>
              <span class="w-32 text-right flex items-center justify-end gap-2">
                <span :class="service.agent?.isOnline ? 'w-2 h-2 rounded-full bg-emerald-300' : 'w-2 h-2 rounded-full bg-gray-500'"></span>
                <span :class="service.agent?.isOnline ? 'text-sm text-emerald-300' : 'text-sm text-gray-400'">
                  {{ service.agent?.isOnline ? 'Online' : 'Offline' }}
                </span>
              </span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Service Health</span>
              <span class="w-32 text-right flex items-center justify-end gap-2">
                <span :class="service.status === 'OK' ? 'w-2 h-2 rounded-full bg-emerald-300' : service.status === 'FAIL' ? 'w-2 h-2 rounded-full bg-red-400' : 'w-2 h-2 rounded-full bg-gray-500'"></span>
                <span :class="service.status === 'OK' ? 'text-sm text-emerald-300' : service.status === 'FAIL' ? 'text-sm text-red-400' : 'text-sm text-gray-400'">
                  {{ service.status === 'OK' ? 'Healthy' : service.status === 'FAIL' ? 'Unhealthy' : 'Unknown' }}
                </span>
              </span>
            </div>
            <div class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Last Check</span>
              <span class="w-32 text-sm text-gray-200 text-right">{{ formatTime(service.lastCheckedAt) }}</span>
            </div>
            <div v-if="latestDiagnostic" class="flex items-center px-5 py-3">
              <span class="flex-1 text-sm text-gray-400">Checked From</span>
              <span class="w-32 text-sm text-gray-200 text-right">
                {{ latestDiagnostic.perspective === 'hub' ? 'Hub' : latestDiagnostic.sourceLabel || 'Agent' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Latest Diagnostic -->
      <div v-if="latestDiagnostic" class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Diagnostic</h3>
          <span class="text-xs text-gray-500">
            {{ formatTime(latestDiagnostic.createdAt) }}
          </span>
        </div>
        
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <DiagnosticItem label="DNS" :status="latestDiagnostic.dnsStatus" />
          <DiagnosticItem label="TCP" :status="latestDiagnostic.tcpStatus" />
          <DiagnosticItem label="TLS" :status="latestDiagnostic.tlsStatus || 'N/A'" />
          <DiagnosticItem label="HTTP" :status="latestDiagnostic.httpStatus || 'N/A'" />
          <DiagnosticItem label="Latency" :status="latestDiagnostic.latencyMs ? `${latestDiagnostic.latencyMs}ms` : 'N/A'" />
        </div>

        <!-- TLS Details -->
        <div v-if="parsedTlsDetails" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 mb-4">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4" :class="parsedTlsDetails.valid ? 'text-emerald-300' : 'text-amber-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span class="text-sm font-medium text-white">TLS Certificate</span>
          </div>
          <div class="grid sm:grid-cols-2 gap-3 text-sm">
            <div v-if="parsedTlsDetails.subject" class="text-gray-400">
              <span class="text-gray-500">Subject:</span> {{ parsedTlsDetails.subject }}
            </div>
            <div v-if="parsedTlsDetails.issuer" class="text-gray-400">
              <span class="text-gray-500">Issuer:</span> {{ parsedTlsDetails.issuer }}
            </div>
            <div v-if="parsedTlsDetails.daysUntilExpiry !== undefined" class="text-gray-400">
              <span class="text-gray-500">Expires:</span> 
              <span :class="parsedTlsDetails.daysUntilExpiry < 30 ? 'text-amber-300' : 'text-emerald-300'">
                {{ parsedTlsDetails.daysUntilExpiry }} days
              </span>
            </div>
            <div v-if="parsedTlsDetails.selfSigned" class="text-amber-300">
              ⚠️ Self-signed certificate
            </div>
            <div v-if="parsedTlsDetails.error" class="text-red-400 sm:col-span-2">
              {{ parsedTlsDetails.error }}
            </div>
          </div>
        </div>

        <!-- HTTP Details -->
        <div v-if="parsedHttpDetails" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 mb-4">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4" :class="parsedHttpDetails.statusCode && parsedHttpDetails.statusCode < 400 ? 'text-emerald-300' : 'text-red-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span class="text-sm font-medium text-white">HTTP Health Check</span>
          </div>
          <div class="flex flex-wrap items-center gap-6 text-sm">
            <div v-if="parsedHttpDetails.statusCode" class="text-gray-400">
              <span class="text-gray-500">Status:</span> 
              <span :class="parsedHttpDetails.statusCode < 400 ? 'text-emerald-300' : 'text-red-400'">
                {{ parsedHttpDetails.statusCode }} {{ parsedHttpDetails.statusMessage }}
              </span>
            </div>
            <div v-if="parsedHttpDetails.responseTime" class="text-gray-400">
              <span class="text-gray-500">Response:</span> {{ parsedHttpDetails.responseTime }}ms
            </div>
            <div v-if="parsedHttpDetails.error" class="text-red-400">
              {{ parsedHttpDetails.error }}
            </div>
          </div>
        </div>

        <div class="bg-gray-500/10 rounded-lg p-4 font-mono text-sm flex items-center justify-between">
          <span :class="latestDiagnostic.message === 'OK' ? 'text-emerald-300' : 'text-red-400'">
            {{ latestDiagnostic.message }}
          </span>
          <span class="text-xs text-gray-500">
            from {{ latestDiagnostic.perspective === 'hub' ? 'Hub' : latestDiagnostic.sourceLabel || 'Agent' }}
          </span>
        </div>
      </div>

      <!-- Diagnostics Timeline -->
      <div v-if="diagnostics.length > 0" class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Diagnostics History</h3>
        
        <div class="space-y-1">
          <NuxtLink
            v-for="(diag, index) in diagnostics"
            :key="diag.id"
            :to="`/diagnostics/${diag.shareToken}`"
            class="flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-gray-500/10 transition-colors group"
            :style="{ animationDelay: `${index * 30}ms` }"
          >
            <div class="flex items-center gap-4">
              <StatusPill :status="getDiagnosticStatus(diag)" size="sm" />
              <span class="text-sm text-gray-300 group-hover:text-white transition-colors">{{ diag.message }}</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span class="px-2 py-1 bg-gray-500/10 rounded-md">
                {{ diag.perspective === 'hub' ? 'Hub' : diag.sourceLabel || 'Agent' }}
              </span>
              <span>{{ formatTime(diag.createdAt) }}</span>
              <svg class="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Not Found -->
    <div v-else class="text-center py-20">
      <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gray-500/10 flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold mb-2">Service not found</h2>
      <p class="text-gray-400 mb-6">The service you're looking for doesn't exist.</p>
      <NuxtLink to="/services" class="text-blue-300 hover:underline">
        ← Back to services
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Service, DiagnosticResult, Agent } from '~/types';

definePageMeta({
  middleware: 'auth',
});

const route = useRoute();
const { fetchService, fetchServiceDiagnostics, fetchOnlineAgents, runCheck, runReachCheck, checkSubdomain: apiCheckSubdomain, setSubdomain: apiSetSubdomain, updateService: apiUpdateService } = useApi();
const { connect } = useSocket();
const { success, error: showError } = useToast();

const service = ref<Service | null>(null);
const diagnostics = ref<DiagnosticResult[]>([]);
const onlineAgents = ref<Agent[]>([]);
const loading = ref(true);
const checking = ref(false);
const showAgentDropdown = ref(false);
const showShareModal = ref(false);

// Subdomain modal state
const showSubdomainModal = ref(false);
const subdomainInput = ref('');
const subdomainError = ref('');
const subdomainAvailable = ref(false);
const checkingSubdomain = ref(false);
const savingSubdomain = ref(false);
const publicUrlCopied = ref(false);
let checkDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function copyPublicUrl() {
  if (!service.value?.publicSubdomain) return;
  const url = `https://app.privateconnect.co/w/${service.value.publicSubdomain}`;
  navigator.clipboard.writeText(url);
  publicUrlCopied.value = true;
  setTimeout(() => { publicUrlCopied.value = false; }, 2000);
}

// Rename modal state
const showRenameModal = ref(false);
const renameInput = ref('');
const renameError = ref('');
const renameAvailable = ref(false);
const checkingRename = ref(false);
const savingRename = ref(false);

// Delete modal state
const showDeleteModal = ref(false);
const deleting = ref(false);
let renameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Dynamic page title
const pageTitle = computed(() => 
  service.value ? `${service.value.name} - Private Connect` : 'Service - Private Connect'
)
useHead({ title: pageTitle })

const latestDiagnostic = computed<DiagnosticResult | null>(() => {
  return diagnostics.value[0] || null;
});

const parsedTlsDetails = computed(() => {
  if (!latestDiagnostic.value?.tlsDetails) return null;
  try {
    return JSON.parse(latestDiagnostic.value.tlsDetails);
  } catch {
    return null;
  }
});

const parsedHttpDetails = computed(() => {
  if (!latestDiagnostic.value?.httpDetails) return null;
  try {
    return JSON.parse(latestDiagnostic.value.httpDetails);
  } catch {
    return null;
  }
});

const formatTime = (date: string | null | undefined) => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleString();
};

// Determine overall diagnostic status based on all checks
const getDiagnosticStatus = (diag: DiagnosticResult): 'OK' | 'FAIL' => {
  if (diag.tcpStatus !== 'OK') return 'FAIL';
  if (diag.tlsStatus === 'FAIL') return 'FAIL';
  if (diag.httpStatus === 'FAIL') return 'FAIL';
  return 'OK';
};

onMounted(async () => {
  try {
    const [serviceData, diagData, agentsData] = await Promise.all([
      fetchService(route.params.id as string),
      fetchServiceDiagnostics(route.params.id as string, 20),
      fetchOnlineAgents(),
    ]);
    service.value = serviceData;
    diagnostics.value = diagData;
    onlineAgents.value = agentsData;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    loading.value = false;
  }

  // Connect to realtime updates
  const socket = connect();
  
  socket?.on('service:update', (updatedService: Service) => {
    if (updatedService.id === route.params.id) {
      service.value = updatedService;
    }
  });

  socket?.on('diagnostic:new', (diagnostic: DiagnosticResult) => {
    if (diagnostic.serviceId === route.params.id) {
      diagnostics.value = [diagnostic, ...diagnostics.value.slice(0, 19)];
    }
  });
});

// Close dropdown on click outside
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.relative')) {
      showAgentDropdown.value = false;
    }
  });
});

const handleCheck = async () => {
  showAgentDropdown.value = false;
  checking.value = true;
  try {
    const result = await runCheck(route.params.id as string);
    service.value = result.service;
    diagnostics.value = [result.diagnostic, ...diagnostics.value.slice(0, 19)];
    success('Health check completed');
  } catch (error) {
    console.error('Failed to run check:', error);
    showError('Failed to run health check');
  } finally {
    checking.value = false;
  }
};

const handleShareCreated = () => {
  success('Share link created!');
};

const handleReachCheck = async (agentId: string) => {
  showAgentDropdown.value = false;
  checking.value = true;
  try {
    const result = await runReachCheck(route.params.id as string, agentId);
    service.value = result.service || service.value;
    diagnostics.value = [result.diagnostic, ...diagnostics.value.slice(0, 19)];
    success('Health check completed');
  } catch (error) {
    console.error('Failed to run reach check:', error);
    showError('Failed to run health check');
  } finally {
    checking.value = false;
  }
};

// Subdomain functions
watch(showSubdomainModal, (open) => {
  if (open) {
    // Pre-fill with existing subdomain
    subdomainInput.value = service.value?.publicSubdomain || '';
    subdomainError.value = '';
    subdomainAvailable.value = !!service.value?.publicSubdomain;
  }
});

// Normalize subdomain: accept pasted full URL (e.g. https://privateconnect.co/w/my-app) and extract subdomain
function normalizeSubdomainInput(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const wMatch = lower.match(/\/w\/([a-z0-9-]+)\/?$/);
  if (wMatch) return wMatch[1];
  const pathMatch = lower.match(/privateconnect\.co\/w\/([a-z0-9-]+)/);
  if (pathMatch) return pathMatch[1];
  return lower;
}

const checkSubdomainDebounced = () => {
  if (checkDebounceTimer) clearTimeout(checkDebounceTimer);
  subdomainError.value = '';
  subdomainAvailable.value = false;
  
  const raw = subdomainInput.value;
  const value = normalizeSubdomainInput(raw);
  if (value !== raw) subdomainInput.value = value;
  if (!value) return;
  
  checkingSubdomain.value = true;
  checkDebounceTimer = setTimeout(async () => {
    try {
      const response = await apiCheckSubdomain(route.params.id as string, value);
      if (!response.valid) {
        subdomainError.value = response.error || 'Invalid subdomain';
        subdomainAvailable.value = false;
      } else if (!response.available) {
        subdomainError.value = 'This subdomain is already taken';
        subdomainAvailable.value = false;
      } else {
        subdomainAvailable.value = true;
      }
    } catch (err) {
      subdomainError.value = 'Failed to check availability';
    } finally {
      checkingSubdomain.value = false;
    }
  }, 300);
};

const saveSubdomain = async () => {
  const subdomain = normalizeSubdomainInput(subdomainInput.value);
  if (!subdomain || !subdomainAvailable.value) return;
  
  savingSubdomain.value = true;
  try {
    const response = await apiSetSubdomain(route.params.id as string, subdomain);
    if (response.success && response.service) {
      if (service.value) {
        service.value.publicSubdomain = response.service.publicSubdomain;
        service.value.isPublic = response.service.isPublic;
      }
      success('Custom URL saved!');
      showSubdomainModal.value = false;
    }
  } catch (err: any) {
    showError(err?.data?.message || 'Failed to save subdomain');
  } finally {
    savingSubdomain.value = false;
  }
};

const clearSubdomain = async () => {
  savingSubdomain.value = true;
  try {
    const response = await apiSetSubdomain(route.params.id as string, null);
    if (response.success) {
      if (service.value) {
        service.value.publicSubdomain = null;
        service.value.isPublic = false;
      }
      success('Public URL removed');
      showSubdomainModal.value = false;
    }
  } catch (err: any) {
    showError(err?.data?.message || 'Failed to remove subdomain');
  } finally {
    savingSubdomain.value = false;
  }
};

// Rename functions
watch(showRenameModal, (open) => {
  if (open) {
    // Pre-fill with current name
    renameInput.value = service.value?.name || '';
    renameError.value = '';
    renameAvailable.value = true; // Current name is valid
  }
});

const checkRenameDebounced = () => {
  if (renameDebounceTimer) clearTimeout(renameDebounceTimer);
  renameError.value = '';
  renameAvailable.value = false;
  
  const value = renameInput.value.trim();
  if (!value) return;
  
  // If same as current name, no need to check
  if (value === service.value?.name) {
    renameAvailable.value = true;
    return;
  }
  
  // Basic client-side validation
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    renameError.value = 'Only letters, numbers, hyphens, and underscores allowed';
    return;
  }
  if (value.length > 100) {
    renameError.value = 'Name must be 100 characters or less';
    return;
  }
  
  checkingRename.value = true;
  renameDebounceTimer = setTimeout(async () => {
    try {
      // Basic validation only; save will handle API conflicts
      renameAvailable.value = true;
    } catch (err) {
      renameError.value = 'Failed to check availability';
    } finally {
      checkingRename.value = false;
    }
  }, 300);
};

const saveRename = async () => {
  const newName = renameInput.value.trim();
  if (!newName || newName === service.value?.name) return;
  
  savingRename.value = true;
  try {
    const response = await apiUpdateService(route.params.id as string, { name: newName });
    if (response.success && response.service) {
      if (service.value) {
        service.value.name = response.service.name;
      }
      success('Service renamed!');
      showRenameModal.value = false;
    }
  } catch (err: any) {
    const message = err?.data?.message || 'Failed to rename service';
    if (message.includes('already exists')) {
      renameError.value = 'A service with this name already exists';
      renameAvailable.value = false;
    } else {
      showError(message);
    }
  } finally {
    savingRename.value = false;
  }
};

// Delete service
const handleDeleteService = async () => {
  deleting.value = true;
  try {
    const { deleteService } = useApi();
    await deleteService(route.params.id as string);
    success('Service deleted');
    showDeleteModal.value = false;
    // Navigate back to services list
    navigateTo('/services');
  } catch (err: any) {
    showError(err?.message || 'Failed to delete service');
  } finally {
    deleting.value = false;
  }
};
</script>

<style scoped>
.dropdown-enter-active {
  animation: dropdown-in 0.15s ease-out;
}

.dropdown-leave-active {
  animation: dropdown-out 0.1s ease-in;
}

@keyframes dropdown-in {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdown-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
}
</style>
