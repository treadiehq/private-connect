<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold tracking-tight mb-2">
          <span class="text-blue-300">Private</span>Connect
        </h1>
        <p class="text-gray-400">Authorize your device</p>
      </div>

      <!-- Not Authenticated -->
      <div v-if="!user" class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-300/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold mb-2">Sign in to continue</h2>
        <p class="text-gray-400 mb-6 text-sm">
          You need to be signed in to authorize this device.
        </p>
        <NuxtLink
          to="/login"
          class="inline-block px-6 py-3 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-lg transition-colors"
        >
          Sign In
        </NuxtLink>
      </div>

      <!-- Authenticated - Enter Code -->
      <div v-else-if="!verified" class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-300/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold mb-2">Enter device code</h2>
          <p class="text-gray-400 text-sm">
            Enter the code shown on your terminal.
          </p>
        </div>

        <form @submit.prevent="verifyCode">
          <div class="mb-6">
            <input
              v-model="userCode"
              type="text"
              placeholder="XXXX-XXXX"
              maxlength="9"
              class="w-full px-3 py-2 text-center text-2xl font-mono tracking-widest bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-colors uppercase"
              :class="{ 'border-red-500': error }"
              @input="formatCode"
              autofocus
            />
          </div>

          <p v-if="error" class="mb-4 text-center text-sm text-red-400">{{ error }}</p>

          <button
            type="submit"
            :disabled="verifying || userCode.length < 9"
            class="w-full py-2 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
          >
            {{ verifying ? 'Authorizing...' : 'Authorize Device' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-gray-500">
          Signed in as {{ user.email }}
        </p>
      </div>

      <!-- Success -->
      <div v-else class="bg-gray-500/10 border border-gray-500/10 rounded-xl p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-green-300/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold mb-2">Device Authorized!</h2>
        <p class="text-gray-400 mb-6 text-sm">
          You can now close this window and return to your terminal.
        </p>
        <p class="text-sm text-gray-500">
          The CLI will automatically continue.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

useHead({ title: 'Authorize Device - Private Connect' })

const config = useRuntimeConfig();
const user = ref<{ id: string; email: string } | null>(null);
const workspace = ref<{ id: string; name: string } | null>(null);
const userCode = ref('');
const verifying = ref(false);
const verified = ref(false);
const error = ref('');

// Check auth status
onMounted(async () => {
  try {
    const response = await fetch(`${config.public.apiUrl}/v1/auth/me`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      user.value = data.user;
      workspace.value = data.workspace;
    }
  } catch {
    // Not authenticated
  }

  // Pre-fill code from URL if provided
  const route = useRoute();
  if (route.query.code) {
    userCode.value = String(route.query.code).toUpperCase();
  }
});

const formatCode = (e: Event) => {
  const input = e.target as HTMLInputElement;
  let value = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // Insert dash after 4 characters
  if (value.length > 4) {
    value = value.slice(0, 4) + '-' + value.slice(4, 8);
  }
  
  userCode.value = value;
};

const verifyCode = async () => {
  if (userCode.value.length < 9) return;
  
  verifying.value = true;
  error.value = '';

  try {
    const response = await fetch(
      `${config.public.apiUrl}/v1/device/verify?user_id=${user.value?.id}&workspace_id=${workspace.value?.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userCode: userCode.value }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      error.value = data.message || data.error || 'Verification failed';
      return;
    }

    verified.value = true;
  } catch (err) {
    error.value = 'Failed to verify. Please try again.';
  } finally {
    verifying.value = false;
  }
};
</script>

