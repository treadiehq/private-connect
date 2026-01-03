import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Action } from './policy';

/**
 * Agent Permission Broker - Audit Logger
 * 
 * Maintains an append-only log of all agent actions for security and debugging.
 * Stored in JSONL format for easy parsing and streaming.
 */

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

const AUDIT_DIR = path.join(os.homedir(), '.connect');
const AUDIT_FILE = 'audit.jsonl';
const MAX_ENTRIES = 10000;  // Rotate after this many entries

/**
 * Get the path to the audit log
 */
export function getAuditPath(): string {
  return path.join(AUDIT_DIR, AUDIT_FILE);
}

/**
 * Ensure the audit directory exists
 */
function ensureAuditDir(): void {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

/**
 * Log an audit entry
 */
export function logAudit(entry: Omit<AuditEntry, 'ts'>): void {
  ensureAuditDir();
  
  const fullEntry: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };
  
  const auditPath = getAuditPath();
  const line = JSON.stringify(fullEntry) + '\n';
  
  try {
    fs.appendFileSync(auditPath, line);
    
    // Check if we need to rotate
    const stats = fs.statSync(auditPath);
    if (stats.size > MAX_ENTRIES * 500) { // ~500 bytes per entry
      rotateAuditLog();
    }
  } catch (error) {
    // Silently fail - don't break the agent operation for audit failures
    console.error('Warning: Failed to write audit log:', error);
  }
}

/**
 * Rotate the audit log (keep last N entries)
 */
function rotateAuditLog(): void {
  const auditPath = getAuditPath();
  const archivePath = path.join(AUDIT_DIR, `audit.${Date.now()}.jsonl`);
  
  try {
    // Read current entries
    const content = fs.readFileSync(auditPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Keep only the last MAX_ENTRIES entries
    const keepLines = lines.slice(-MAX_ENTRIES);
    
    // Archive old entries
    const archiveLines = lines.slice(0, -MAX_ENTRIES);
    if (archiveLines.length > 0) {
      fs.writeFileSync(archivePath, archiveLines.join('\n') + '\n');
    }
    
    // Write back the kept entries
    fs.writeFileSync(auditPath, keepLines.join('\n') + '\n');
  } catch {
    // If rotation fails, just continue
  }
}

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
    const lines = content.trim().split('\n').filter(l => l.trim());
    
    // Get last N entries
    const recentLines = lines.slice(-limit);
    
    return recentLines
      .map(line => {
        try {
          return JSON.parse(line) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AuditEntry => entry !== null)
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}

/**
 * Search audit log entries
 */
export function searchAuditLog(options: {
  type?: 'file' | 'command' | 'git';
  action?: Action;
  agent?: string;
  since?: Date;
  target?: string;
  limit?: number;
}): AuditEntry[] {
  const entries = readAuditLog(options.limit || 1000);
  
  return entries.filter(entry => {
    if (options.type && entry.type !== options.type) return false;
    if (options.action && entry.action !== options.action) return false;
    if (options.agent && entry.agent !== options.agent) return false;
    if (options.target && !entry.target.includes(options.target)) return false;
    if (options.since && new Date(entry.ts) < options.since) return false;
    return true;
  });
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  total: number;
  allowed: number;
  blocked: number;
  reviewed: number;
  byType: Record<string, number>;
} {
  const entries = readAuditLog(10000);
  
  const stats = {
    total: entries.length,
    allowed: 0,
    blocked: 0,
    reviewed: 0,
    byType: {} as Record<string, number>,
  };
  
  for (const entry of entries) {
    if (entry.action === 'allow') stats.allowed++;
    if (entry.action === 'block') stats.blocked++;
    if (entry.action === 'review') stats.reviewed++;
    
    stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
  }
  
  return stats;
}

/**
 * Format audit entry for display
 */
export function formatAuditEntry(entry: AuditEntry): string {
  const time = new Date(entry.ts).toLocaleTimeString();
  const actionSymbol = entry.action === 'allow' ? '[ok]' : entry.action === 'block' ? '[x]' : '?';
  const actionColor = entry.action === 'allow' ? '\x1b[32m' : entry.action === 'block' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';
  
  let target = entry.target;
  if (target.length > 60) {
    target = target.substring(0, 57) + '...';
  }
  
  let line = `${time} ${actionColor}${actionSymbol}${reset} [${entry.type}] ${target}`;
  
  if (entry.userApproved !== undefined) {
    line += entry.userApproved ? ' (approved)' : ' (denied)';
  }
  
  return line;
}

/**
 * Clear the audit log (for testing)
 */
export function clearAuditLog(): void {
  const auditPath = getAuditPath();
  if (fs.existsSync(auditPath)) {
    fs.unlinkSync(auditPath);
  }
}

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
  logAudit({
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
  logAudit({
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
  logAudit({
    type: 'git',
    action,
    target: operation,
    ...options,
  });
}

