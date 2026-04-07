import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

const BEGIN_MARKER = '# BEGIN private-connect';
const END_MARKER = '# END private-connect';
const HOSTS_PATH = '/etc/hosts';

interface HostEntry {
  hostname: string;
  ip: string;
}

interface HostsOptions {
  interactive?: boolean;
}

function removeExistingBlock(content: string): string {
  const start = content.indexOf(BEGIN_MARKER);
  if (start === -1) return content;
  const end = content.indexOf(END_MARKER, start);
  if (end === -1) return content;

  let endPos = end + END_MARKER.length;
  if (content[endPos] === '\n') endPos++;

  let startPos = start;
  if (startPos > 0 && content[startPos - 1] === '\n') startPos--;

  return content.substring(0, startPos) + content.substring(endPos);
}

function writeWithSudo(content: string, options?: HostsOptions): boolean {
  const tmpFile = `/tmp/private-connect-hosts-${process.pid}`;
  try {
    fs.writeFileSync(tmpFile, content, { mode: 0o644 });
    const sudoFlag = options?.interactive ? '' : '-n ';
    execSync(`sudo ${sudoFlag}cp "${tmpFile}" "${HOSTS_PATH}"`, {
      stdio: options?.interactive ? 'inherit' : 'pipe',
      timeout: options?.interactive ? 30000 : 5000,
    });
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* best-effort */ }
  }
}

/**
 * Write proxy route entries to /etc/hosts so Safari and other resolvers
 * that don't handle .localhost subdomains can reach the proxy.
 */
export function syncHosts(
  entries: HostEntry[],
  options?: HostsOptions,
): { synced: boolean; error?: string } {
  if (os.platform() === 'win32') {
    return { synced: false, error: 'Windows hosts sync not supported' };
  }
  if (entries.length === 0) return { synced: true };

  try {
    const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
    const cleaned = removeExistingBlock(current);

    const lines = entries.map(e => `${e.ip} ${e.hostname}`);
    const block = `${BEGIN_MARKER}\n${lines.join('\n')}\n${END_MARKER}`;
    const newContent = cleaned.trimEnd() + '\n\n' + block + '\n';

    if (writeWithSudo(newContent, options)) {
      return { synced: true };
    }
    return { synced: false, error: 'sudo required — run: connect hosts sync' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { synced: false, error: msg };
  }
}

/**
 * Remove the private-connect block from /etc/hosts.
 */
export function cleanHosts(
  options?: HostsOptions,
): { cleaned: boolean; error?: string } {
  if (os.platform() === 'win32') {
    return { cleaned: false, error: 'Windows hosts sync not supported' };
  }

  try {
    const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
    if (!current.includes(BEGIN_MARKER)) {
      return { cleaned: true };
    }

    const newContent = removeExistingBlock(current).trimEnd() + '\n';

    if (writeWithSudo(newContent, options)) {
      return { cleaned: true };
    }
    return { cleaned: false, error: 'sudo required — run: connect hosts clean' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { cleaned: false, error: msg };
  }
}
