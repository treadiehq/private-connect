<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-black relative">
    <div class="radial-gradient absolute top-0 md:right-14 right-5"></div>
    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-10 text-white">
            <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 0 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">Verify your email</h1>
        <p class="text-gray-400 text-sm">Check your email for a verification link</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 mx-auto text-blue-300 mb-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-400">Verifying your link...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto rounded-full bg-red-400/10 flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold mb-2 text-red-400">Verification failed</h2>
          <p class="text-gray-400 mb-6">{{ error }}</p>
          
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-500/10 hover:bg-gray-500/15 rounded-lg transition-colors text-sm"
          >
            <span>Try signing in again</span>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </NuxtLink>
        </div>
      </div>

      <!-- New User: Show API Key -->
      <div v-else-if="showApiKey" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-10 text-white">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold mb-2">Welcome to Private Connect!</h2>
          <!-- <p class="text-gray-400 text-sm">Save your API key. You'll need it to connect agents.</p> -->
        </div>

        <!-- API Key Display -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-400 mb-2">
            Your API Key
          </label>
          <div class="relative">
            <input
              :type="showKey ? 'text' : 'password'"
              :value="apiKey"
              readonly
              class="w-full px-3 py-2 pr-24 bg-black border border-gray-500/10 rounded-lg font-mono text-sm"
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                @click="showKey = !showKey"
                class="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                :title="showKey ? 'Hide' : 'Show'"
              >
                <svg v-if="showKey" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                @click="copyApiKey"
                class="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                title="Copy"
              >
                <svg v-if="copied" class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>
          <p class="mt-2 text-xs text-amber-300">
            Save this key now. It won't be shown again!
          </p>
        </div>

        <!-- CLI Command -->
        <div class="mb-6 p-4 bg-black border border-gray-500/10 rounded-lg">
          <p class="text-xs text-gray-500 mb-2">Connect your first agent:</p>
          <code class="text-sm text-blue-300 break-all">
            connect up --api-key {{ apiKey }}
          </code>
        </div>

        <button
          @click="goToDashboard"
          class="w-full py-2 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-lg transition-colors"
        >
          Continue to Dashboard →
        </button>
      </div>

      <!-- Returning User: Quick redirect -->
      <div v-else-if="success" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto rounded-full bg-blue-300/20 flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold mb-2">You're signed in!</h2>
          <p class="text-gray-400 text-sm mb-6">Redirecting to your dashboard...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Verify Email - Private Connect' })

definePageMeta({
  layout: false,
});

const { verifyMagicLink } = useAuth();
const router = useRouter();
const route = useRoute();

const loading = ref(true);
const error = ref('');
const success = ref(false);
const showApiKey = ref(false);
const apiKey = ref('');
const showKey = ref(false);
const copied = ref(false);

onMounted(async () => {
  const token = route.query.token as string;
  
  if (!token) {
    error.value = 'No verification token provided';
    loading.value = false;
    return;
  }

  try {
    const result = await verifyMagicLink(token);
    
    if (result.isNewUser && result.workspace?.apiKey) {
      // New user: show API key screen
      apiKey.value = result.workspace.apiKey;
      showApiKey.value = true;
    } else {
      // Returning user: redirect to dashboard
      success.value = true;
      setTimeout(() => {
        router.push('/services');
      }, 1500);
    }
  } catch (e: any) {
    error.value = e.message || 'Invalid or expired link';
  } finally {
    loading.value = false;
  }
});

const copyApiKey = async () => {
  await navigator.clipboard.writeText(apiKey.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const goToDashboard = () => {
  router.push('/services');
};
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
