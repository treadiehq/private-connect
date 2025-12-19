<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-black">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-10 text-white">
            <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">Welcome back</h1>
        <p class="text-gray-400 text-sm">Log in to your account</p>
      </div>

      <!-- Success Message -->
      <div v-if="success" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto rounded-full bg-blue-300/20 flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold mb-2">Check your email</h2>
          <p class="text-gray-400 mb-4">
            We sent a magic link to <span class="text-white font-medium">{{ email }}</span>.
          </p>
        </div>
      </div>

      <!-- Login Form -->
      <div v-else class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-8 animate-fade-in">
        <form @submit.prevent="handleLogin">
          <div class="mb-5">
            <label class="block text-sm font-medium text-white mb-2">
              Email address
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-colors"
              required
              autofocus
            />
          </div>

          <p v-if="error" class="mb-4 text-sm text-red-400">
            {{ error }}
          </p>

          <button
            type="submit"
            :disabled="loading || !email.trim()"
            class="w-full py-2 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ loading ? 'Sending...' : 'Send magic link' }}</span>
          </button>
        </form>

        <div class="mt-4">
          <p class="text-sm text-slate-400 text-center">
            Don't have an account?
            <NuxtLink to="/register" class="text-blue-300 hover:underline ml-1">
              Sign up
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
});

const { login, user, fetchCurrentUser } = useAuth();
const router = useRouter();

const email = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);

// Redirect if already logged in
onMounted(async () => {
  await fetchCurrentUser();
  if (user.value) {
    router.replace('/');
  }
});

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    await login(email.value.trim());
    success.value = true;
  } catch (e: any) {
    error.value = e.message || 'Failed to send magic link';
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  email.value = '';
  success.value = false;
  error.value = '';
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

