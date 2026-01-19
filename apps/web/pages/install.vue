<template>
  <div class="min-h-screen bg-black">
    <LandingHeader />
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pt-24">
      <!-- Header -->
      <div class="mb-12">
        <!-- <NuxtLink to="/" class="text-gray-500 hover:text-white text-sm mb-4 inline-flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to home
        </NuxtLink> -->
        <h1 class="text-3xl font-bold text-white mt-4 mb-2">Install Private Connect</h1>
        <p class="text-gray-400">Download the CLI for your platform. Verify with checksums for production use.</p>
      </div>

      <!-- Quick Install -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-3">Quick Install (Development)</h2>
        <p class="text-gray-500 text-sm mb-4">For local development, the install script is the fastest way to get started:</p>
        <div class="bg-black/50 rounded-lg p-4 font-mono text-sm">
          <span class="text-gray-500">$</span> <span class="text-gray-300">curl -fsSL https://privateconnect.co/install.sh | bash</span>
        </div>
        <p class="text-gray-600 text-xs mt-3">This script detects your OS/architecture, downloads the correct binary, and installs to <code class="text-gray-400">/usr/local/bin</code>.</p>
      </div>

      <!-- Manual Download -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-3">Manual Download (Production)</h2>
        <p class="text-gray-500 text-sm mb-6">For production environments, download directly and verify the checksum:</p>

        <!-- Platform Downloads -->
        <div class="space-y-4">
          <!-- macOS -->
          <div class="bg-black/30 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-gray-500/20 flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <div class="text-white font-medium">macOS</div>
              </div>
              <div class="flex items-center gap-3">
                <div class="relative">
                  <select 
                    v-model="macArch"
                    class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer"
                  >
                    <option value="arm64">Apple Silicon (M1/M2/M3/M4)</option>
                    <option value="x64">Intel (x86_64)</option>
                  </select>
                  <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <a 
                  :href="getDownloadUrl('darwin', macArch)" 
                  class="px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-400 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
            <div class="p-2 bg-black/50 rounded font-mono text-xs text-gray-500 break-all">
              <span class="text-gray-600">SHA256:</span> {{ checksums[`darwin-${macArch}`] || 'Loading...' }}
            </div>
          </div>

          <!-- Linux -->
          <div class="bg-black/30 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-gray-500/20 flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.468v.018c.003.2.048.39.121.549.067.135.143.2.233.335.026.015.06.03.086.045v.02a.415.415 0 01-.069.095.64.64 0 01-.281.135c-.104.032-.214.045-.32.045h-.023c-.185-.002-.36-.066-.514-.2a1.27 1.27 0 01-.354-.532c-.088-.2-.132-.4-.132-.6v-.02c0-.193.035-.4.105-.602.074-.2.179-.4.315-.532.136-.132.29-.2.465-.2h.024zm-5.14.018h.016c.153 0 .288.054.413.162.124.135.206.266.278.4.073.135.12.27.144.405.028.133.04.267.04.4a.97.97 0 01-.066.4c-.042.133-.102.2-.175.333-.02.033-.047.067-.068.1a.64.64 0 01-.152.106h-.019c-.052.033-.096.066-.146.066-.031.015-.063.031-.1.031h-.032a.834.834 0 01-.108-.004c-.167-.023-.296-.066-.422-.135a.641.641 0 01-.256-.27.96.96 0 01-.108-.4c-.002-.132.02-.266.058-.398a.99.99 0 01.19-.4c.086-.13.178-.2.282-.265a.677.677 0 01.348-.097h.02z"/>
                  </svg>
                </div>
                <div class="text-white font-medium">Linux</div>
              </div>
              <div class="flex items-center gap-3">
                <div class="relative">
                  <select 
                    v-model="linuxArch"
                    class="bg-gray-500/10 border border-gray-500/10 text-white rounded-full pl-5 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all appearance-none cursor-pointer"
                  >
                    <option value="x64">x64 (Ubuntu, Debian, RHEL)</option>
                    <option value="arm64">ARM64 (Raspberry Pi, Graviton)</option>
                  </select>
                  <svg class="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <a 
                  :href="getDownloadUrl('linux', linuxArch)" 
                  class="px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-400 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
            <div class="p-2 bg-black/50 rounded font-mono text-xs text-gray-500 break-all">
              <span class="text-gray-600">SHA256:</span> {{ checksums[`linux-${linuxArch}`] || 'Loading...' }}
            </div>
          </div>
        </div>

        <p class="text-gray-600 text-xs mt-4">
          Windows is not currently supported. For Windows development, consider using WSL2 with the Linux binary.
        </p>
      </div>

      <!-- Installation Instructions -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-4">Installation Instructions</h2>
        
        <div class="space-y-6">
          <!-- Step 1 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-6 h-6 rounded-full bg-blue-300/10 text-blue-300 text-xs font-bold flex items-center justify-center">1</span>
              <span class="text-white font-medium">Download and verify</span>
            </div>
            <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2 ml-8">
              <div class="text-gray-500"># Download the binary for your platform (use URL from above)</div>
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">curl -fsSL -o connect &lt;DOWNLOAD_URL&gt;</span></div>
              <div class="text-gray-500 mt-3"># Verify the checksum</div>
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">shasum -a 256 connect</span></div>
              <div class="text-gray-500"># Compare with the SHA256 shown above</div>
            </div>
          </div>

          <!-- Step 2 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-6 h-6 rounded-full bg-blue-300/10 text-blue-300 text-xs font-bold flex items-center justify-center">2</span>
              <span class="text-white font-medium">Install the binary</span>
            </div>
            <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2 ml-8">
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">chmod +x connect</span></div>
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">sudo mv connect /usr/local/bin/</span></div>
            </div>
          </div>

          <!-- Step 3 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-6 h-6 rounded-full bg-blue-300/10 text-blue-300 text-xs font-bold flex items-center justify-center">3</span>
              <span class="text-white font-medium">Authenticate and connect</span>
            </div>
            <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2 ml-8">
              <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect up</span></div>
              <div class="text-gray-500"># Opens browser for authentication</div>
              <div class="mt-2"><span class="text-gray-500">$</span> <span class="text-gray-300">connect prod-db</span></div>
              <div class="text-emerald-300"># ✓ Connected on localhost:5432</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CI/CD -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-3">CI/CD Installation</h2>
        <p class="text-gray-500 text-sm mb-4">For automated environments, use an API key instead of browser authentication:</p>
        <div class="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2">
          <div><span class="text-gray-500">$</span> <span class="text-gray-300">curl -fsSL https://privateconnect.co/install.sh | bash</span></div>
          <div><span class="text-gray-500">$</span> <span class="text-gray-300">connect up --api-key $PRIVATECONNECT_API_KEY --label ci-runner</span></div>
        </div>
        <p class="text-gray-600 text-xs mt-3">
          The install script is acceptable for ephemeral CI runners. For long-lived build servers, use the manual download method above.
        </p>
        <p class="text-gray-600 text-xs mt-2">
          Generate API keys in your <NuxtLink to="/settings/api-keys" class="text-blue-300 hover:underline">workspace settings</NuxtLink>.
        </p>
      </div>

      <!-- View releases -->
      <div class="mt-8 text-center">
        <a 
          href="https://github.com/treadiehq/private-connect/releases" 
          target="_blank"
          class="text-gray-500 hover:text-white text-sm inline-flex items-center gap-2"
        >
          View all releases on GitHub
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

useHead({
  title: 'Install - Private Connect',
});

definePageMeta({
  layout: false,
});

// Architecture selections
const macArch = ref('arm64');
const linuxArch = ref('x64');

// Checksums - these would ideally be fetched from an API or static file
// For now, show placeholder that indicates they should be verified
const checksums = ref<Record<string, string>>({
  'darwin-arm64': 'Available in GitHub release',
  'darwin-x64': 'Available in GitHub release',
  'linux-x64': 'Available in GitHub release',
  'linux-arm64': 'Available in GitHub release',
});

const getDownloadUrl = (os: string, arch: string) => {
  return `https://github.com/treadiehq/private-connect/releases/latest/download/connect-${os}-${arch}`;
};

// Optionally fetch checksums from GitHub release
onMounted(async () => {
  try {
    // Could fetch from GitHub API or a checksums.txt file
    // For now, using placeholder text
  } catch (e) {
    // Keep placeholder
  }
});
</script>
