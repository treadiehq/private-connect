<template>
  <div class="h-full flex flex-col bg-black">
    <!-- Header -->
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
      <span class="text-sm text-gray-400 flex items-center gap-2">
        <span v-if="connected" class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
          <span class="text-emerald-300 text-xs">Connected</span>
        </span>
        <span v-else-if="connecting" class="flex items-center gap-1.5">
          <svg class="animate-spin h-3 w-3 text-amber-300" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span class="text-amber-300 text-xs">Connecting...</span>
        </span>
        <span v-else class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
          <span class="text-gray-500 text-xs">Disconnected</span>
        </span>
        <span v-if="isShared && participants > 0" class="inline-flex items-center gap-1 bg-blue-300/10 text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
          </svg>
          {{ participants }}
        </span>
      </span>
      <button
        v-if="connected"
        type="button"
        @click="doDisconnect"
        class="text-sm text-gray-400 hover:text-white transition-colors border border-gray-500/10 bg-gray-500/10 rounded-lg px-2 py-1"
      >
        Disconnect
      </button>
    </div>

    <!-- Error -->
    <div v-if="authError" class="px-4 py-3 bg-red-400/10 border-b border-red-400/20">
      <p class="text-sm text-red-400">{{ authError }}</p>
    </div>

    <!-- Terminal body -->
    <div ref="terminalEl" class="flex-1 min-h-0 p-2 pt-0" />
  </div>
</template>

<script setup lang="ts">
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

const props = defineProps<{
  code?: string;
  token?: string;
  shared?: boolean;
}>();

const emit = defineEmits<{
  (e: 'connected'): void;
  (e: 'disconnected'): void;
  (e: 'error', message: string): void;
}>();

const config = useRuntimeConfig();
const connecting = ref(false);
const connected = ref(false);
const isShared = ref(false);
const participants = ref(0);
const authError = ref('');
const connectionId = ref('');
const socket = ref<Socket | null>(null);
const terminalEl = ref<HTMLElement | null>(null);

let term: any = null;
let fitAddon: any = null;
let resizeHandler: (() => void) | null = null;
let pendingOutput = '';

function writeTerminal(data: string) {
  if (term) {
    term.write(data);
    return;
  }
  pendingOutput += data;
}

function doConnect() {
  authError.value = '';
  connecting.value = true;
  const apiUrl = config.public.apiUrl as string;
  socket.value = io(`${apiUrl}/shell`, {
    transports: ['websocket'],
    reconnection: false,
  });

  socket.value.on('connect', () => {
    const authPayload: Record<string, any> = {};
    if (props.token) {
      authPayload.token = props.token;
    } else if (props.code) {
      authPayload.code = props.code.trim().toLowerCase();
      if (props.shared) authPayload.shared = true;
    }
    socket.value?.emit('auth', authPayload);
  });

  socket.value.on('reach_ready', () => {
    writeTerminal('\r\nConnected via Private Connect\r\n');
  });
  socket.value.on('reach_data', (payload: { connectionId: string; data: string }) => {
    if (payload.connectionId !== connectionId.value) return;
    try {
      const decoded = typeof atob !== 'undefined'
        ? decodeURIComponent(escape(atob(payload.data)))
        : Buffer.from(payload.data, 'base64').toString('utf8');
      writeTerminal(decoded);
    } catch {
      writeTerminal('[decode error]');
    }
  });
  socket.value.on('reach_error', (payload: { connectionId: string; error?: string }) => {
    if (payload.connectionId !== connectionId.value) return;
    writeTerminal(`\r\n[Error: ${payload.error || 'Unknown'}]\r\n`);
  });
  socket.value.on('reach_close', (payload: { connectionId: string }) => {
    if (payload.connectionId !== connectionId.value) return;
    writeTerminal('\r\n[Connection closed by host]\r\n');
  });

  socket.value.on('session_participants', (data: { count: number }) => {
    participants.value = data.count;
  });

  socket.value.on('auth_ok', (data: { connectionId: string; shared?: boolean }) => {
    connectionId.value = data.connectionId;
    isShared.value = data.shared === true;
    connecting.value = false;
    connected.value = true;
    emit('connected');

    nextTick(() => initTerminal());
  });

  socket.value.on('auth_error', (data: { message?: string }) => {
    const msg = data?.message || 'Authentication failed';
    authError.value = msg;
    connecting.value = false;
    emit('error', msg);
    socket.value?.disconnect();
    socket.value = null;
  });

  socket.value.on('disconnect', () => {
    connecting.value = false;
    if (!connected.value) return;
    connected.value = false;
    socket.value = null;
    connectionId.value = '';
    emit('disconnected');
    if (term) {
      term.write('\r\n\r\n[Disconnected]\r\n');
    }
  });

  socket.value.on('connect_error', () => {
    authError.value = 'Could not reach server. Check the URL and try again.';
    connecting.value = false;
    emit('error', authError.value);
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
      if (pendingOutput) {
        term.write(pendingOutput);
        pendingOutput = '';
      }

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

function doDisconnect() {
  if (socket.value && connectionId.value) {
    socket.value.emit('reach_close', { connectionId: connectionId.value });
  }
  socket.value?.disconnect();
  socket.value = null;
  connected.value = false;
  connectionId.value = '';
  emit('disconnected');
}

onMounted(() => {
  if (props.code || props.token) {
    doConnect();
  }
});

onBeforeUnmount(() => {
  if (socket.value && connectionId.value) {
    socket.value.emit('reach_close', { connectionId: connectionId.value });
  }
  socket.value?.disconnect();
  socket.value = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
});

defineExpose({ connect: doConnect, disconnect: doDisconnect });
</script>
