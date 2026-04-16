import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

const BEGIN_MARKER = '# BEGIN private-connect';
const END_MARKER = '# END private-connect';
const HOSTS_PATH = '/etc/hosts';

/** Leading UTF-8 BOM breaks `^`-anchored line regexes (position 0 is U+FEFF, not `#`). */
export function stripLeadingUtf8Bom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

interface HostEntry {
  hostname: string;
  ip: string;
}

interface HostsOptions {
  interactive?: boolean;
}

function removeExistingBlock(content: string): string {
  const beginRe = new RegExp(`^${escapeRegExp(BEGIN_MARKER)}$`, 'm');
  const endRe = new RegExp(`^${escapeRegExp(END_MARKER)}$`, 'm');

  const startMatch = beginRe.exec(content);
  if (!startMatch) return content;
  const endMatch = endRe.exec(content.slice(startMatch.index));
  if (!endMatch) return content;

  let startPos = startMatch.index;
  let endPos = startMatch.index + endMatch.index + endMatch[0].length;
  if (content[endPos] === '\n') endPos++;
  if (startPos > 0 && content[startPos - 1] === '\n') startPos--;

  return content.substring(0, startPos) + content.substring(endPos);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const current = stripLeadingUtf8Bom(fs.readFileSync(HOSTS_PATH, 'utf-8'));
    const cleaned = removeExistingBlock(current);

    const sanitized = entries.filter(e =>
      !e.hostname.includes('\n') && !e.hostname.includes('\r') &&
      !e.ip.includes('\n') && !e.ip.includes('\r')
    );
    if (sanitized.length === 0) return { synced: true };

    const lines = sanitized.map(e => `${e.ip} ${e.hostname}`);
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
    const current = stripLeadingUtf8Bom(fs.readFileSync(HOSTS_PATH, 'utf-8'));
    if (!new RegExp(`^${escapeRegExp(BEGIN_MARKER)}$`, 'm').test(current)) {
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
