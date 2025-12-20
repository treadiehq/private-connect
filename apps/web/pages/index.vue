<template>
  <div class="animate-fade-in">
    <!-- Page Header with Hero styling -->
    <div class="mb-10 flex items-start justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">
          Services
        </h1>
        <p class="text-sm text-gray-400 mt-1">Monitor and manage your exposed services</p>
      </div>
      <button
        @click="showAddModal = true"
        class="inline-flex items-center gap-2 px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-all hover:-translate-y-0.5"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add External Service
      </button>
    </div>

    <!-- Loading State with Skeleton -->
    <ServiceListSkeleton v-if="loading" :count="3" />

    <!-- Empty State -->
    <EmptyState
      v-else-if="services.length === 0"
      title="No services yet"
      description="Expose a local service to make it available through Private Connect."
      :commands="[
        { comment: 'Connect an agent', command: 'connect up' },
        { comment: 'Expose a local service', command: 'connect expose localhost:3000 --name my-api' }
      ]"
    >
      <template #icon>
        <svg class="w-12 h-12 text-blue-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </template>
    </EmptyState>

    <!-- Services Grid with staggered animation -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ServiceCard
        v-for="(service, index) in services"
        :key="service.id"
        :service="service"
        class="animate-slide-up"
        :style="{ animationDelay: `${index * 50}ms` }"
        @check="handleCheck"
      />
    </div>

    <!-- Add External Service Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showAddModal = false"></div>
          <div class="relative bg-black border border-gray-500/20 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 animate-modal-in">
            <h2 class="text-xl font-bold mb-1">Add External Service</h2>
            <p class="text-gray-400 text-sm mb-6">
              Register an external endpoint to track and test connectivity.
            </p>

            <form @submit.prevent="createExternalService">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Service Name</label>
                  <input
                    v-model="externalForm.name"
                    type="text"
                    placeholder="hcp-vault"
                    class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-all placeholder:text-gray-600"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Target Host</label>
                  <input
                    v-model="externalForm.targetHost"
                    type="text"
                    placeholder="vault.hashicorp.cloud"
                    class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-all placeholder:text-gray-600"
                    required
                  />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
                    <input
                      v-model.number="externalForm.targetPort"
                      type="number"
                      placeholder="8200"
                      min="1"
                      max="65535"
                      class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-all placeholder:text-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Protocol</label>
                    <select
                      v-model="externalForm.protocol"
                      class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-all"
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="https">HTTPS</option>
                      <option value="http">HTTP</option>
                      <option value="tcp">TCP</option>
                    </select>
                  </div>
                </div>
              </div>

              <p v-if="createError" class="mt-4 text-sm text-red-400">{{ createError }}</p>

              <div class="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  @click="showAddModal = false"
                  class="px-4 py-2.5 bg-gray-500/10 hover:bg-gray-500/20 text-gray-200 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="creating"
                  class="px-4 py-2.5 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all"
                >
                  {{ creating ? 'Adding...' : 'Add Service' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Service } from '~/types';

useHead({ title: 'Services - Private Connect' })

definePageMeta({
  middleware: 'auth',
});

const { fetchServices, runCheck, createExternalService: apiCreateExternal } = useApi();
const { connect } = useSocket();
const { success, error: showError } = useToast();

const services = ref<Service[]>([]);
const loading = ref(true);
const showAddModal = ref(false);
const creating = ref(false);
const createError = ref('');
const externalForm = ref({
  name: '',
  targetHost: '',
  targetPort: 443,
  protocol: 'auto',
});

// Fetch services on mount
onMounted(async () => {
  try {
    services.value = await fetchServices();
  } catch (error) {
    console.error('Failed to fetch services:', error);
  } finally {
    loading.value = false;
  }

  // Connect to realtime updates
  const socket = connect();
  
  socket?.on('service:update', (updatedService: Service) => {
    const index = services.value.findIndex(s => s.id === updatedService.id);
    if (index >= 0) {
      services.value[index] = updatedService;
    } else {
      services.value.unshift(updatedService);
    }
  });
});

const handleCheck = async (serviceId: string) => {
  try {
    await runCheck(serviceId);
    success('Health check completed');
  } catch (error) {
    console.error('Failed to run check:', error);
    showError('Failed to run health check');
  }
};

const createExternalService = async () => {
  creating.value = true;
  createError.value = '';
  
  try {
    await apiCreateExternal(
      externalForm.value.name,
      externalForm.value.targetHost,
      externalForm.value.targetPort,
      externalForm.value.protocol,
    );
    
    // Refresh services list
    services.value = await fetchServices();
    
    // Reset form and close modal
    externalForm.value = { name: '', targetHost: '', targetPort: 443, protocol: 'auto' };
    showAddModal.value = false;
    success('External service added');
  } catch (error: any) {
    createError.value = error.message || 'Failed to create external service';
  } finally {
    creating.value = false;
  }
};
</script>

<style scoped>
.modal-enter-active {
  animation: modal-in 0.2s ease-out;
}

.modal-leave-active {
  animation: modal-out 0.15s ease-in;
}

@keyframes modal-in {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes modal-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

.animate-modal-in {
  animation: modal-in 0.2s ease-out;
}
</style>
