import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { Action } from './policy';

/**
 * Agent Permission Broker - Audit Logger
 *
 * Maintains an append-only log of all agent actions for security and debugging.
 * Stored in JSONL format for easy parsing and streaming.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  ts: string;              // ISO timestamp
  agent?: string;          // Agent identifier (if known)
  type: 'file' | 'command' | 'git';
  action: Action;          // allow | block | review
  target: string;          // File path, command, or git operation
  rule?: string;           // Matching rule pattern
  reason?: string;         // Reason for decision
  userApproved?: boolean;  // For 'review' actions, did user approve?
  workingDir?: string;     // Working directory
  pid?: number;            // Process ID
}

export interface AuditStats {
  total: number;
  allowed: number;
  blocked: number;
  reviewed: number;
  byType: Record<string, number>;
}

export interface FormatOptions {
  color?: boolean;  // Use ANSI colors (auto-detected if not specified)
  maxTargetLength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_DIR = path.join(os.homedir(), '.connect');
const AUDIT_FILE = 'audit.jsonl';
const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB max file size before rotation
const ROTATE_KEEP_SIZE = 1 * 1024 * 1024;  // Keep ~1MB of recent entries after rotation

// Restrictive file permissions
const AUDIT_FILE_MODE = 0o600;
const AUDIT_DIR_MODE = 0o700;

// Lock file for atomic writes
const LOCK_FILE = '.audit.lock';
const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// File Paths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the path to the audit log
 */
export function getAuditPath(): string {
  return path.join(AUDIT_DIR, AUDIT_FILE);
}

/**
 * Get the path to the lock file
 */
function getLockPath(): string {
  return path.join(AUDIT_DIR, LOCK_FILE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Directory & Permission Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure the audit directory exists with secure permissions
 */
function ensureAuditDir(): void {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true, mode: AUDIT_DIR_MODE });
  }
  // Ensure permissions even if directory already existed
  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(AUDIT_DIR, AUDIT_DIR_MODE);
    }
  } catch {
    // Ignore permission errors
  }
}

/**
 * Set secure permissions on a file
 */
function setSecurePermissions(filePath: string): void {
  try {
    if (process.platform !== 'win32' && fs.existsSync(filePath)) {
      fs.chmodSync(filePath, AUDIT_FILE_MODE);
    }
  } catch {
    // Ignore permission errors
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File Locking (Simple Advisory Lock)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acquire a lock for atomic operations
 */
async function acquireLock(): Promise<boolean> {
  const lockPath = getLockPath();
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      // O_EXCL ensures atomic create-if-not-exists
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return true;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EEXIST') {
        // Lock exists, check if holder is still alive
        try {
          const pidStr = fs.readFileSync(lockPath, 'utf-8').trim();
          const pid = parseInt(pidStr, 10);
          if (pid && pid !== process.pid) {
            try {
              process.kill(pid, 0); // Check if process exists
            } catch {
              // Process is dead, remove stale lock
              try {
                fs.unlinkSync(lockPath);
                continue;
              } catch {
                // Someone else removed it
              }
            }
          }
        } catch {
          // Can't read lock file, wait and retry
        }
        await sleep(LOCK_RETRY_MS);
        continue;
      }
      // Other error
      return false;
    }
  }
  return false;
}

/**
 * Release the lock
 */
function releaseLock(): void {
  try {
    fs.unlinkSync(getLockPath());
  } catch {
    // Ignore errors
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an object is a valid AuditEntry
 */
function validateAuditEntry(data: unknown): AuditEntry | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // Required fields
  if (typeof obj.ts !== 'string') return null;
  if (!['file', 'command', 'git'].includes(obj.type as string)) return null;
  if (!['allow', 'block', 'review'].includes(obj.action as string)) return null;
  if (typeof obj.target !== 'string') return null;

  // Validate timestamp format
  const date = new Date(obj.ts);
  if (isNaN(date.getTime())) return null;

  return {
    ts: obj.ts,
    type: obj.type as 'file' | 'command' | 'git',
    action: obj.action as Action,
    target: obj.target,
    agent: typeof obj.agent === 'string' ? obj.agent : undefined,
    rule: typeof obj.rule === 'string' ? obj.rule : undefined,
    reason: typeof obj.reason === 'string' ? obj.reason : undefined,
    userApproved: typeof obj.userApproved === 'boolean' ? obj.userApproved : undefined,
    workingDir: typeof obj.workingDir === 'string' ? obj.workingDir : undefined,
    pid: typeof obj.pid === 'number' ? obj.pid : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log an audit entry with atomic write
 */
export async function logAudit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  ensureAuditDir();

  const fullEntry: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  const auditPath = getAuditPath();
  const line = JSON.stringify(fullEntry) + '\n';

  // Acquire lock for atomic write
  const locked = await acquireLock();

  try {
    // Append the entry
    fs.appendFileSync(auditPath, line, { mode: AUDIT_FILE_MODE });
    setSecurePermissions(auditPath);

    // Check if we need to rotate (while we hold the lock)
    try {
      const stats = fs.statSync(auditPath);
      if (stats.size > MAX_FILE_SIZE) {
        await rotateAuditLogStreaming();
      }
    } catch {
      // Stat failed, skip rotation check
    }
  } catch (error) {
    // Log but don't break agent operation
    console.error('Warning: Failed to write audit log:', error);
  } finally {
    if (locked) {
      releaseLock();
    }
  }
}

/**
 * Synchronous version of logAudit for compatibility
 */
export function logAuditSync(entry: Omit<AuditEntry, 'ts'>): void {
  ensureAuditDir();

  const fullEntry: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  const auditPath = getAuditPath();
  const line = JSON.stringify(fullEntry) + '\n';

  try {
    fs.appendFileSync(auditPath, line, { mode: AUDIT_FILE_MODE });
    setSecurePermissions(auditPath);
  } catch (error) {
    console.error('Warning: Failed to write audit log:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation (Streaming - Memory Efficient)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rotate the audit log using streaming (memory efficient)
 * Keeps approximately ROTATE_KEEP_SIZE of recent entries
 */
async function rotateAuditLogStreaming(): Promise<void> {
  const auditPath = getAuditPath();
  const archivePath = path.join(AUDIT_DIR, `audit.${Date.now()}.jsonl`);
  const tempPath = path.join(AUDIT_DIR, `audit.tmp.${process.pid}.jsonl`);

  try {
    const stats = fs.statSync(auditPath);
    const skipBytes = Math.max(0, stats.size - ROTATE_KEEP_SIZE);

    // Stream through the file, keeping only recent entries
    const recentLines: string[] = [];
    let currentOffset = 0;

    const fileStream = fs.createReadStream(auditPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const archiveStream = fs.createWriteStream(archivePath, { mode: AUDIT_FILE_MODE });

    for await (const line of rl) {
      const lineLength = Buffer.byteLength(line, 'utf-8') + 1; // +1 for newline

      if (currentOffset < skipBytes) {
        // Write to archive
        archiveStream.write(line + '\n');
      } else {
        // Keep for the new file
        recentLines.push(line);
      }

      currentOffset += lineLength;
    }

    archiveStream.end();

    // Write recent lines to temp file
    if (recentLines.length > 0) {
      fs.writeFileSync(tempPath, recentLines.join('\n') + '\n', { mode: AUDIT_FILE_MODE });
      // Atomic rename
      fs.renameSync(tempPath, auditPath);
    }

    setSecurePermissions(auditPath);
    setSecurePermissions(archivePath);

  } catch (error) {
    // Clean up temp file if rotation fails
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    console.error('Warning: Audit log rotation failed:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read recent audit entries
 */
export function readAuditLog(limit: number = 50): AuditEntry[] {
  const auditPath = getAuditPath();

  if (!fs.existsSync(auditPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(auditPath, 'utf-8');
    // Split on newlines, filter empty lines (handles trailing newline correctly)
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    // Get last N entries
    const recentLines = lines.slice(-limit);

    return recentLines
      .map(line => {
        try {
          const parsed = JSON.parse(line);
          return validateAuditEntry(parsed);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AuditEntry => entry !== null)
      .reverse(); // Most recent first
  } catch (error) {
    console.error('Warning: Failed to read audit log:', error);
    return [];
  }
}

/**
 * Stream audit entries (memory efficient for large files)
 */
export async function* streamAuditLog(): AsyncGenerator<AuditEntry> {
  const auditPath = getAuditPath();

  if (!fs.existsSync(auditPath)) {
    return;
  }

  const fileStream = fs.createReadStream(auditPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      const entry = validateAuditEntry(parsed);
      if (entry) {
        yield entry;
      }
    } catch {
      // Skip malformed lines
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search audit log entries
 *
 * Note: For performance, this searches only the recent `limit` entries.
 * For full-file search, use searchAuditLogFull() or streamAuditLog().
 */
export function searchAuditLog(options: {
  type?: 'file' | 'command' | 'git';
  action?: Action;
  agent?: string;
  since?: Date;
  target?: string;
  limit?: number;
}): AuditEntry[] {
  // Read more entries than limit to account for filtering
  const readLimit = Math.min((options.limit || 100) * 10, 10000);
  const entries = readAuditLog(readLimit);

  const results: AuditEntry[] = [];
  const maxResults = options.limit || 100;

  for (const entry of entries) {
    if (options.type && entry.type !== options.type) continue;
    if (options.action && entry.action !== options.action) continue;
    if (options.agent && entry.agent !== options.agent) continue;
    if (options.target && !entry.target.includes(options.target)) continue;
    if (options.since && new Date(entry.ts) < options.since) continue;

    results.push(entry);
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Search entire audit log (streaming, memory efficient)
 */
export async function searchAuditLogFull(options: {
  type?: 'file' | 'command' | 'git';
  action?: Action;
  agent?: string;
  since?: Date;
  target?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const results: AuditEntry[] = [];
  const maxResults = options.limit || 1000;

  for await (const entry of streamAuditLog()) {
    if (options.type && entry.type !== options.type) continue;
    if (options.action && entry.action !== options.action) continue;
    if (options.agent && entry.agent !== options.agent) continue;
    if (options.target && !entry.target.includes(options.target)) continue;
    if (options.since && new Date(entry.ts) < options.since) continue;

    results.push(entry);
    if (results.length >= maxResults) break;
  }

  // Reverse to get most recent first
  return results.reverse();
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get audit statistics
 */
export function getAuditStats(): AuditStats {
  const entries = readAuditLog(10000);

  const stats: AuditStats = {
    total: entries.length,
    allowed: 0,
    blocked: 0,
    reviewed: 0,
    byType: {},
  };

  for (const entry of entries) {
    if (entry.action === 'allow') stats.allowed++;
    if (entry.action === 'block') stats.blocked++;
    if (entry.action === 'review') stats.reviewed++;

    stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if output supports colors
 */
function supportsColor(): boolean {
  // Check for explicit NO_COLOR
  if (process.env.NO_COLOR) return false;

  // Check for FORCE_COLOR
  if (process.env.FORCE_COLOR) return true;

  // Check if stdout is a TTY
  return process.stdout.isTTY === true;
}

/**
 * Format audit entry for display
 */
export function formatAuditEntry(entry: AuditEntry, options: FormatOptions = {}): string {
  const useColor = options.color ?? supportsColor();
  const maxLen = options.maxTargetLength ?? 60;

  // Use ISO time format for consistency
  const time = entry.ts.substring(11, 19); // Extract HH:MM:SS from ISO string

  const actionSymbol = entry.action === 'allow' ? '[ok]' : entry.action === 'block' ? '[x]' : '?';

  let line: string;

  if (useColor) {
    const actionColor = entry.action === 'allow' ? '\x1b[32m' : entry.action === 'block' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    let target = entry.target;
    if (target.length > maxLen) {
      target = target.substring(0, maxLen - 3) + '...';
    }

    line = `${time} ${actionColor}${actionSymbol}${reset} [${entry.type}] ${target}`;
  } else {
    let target = entry.target;
    if (target.length > maxLen) {
      target = target.substring(0, maxLen - 3) + '...';
    }

    line = `${time} ${actionSymbol} [${entry.type}] ${target}`;
  }

  if (entry.userApproved !== undefined) {
    line += entry.userApproved ? ' (approved)' : ' (denied)';
  }

  return line;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear the audit log (for testing)
 */
export function clearAuditLog(): void {
  const auditPath = getAuditPath();
  if (fs.existsSync(auditPath)) {
    fs.unlinkSync(auditPath);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Loggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a file write attempt
 */
export function logFileWrite(filePath: string, action: Action, options: {
  agent?: string;
  rule?: string;
  reason?: string;
  userApproved?: boolean;
  workingDir?: string;
} = {}): void {
  logAuditSync({
    type: 'file',
    action,
    target: filePath,
    ...options,
  });
}

/**
 * Log a command execution attempt
 */
export function logCommand(command: string, action: Action, options: {
  agent?: string;
  rule?: string;
  reason?: string;
  userApproved?: boolean;
  workingDir?: string;
} = {}): void {
  logAuditSync({
    type: 'command',
    action,
    target: command,
    ...options,
  });
}

/**
 * Log a git operation attempt
 */
export function logGitOperation(operation: string, action: Action, options: {
  agent?: string;
  rule?: string;
  reason?: string;
  userApproved?: boolean;
  workingDir?: string;
} = {}): void {
  logAuditSync({
    type: 'git',
    action,
    target: operation,
    ...options,
  });
}
