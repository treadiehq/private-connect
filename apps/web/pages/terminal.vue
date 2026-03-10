<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
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
        <form @submit.prevent="connect" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-6">
          <label class="block text-sm font-medium text-gray-300 mb-2">Share code</label>
          <input
            v-model="code"
            type="text"
            placeholder="e.g. abc123"
            class="w-full px-4 py-3 bg-gray-500/10 border border-gray-500/20 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none text-white placeholder-gray-500"
            :disabled="connecting"
            autocomplete="off"
          />
          <p v-if="authError" class="mt-3 text-sm text-red-400">{{ authError }}</p>
          <button
            type="submit"
            :disabled="connecting || !code.trim()"
            class="mt-4 w-full py-3 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg v-if="connecting" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>{{ connecting ? 'Connecting...' : 'Connect' }}</span>
          </button>
        </form>
        <p class="mt-4 text-center text-xs text-gray-500">
          <NuxtLink to="/" class="text-blue-300 hover:text-blue-400">Back to Private Connect</NuxtLink>
        </p>
      </div>
    </div>

    <!-- Terminal (when connected) -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <div class="flex items-center justify-between px-4 py-2 bg-gray-500/5 border-b border-gray-500/10 shrink-0">
        <span class="text-sm text-gray-400 flex items-center gap-2">
          <span>Powered by </span>
          <a href="/" target="_blank" class="text-blue-300 hover:text-blue-400 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            <span>Private Connect</span>
          </a>
        </span>
        <span class="text-sm text-gray-400">Connected to shell via share code: {{ code }}</span>
        <button
          type="button"
          @click="disconnect"
          class="text-sm text-gray-400 hover:text-white transition-colors border border-gray-500/10 bg-gray-500/10 rounded-lg px-2 py-1"
        >
          Disconnect
        </button>
      </div>
      <div ref="terminalEl" class="flex-1 min-h-0 p-2 pt-0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

definePageMeta({ layout: false });

const config = useRuntimeConfig();
const code = ref('');
const connecting = ref(false);
const connected = ref(false);
const authError = ref('');
const connectionId = ref('');
const socket = ref<Socket | null>(null);
const terminalEl = ref<HTMLElement | null>(null);

let term: any = null;
let fitAddon: any = null;
let resizeHandler: (() => void) | null = null;

function connect() {
  authError.value = '';
  connecting.value = true;
  const apiUrl = config.public.apiUrl as string;
  socket.value = io(`${apiUrl}/shell`, {
    transports: ['websocket'],
    reconnection: false,
  });

  socket.value.on('connect', () => {
    socket.value?.emit('auth', { code: code.value.trim().toLowerCase() });
  });

  socket.value.on('auth_ok', (data: { connectionId: string }) => {
    connectionId.value = data.connectionId;
    connecting.value = false;
    connected.value = true;

    socket.value?.on('reach_ready', () => {
      if (term) term.write('\r\n[Shell ready]\r\n');
    });
    socket.value?.on('reach_data', (payload: { connectionId: string; data: string }) => {
      if (payload.connectionId !== connectionId.value) return;
      if (!term) return;
      try {
        const decoded = typeof atob !== 'undefined'
          ? decodeURIComponent(escape(atob(payload.data)))
          : Buffer.from(payload.data, 'base64').toString('utf8');
        term.write(decoded);
      } catch {
        term.write('[decode error]');
      }
    });
    socket.value?.on('reach_error', (payload: { connectionId: string; error?: string }) => {
      if (payload.connectionId !== connectionId.value) return;
      if (term) term.write(`\r\n[Error: ${payload.error || 'Unknown'}]\r\n`);
    });
    socket.value?.on('reach_close', (payload: { connectionId: string }) => {
      if (payload.connectionId !== connectionId.value) return;
      if (term) term.write('\r\n[Connection closed by host]\r\n');
    });

    nextTick(() => initTerminal());
  });

  socket.value.on('auth_error', (data: { message?: string }) => {
    authError.value = data?.message || 'Invalid share code';
    connecting.value = false;
    socket.value?.disconnect();
    socket.value = null;
  });

  socket.value.on('disconnect', () => {
    connecting.value = false;
    if (!connected.value) return;
    connected.value = false;
    socket.value = null;
    connectionId.value = '';
    if (term) {
      term.write('\r\n\r\n[Disconnected]\r\n');
    }
  });

  socket.value.on('connect_error', () => {
    authError.value = 'Could not reach server. Check the URL and try again.';
    connecting.value = false;
  });
}

function initTerminal() {
  if (!terminalEl.value || term) return;

  import('xterm').then(({ Terminal }) => {
    import('xterm-addon-fit').then(({ FitAddon }) => {
      term = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#0a0a0a',
          foreground: '#e5e5e5',
          cursor: '#e5e5e5',
        },
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 14,
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalEl.value);
      fitAddon.fit();

      term.onData((data: string) => {
        if (socket.value && connectionId.value) {
          const base64 = typeof btoa !== 'undefined'
            ? btoa(unescape(encodeURIComponent(data)))
            : Buffer.from(data, 'utf8').toString('base64');
          socket.value.emit('reach_data', { connectionId: connectionId.value, data: base64 });
        }
      });

      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (socket.value && connectionId.value) {
          socket.value.emit('resize', { connectionId: connectionId.value, cols, rows });
        }
      });

      resizeHandler = () => fitAddon?.fit();
      window.addEventListener('resize', resizeHandler);
    });
  });
}

function disconnect() {
  if (socket.value && connectionId.value) {
    socket.value.emit('reach_close', { connectionId: connectionId.value });
  }
  socket.value?.disconnect();
  socket.value = null;
  connected.value = false;
  connectionId.value = '';
}

onBeforeUnmount(() => {
  if (socket.value && connectionId.value) {
    socket.value.emit('reach_close', { connectionId: connectionId.value });
  }
  socket.value?.disconnect();
  socket.value = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
});
</script>
