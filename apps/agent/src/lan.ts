import * as os from 'os';

const DEFAULT_LAN_HOSTNAME = 'connect.local';

/**
 * Find the first non-internal IPv4 address (typically the Wi-Fi/Ethernet LAN IP).
 */
export function getLanIP(): string | null {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const iface of entries || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

export function getLanHostname(): string {
  return DEFAULT_LAN_HOSTNAME;
}

export interface MdnsResponder {
  stop: () => void;
}

/**
 * Start an mDNS responder that answers A-record queries for the given hostname
 * and any subdomain of it (e.g. api.connect.local) with the provided IP.
 */
export function startMdnsResponder(hostname: string, ip: string): MdnsResponder {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mdns = require('multicast-dns');
  const responder = mdns();
  const lower = hostname.toLowerCase();
  const suffix = `.${lower}`;

  responder.on('query', (query: { questions: Array<{ type: string; name: string }> }) => {
    const answers: Array<{ name: string; type: string; ttl: number; data: string }> = [];
    for (const q of query.questions) {
      if (q.type === 'A') {
        const name = q.name.toLowerCase();
        if (name === lower || name.endsWith(suffix)) {
          answers.push({ name: q.name, type: 'A', ttl: 120, data: ip });
        }
      }
    }
    if (answers.length > 0) {
      responder.respond({ answers });
    }
  });

  return {
    stop: () => { try { responder.destroy(); } catch { /* best-effort */ } },
  };
}
