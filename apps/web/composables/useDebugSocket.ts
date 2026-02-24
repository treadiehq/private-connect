import { io, Socket } from 'socket.io-client';

export interface DebugPacket {
  id: string;
  sequence: number;
  direction: 'inbound' | 'outbound';
  protocol: string;
  payloadSize: number;
  parsed?: any;
  connectionId?: string;
  capturedAt: string;
  payload?: string; // Base64 encoded, only for small packets
}

export interface DebugViewer {
  name: string;
  joinedAt: string;
}

export interface DebugSession {
  id: string;
  status: string;
  aiEnabled: boolean;
  packetCount: number;
  viewers?: DebugViewer[];
  viewerCount?: number;
}

export function useDebugSocket() {
  const config = useRuntimeConfig();
  
  const socket = ref<Socket | null>(null);
  const isConnected = ref(false);
  const session = ref<DebugSession | null>(null);
  const packets = ref<DebugPacket[]>([]);
  const error = ref<string | null>(null);
  const viewers = ref<DebugViewer[]>([]);
  const viewerCount = ref(0);

  const connect = (token: string, viewerName?: string) => {
    if (socket.value?.connected) {
      socket.value.disconnect();
    }

    const wsUrl = config.public.apiUrl;
    socket.value = io(`${wsUrl}/debug`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.value.on('connect', () => {
      console.log('Connected to debug server');
      isConnected.value = true;
      error.value = null;
      
      // Subscribe to the session with optional viewer name
      socket.value?.emit('subscribe', { token, name: viewerName }, (response: { success: boolean; error?: string; sessionId?: string }) => {
        if (!response.success) {
          error.value = response.error || 'Failed to subscribe';
        }
      });
    });

    socket.value.on('disconnect', () => {
      console.log('Disconnected from debug server');
      isConnected.value = false;
    });

    socket.value.on('session', (data: DebugSession) => {
      session.value = data;
      if (data.viewers) {
        viewers.value = data.viewers;
      }
      if (data.viewerCount !== undefined) {
        viewerCount.value = data.viewerCount;
      }
    });

    socket.value.on('viewer_joined', (data: { name: string; viewerCount: number; viewers: DebugViewer[] }) => {
      console.log(`${data.name} joined the session`);
      viewers.value = data.viewers;
      viewerCount.value = data.viewerCount;
    });

    socket.value.on('viewer_left', (data: { name: string; viewerCount: number }) => {
      console.log(`${data.name} left the session`);
      viewerCount.value = data.viewerCount;
      viewers.value = viewers.value.filter(v => v.name !== data.name);
    });

    socket.value.on('packet', (packet: DebugPacket) => {
      // Add to beginning (newest first)
      packets.value.unshift(packet);
      // Limit to 1000 packets in memory
      if (packets.value.length > 1000) {
        packets.value = packets.value.slice(0, 1000);
      }
    });

    socket.value.on('error', (data: { message: string }) => {
      error.value = data.message;
    });

    socket.value.on('reconnect', () => {
      console.log('Reconnected to debug server');
      isConnected.value = true;
    });

    return socket.value;
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.emit('unsubscribe');
      socket.value.disconnect();
      socket.value = null;
    }
    isConnected.value = false;
    session.value = null;
    packets.value = [];
  };

  const requestHistory = async (limit = 50, before?: string): Promise<DebugPacket[]> => {
    return new Promise((resolve) => {
      if (!socket.value) {
        resolve([]);
        return;
      }
      
      socket.value.emit('history', { limit, before }, (response: { success: boolean; packets?: DebugPacket[] }) => {
        if (response.success && response.packets) {
          // Add to end (older packets)
          packets.value.push(...response.packets);
          resolve(response.packets);
        } else {
          resolve([]);
        }
      });
    });
  };

  const requestPacketDetails = async (packetId: string): Promise<any> => {
    return new Promise((resolve) => {
      if (!socket.value) {
        resolve(null);
        return;
      }
      
      socket.value.emit('packet_details', { packetId }, (response: { success: boolean; packet?: any }) => {
        if (response.success && response.packet) {
          resolve(response.packet);
        } else {
          resolve(null);
        }
      });
    });
  };

  const clearPackets = () => {
    packets.value = [];
  };

  // Auto-cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    connect,
    disconnect,
    requestHistory,
    requestPacketDetails,
    clearPackets,
    isConnected: readonly(isConnected),
    session: readonly(session),
    packets: readonly(packets),
    error: readonly(error),
    viewers: readonly(viewers),
    viewerCount: readonly(viewerCount),
  };
}
