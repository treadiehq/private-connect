import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket() {
  const config = useRuntimeConfig();
  
  const connect = () => {
    if (socket?.connected) return socket;
    
    socket = io(`${config.public.apiUrl}/realtime`, {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('Connected to realtime server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from realtime server');
    });

    return socket;
  };

  const disconnect = () => {
    socket?.disconnect();
    socket = null;
  };

  const getSocket = () => socket;

  return {
    connect,
    disconnect,
    getSocket,
  };
}

