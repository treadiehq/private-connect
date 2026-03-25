import * as net from 'net';
import { isPortAvailable, findAvailablePort, getAutoPort } from '../ports';

// ─────────────────────────────────────────────────────────────────────────────
// Direct TCP forwarder — binds a localhost port and pipes to a remote target
// ─────────────────────────────────────────────────────────────────────────────

export interface ForwarderHandle {
  server: net.Server;
  localPort: number;
  close: () => Promise<void>;
}

/**
 * Create a direct TCP forwarder that listens on localhost and forwards
 * all connections to targetHost:targetPort.
 */
export async function createDirectForwarder(
  targetHost: string,
  targetPort: number,
  preferredLocalPort?: number,
): Promise<ForwarderHandle> {
  let localPort: number;

  if (preferredLocalPort) {
    const available = await isPortAvailable(preferredLocalPort);
    if (!available) {
      const alt = await findAvailablePort(preferredLocalPort + 1);
      if (!alt) throw new Error(`No available port near ${preferredLocalPort}`);
      localPort = alt;
    } else {
      localPort = preferredLocalPort;
    }
  } else {
    localPort = await getAutoPort();
  }

  const connections = new Set<net.Socket>();

  const server = net.createServer((clientSocket) => {
    const remoteSocket = net.createConnection({
      host: targetHost,
      port: targetPort,
    });

    connections.add(clientSocket);
    connections.add(remoteSocket);

    remoteSocket.on('connect', () => {
      clientSocket.pipe(remoteSocket);
      remoteSocket.pipe(clientSocket);
    });

    remoteSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => remoteSocket.destroy());

    const cleanup = () => {
      connections.delete(clientSocket);
      connections.delete(remoteSocket);
    };
    remoteSocket.on('close', cleanup);
    clientSocket.on('close', cleanup);
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(localPort, '127.0.0.1', () => resolve());
  });

  return {
    server,
    localPort,
    close: () => new Promise<void>((resolve) => {
      for (const socket of connections) {
        socket.destroy();
      }
      connections.clear();
      server.close(() => resolve());
    }),
  };
}
