import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const isConnected = ref(false);

export function useSocket() {
  const config = useRuntimeConfig();
  
  const connect = () => {
    if (socket?.connected) return socket;
    
    socket = io(`${config.public.apiUrl}/realtime`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('Connected to realtime server');
      isConnected.value = true;
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from realtime server');
      isConnected.value = false;
    });

    socket.on('reconnect', () => {
      console.log('Reconnected to realtime server');
      isConnected.value = true;
    });

    socket.on('reconnect_attempt', (attempt: number) => {
      console.log(`Reconnection attempt ${attempt}`);
    });

    return socket;
  };

  const disconnect = () => {
    socket?.disconnect();
    socket = null;
    isConnected.value = false;
  };

  const getSocket = () => socket;

  return {
    connect,
    disconnect,
    getSocket,
    isConnected: readonly(isConnected),
  };
}

