<template>
  <div class="min-h-screen bg-black-main text-white flex flex-col">
    <!-- Connect form (when not connected) -->
    <div v-if="!connected" class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-10 text-white">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">Browser terminal</h1>
          <p class="text-gray-400 text-sm">Enter the share code from the host. They must run <code class="text-gray-300 bg-gray-500/20 px-1 rounded">connect shell</code> and include it in their share.</p>
        </div>
        <form @submit.prevent="startConnection" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-6">
          <label class="block text-sm font-medium text-gray-300 mb-2">Share code</label>
          <input
            v-model="code"
            type="password"
            placeholder="e.g. abc123"
            class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/20 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none text-white placeholder-gray-500"
            autocomplete="off"
          />
          <label class="flex items-center gap-2 mt-4 cursor-pointer select-none">
            <input v-model="shared" type="checkbox" class="w-4 h-4 rounded border-gray-500/20 bg-gray-500/10 text-blue-300 focus:ring-blue-300" />
            <span class="text-sm text-gray-400">Shared session <span class="text-gray-500">(everyone sees the same terminal)</span></span>
          </label>
          <button
            type="submit"
            :disabled="!code.trim()"
            class="mt-4 w-full py-3 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
          >
            Connect
          </button>
        </form>
        <p class="mt-4 text-center text-xs text-gray-500">
          <NuxtLink to="/" class="text-blue-300 hover:text-blue-400">Back to Private Connect</NuxtLink>
        </p>
      </div>
    </div>

    <!-- Terminal (when connected) -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <WebTerminal
        :code="code"
        :shared="shared"
        @connected="connected = true"
        @disconnected="connected = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const code = ref('');
const shared = ref(false);
const connected = ref(false);

function startConnection() {
  if (!code.value.trim()) return;
  connected.value = true;
}
</script>
