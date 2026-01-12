import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent Permission Broker - Policy Engine
 *
 * Parses and evaluates YAML policies for AI agent permissions.
 * Supports file path patterns, shell command rules, and git operations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Action = 'allow' | 'block' | 'review';
export type ResourceType = 'file' | 'command' | 'git';
export type GitOperation = 'commit' | 'push' | 'force-push' | 'branch-delete';

const VALID_ACTIONS: readonly string[] = ['allow', 'block', 'review'];
const VALID_GIT_OPS: readonly string[] = ['commit', 'push', 'force-push', 'branch-delete'];

export interface PolicyRule {
  // File rules
  path?: string;

  // Command rules
  command?: string;

  // Git rules
  git?: GitOperation;

  // Action to take
  action: Action;

  // Optional: reason shown to user
  reason?: string;
}

export interface Policy {
  version: number;
  default: Action;
  rules: PolicyRule[];
}

export interface PolicyEvaluation {
  action: Action;
  rule?: PolicyRule;
  reason?: string;
}

export interface PolicyValidationError {
  message: string;
  line?: number;
  field?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a string is a valid Action
 */
function isValidAction(value: unknown): value is Action {
  return typeof value === 'string' && VALID_ACTIONS.includes(value);
}

/**
 * Validate that a string is a valid GitOperation
 */
function isValidGitOp(value: unknown): value is GitOperation {
  return typeof value === 'string' && VALID_GIT_OPS.includes(value);
}

/**
 * Validate a PolicyRule
 */
function validateRule(rule: unknown, index: number): { valid: boolean; errors: PolicyValidationError[] } {
  const errors: PolicyValidationError[] = [];

  if (!rule || typeof rule !== 'object') {
    errors.push({ message: `Rule ${index} is not an object` });
    return { valid: false, errors };
  }

  const r = rule as Record<string, unknown>;

  // Must have at least one of: path, command, git
  if (!r.path && !r.command && !r.git) {
    errors.push({ message: `Rule ${index} must have 'path', 'command', or 'git'`, field: 'path|command|git' });
  }

  // Validate action
  if (!r.action) {
    errors.push({ message: `Rule ${index} missing 'action'`, field: 'action' });
  } else if (!isValidAction(r.action)) {
    errors.push({ message: `Rule ${index} has invalid action: ${r.action}`, field: 'action' });
  }

  // Validate git operation if present
  if (r.git && !isValidGitOp(r.git)) {
    errors.push({ message: `Rule ${index} has invalid git operation: ${r.git}`, field: 'git' });
  }

  // Validate types
  if (r.path !== undefined && typeof r.path !== 'string') {
    errors.push({ message: `Rule ${index} 'path' must be a string`, field: 'path' });
  }
  if (r.command !== undefined && typeof r.command !== 'string') {
    errors.push({ message: `Rule ${index} 'command' must be a string`, field: 'command' });
  }
  if (r.reason !== undefined && typeof r.reason !== 'string') {
    errors.push({ message: `Rule ${index} 'reason' must be a string`, field: 'reason' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an entire Policy
 */
function validatePolicy(policy: unknown): { valid: boolean; errors: PolicyValidationError[]; policy?: Policy } {
  const errors: PolicyValidationError[] = [];

  if (!policy || typeof policy !== 'object') {
    errors.push({ message: 'Policy must be an object' });
    return { valid: false, errors };
  }

  const p = policy as Record<string, unknown>;

  // Validate version
  if (p.version !== undefined && typeof p.version !== 'number') {
    errors.push({ message: 'Policy version must be a number', field: 'version' });
  }

  // Validate default action
  if (!p.default) {
    errors.push({ message: "Policy missing 'default' action", field: 'default' });
  } else if (!isValidAction(p.default)) {
    errors.push({ message: `Invalid default action: ${p.default}`, field: 'default' });
  }

  // Validate rules
  if (!Array.isArray(p.rules)) {
    errors.push({ message: "Policy 'rules' must be an array", field: 'rules' });
  } else {
    for (let i = 0; i < p.rules.length; i++) {
      const result = validateRule(p.rules[i], i);
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    policy: {
      version: typeof p.version === 'number' ? p.version : 1,
      default: p.default as Action,
      rules: p.rules as PolicyRule[],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Glob Pattern Matching (Correct Implementation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a glob pattern against a path
 *
 * Supports:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/` (directory traversal)
 * - `?` matches any single character
 * - `[abc]` matches any character in brackets
 * - `[!abc]` matches any character not in brackets
 */
export function matchPattern(pattern: string, target: string): boolean {
  // Normalize paths to forward slashes
  const normalizedTarget = target.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Build regex from glob pattern
  let regex = '';
  let i = 0;

  while (i < normalizedPattern.length) {
    const char = normalizedPattern[i];
    const next = normalizedPattern[i + 1];

    if (char === '*' && next === '*') {
      // ** - match anything including /
      // Check if surrounded by / or at start/end
      const prev = i > 0 ? normalizedPattern[i - 1] : '/';
      const afterNext = normalizedPattern[i + 2];

      if ((prev === '/' || i === 0) && (afterNext === '/' || afterNext === undefined)) {
        // **/ or /** or standalone **
        regex += '.*';
        i += 2;
        // Skip trailing / after **
        if (normalizedPattern[i] === '/') {
          regex += '/?';  // Make slash optional to match zero or more directories
          i++;
        }
      } else {
        // ** not at path boundary, treat as two *
        regex += '[^/]*[^/]*';
        i += 2;
      }
    } else if (char === '*') {
      // * - match anything except /
      regex += '[^/]*';
      i++;
    } else if (char === '?') {
      // ? - match single character except /
      regex += '[^/]';
      i++;
    } else if (char === '[') {
      // Character class
      let classContent = '[';
      i++;

      // Handle negation
      if (normalizedPattern[i] === '!' || normalizedPattern[i] === '^') {
        classContent += '^';
        i++;
      }

      // Read until ]
      while (i < normalizedPattern.length && normalizedPattern[i] !== ']') {
        if (normalizedPattern[i] === '\\' && normalizedPattern[i + 1]) {
          classContent += '\\' + normalizedPattern[i + 1];
          i += 2;
        } else {
          classContent += normalizedPattern[i];
          i++;
        }
      }

      classContent += ']';
      regex += classContent;
      i++; // Skip ]
    } else if ('.+^${}()|[]\\'.includes(char)) {
      // Escape regex special characters
      regex += '\\' + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  // Anchor the pattern
  regex = `^${regex}$`;

  try {
    return new RegExp(regex).test(normalizedTarget);
  } catch {
    // Invalid regex, fall back to exact match
    return normalizedTarget === normalizedPattern;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Matching (Tokenized, Injection-Safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokenize a shell command into parts
 * Handles basic quoting but not all shell complexity
 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if a command contains shell operators that could chain commands
 */
function hasShellOperators(command: string): boolean {
  // Check for command chaining operators outside of quotes
  const dangerousPatterns = [
    /[^\\];/, // semicolon (not escaped)
    /\|\|/, // or
    /&&/, // and
    /\|(?!\|)/, // pipe (not ||)
    /`/, // backticks
    /\$\(/, // command substitution
  ];

  // Simple check - could be more sophisticated with proper parsing
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a command pattern against a command
 *
 * Pattern matching:
 * - `*` matches any sequence of characters in a single token
 * - Tokens must match in order
 * - Extra tokens in command are allowed (for flags)
 *
 * Security: Commands with shell operators are flagged separately
 */
export function matchCommand(pattern: string, command: string): boolean {
  // Normalize whitespace
  const normalizedCommand = command.trim();
  const normalizedPattern = pattern.trim();

  // Tokenize both
  const patternTokens = tokenizeCommand(normalizedPattern);
  const commandTokens = tokenizeCommand(normalizedCommand);

  if (patternTokens.length === 0) {
    return false;
  }

  // First token (command name) must match exactly or with wildcards
  let patternIdx = 0;
  let commandIdx = 0;

  while (patternIdx < patternTokens.length && commandIdx < commandTokens.length) {
    const patternToken = patternTokens[patternIdx];
    const commandToken = commandTokens[commandIdx];

    if (patternToken === '*') {
      // * in pattern matches any single token
      patternIdx++;
      commandIdx++;
    } else if (patternToken.includes('*')) {
      // Token with wildcards
      const regex = new RegExp(
        '^' + patternToken.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
        'i'
      );
      if (!regex.test(commandToken)) {
        return false;
      }
      patternIdx++;
      commandIdx++;
    } else {
      // Exact match required
      if (patternToken.toLowerCase() !== commandToken.toLowerCase()) {
        return false;
      }
      patternIdx++;
      commandIdx++;
    }
  }

  // All pattern tokens must be matched
  return patternIdx === patternTokens.length;
}

/**
 * Evaluate command safety
 */
export interface CommandSafetyCheck {
  hasShellOperators: boolean;
  matchesPattern: boolean;
}

export function checkCommandSafety(pattern: string, command: string): CommandSafetyCheck {
  return {
    hasShellOperators: hasShellOperators(command),
    matchesPattern: matchCommand(pattern, command),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML Parsing (Improved)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape a string for YAML output
 */
function escapeYamlString(value: string): string {
  // Check if string needs quoting
  const needsQuotes =
    value.includes(':') ||
    value.includes('#') ||
    value.includes("'") ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\\') ||
    value.startsWith(' ') ||
    value.endsWith(' ') ||
    value.startsWith('-') ||
    value.startsWith('*') ||
    value.startsWith('?') ||
    value.startsWith('[') ||
    value.startsWith('{') ||
    /^[0-9]/.test(value) ||
    ['true', 'false', 'null', 'yes', 'no', 'on', 'off'].includes(value.toLowerCase());

  if (!needsQuotes) {
    return value;
  }

  // Use double quotes with escaping
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

/**
 * Parse a YAML value (handles strings, numbers, booleans)
 */
function parseYamlValue(value: string): string | number | boolean {
  const trimmed = value.trim();

  // Remove quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Check for numbers
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Check for booleans
  if (['true', 'yes', 'on'].includes(trimmed.toLowerCase())) {
    return true;
  }
  if (['false', 'no', 'off'].includes(trimmed.toLowerCase())) {
    return false;
  }

  return trimmed;
}

/**
 * Parse YAML policy file
 * This is a minimal YAML parser for our specific policy format
 */
function parseYamlPolicy(content: string): { policy: Policy | null; errors: PolicyValidationError[] } {
  const lines = content.split('\n');
  const errors: PolicyValidationError[] = [];

  const policy: Partial<Policy> = {
    version: 1,
    default: 'review',
    rules: [],
  };

  let currentRule: Partial<PolicyRule> | null = null;
  let inRules = false;
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Check indentation level
    const indent = line.length - line.trimStart().length;

    // Parse version
    if (trimmed.startsWith('version:')) {
      const value = parseYamlValue(trimmed.substring(8));
      if (typeof value === 'number') {
        policy.version = value;
      } else {
        errors.push({ message: 'version must be a number', line: lineNum });
      }
      continue;
    }

    // Parse default action
    if (trimmed.startsWith('default:')) {
      const value = String(parseYamlValue(trimmed.substring(8)));
      if (isValidAction(value)) {
        policy.default = value;
      } else {
        errors.push({ message: `invalid default action: ${value}`, line: lineNum });
      }
      continue;
    }

    // Start of rules section
    if (trimmed === 'rules:') {
      inRules = true;
      continue;
    }

    if (!inRules) continue;

    // New rule (starts with -)
    if (trimmed.startsWith('- ')) {
      // Save previous rule
      if (currentRule) {
        if (currentRule.action && (currentRule.path || currentRule.command || currentRule.git)) {
          policy.rules!.push(currentRule as PolicyRule);
        } else if (Object.keys(currentRule).length > 0) {
          errors.push({ message: 'incomplete rule', line: lineNum - 1 });
        }
      }

      currentRule = {};

      // Parse inline rule: - path: "src/**"
      const rest = trimmed.substring(2).trim();
      const colonIdx = rest.indexOf(':');
      if (colonIdx > 0) {
        const key = rest.substring(0, colonIdx).trim();
        const value = parseYamlValue(rest.substring(colonIdx + 1));

        if (key === 'action') {
          if (isValidAction(value)) {
            currentRule.action = value as Action;
          } else {
            errors.push({ message: `invalid action: ${value}`, line: lineNum });
          }
        } else if (key === 'git') {
          if (isValidGitOp(value)) {
            currentRule.git = value as GitOperation;
          } else {
            errors.push({ message: `invalid git operation: ${value}`, line: lineNum });
          }
        } else if (['path', 'command', 'reason'].includes(key)) {
          (currentRule as Record<string, unknown>)[key] = String(value);
        }
      }
      continue;
    }

    // Rule property (indented under -)
    if (currentRule && indent >= 2) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim();
        const value = parseYamlValue(trimmed.substring(colonIdx + 1));

        if (key === 'action') {
          if (isValidAction(value)) {
            currentRule.action = value as Action;
          } else {
            errors.push({ message: `invalid action: ${value}`, line: lineNum });
          }
        } else if (key === 'git') {
          if (isValidGitOp(value)) {
            currentRule.git = value as GitOperation;
          } else {
            errors.push({ message: `invalid git operation: ${value}`, line: lineNum });
          }
        } else if (['path', 'command', 'reason'].includes(key)) {
          (currentRule as Record<string, unknown>)[key] = String(value);
        }
      }
    }
  }

  // Add last rule
  if (currentRule) {
    if (currentRule.action && (currentRule.path || currentRule.command || currentRule.git)) {
      policy.rules!.push(currentRule as PolicyRule);
    } else if (Object.keys(currentRule).length > 0) {
      errors.push({ message: 'incomplete rule at end of file', line: lineNum });
    }
  }

  // Validate final policy
  if (!policy.default || !isValidAction(policy.default)) {
    errors.push({ message: 'missing or invalid default action' });
    return { policy: null, errors };
  }

  return {
    policy: policy as Policy,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Policy
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POLICY: Policy = {
  version: 1,
  default: 'review',
  rules: [
    // Allow source code
    { path: 'src/**', action: 'allow' },
    { path: 'lib/**', action: 'allow' },
    { path: 'app/**', action: 'allow' },
    { path: 'pages/**', action: 'allow' },
    { path: 'components/**', action: 'allow' },
    { path: 'tests/**', action: 'allow' },
    { path: 'test/**', action: 'allow' },
    { path: '**/*.ts', action: 'allow' },
    { path: '**/*.tsx', action: 'allow' },
    { path: '**/*.js', action: 'allow' },
    { path: '**/*.jsx', action: 'allow' },
    { path: '**/*.py', action: 'allow' },
    { path: '**/*.go', action: 'allow' },
    { path: '**/*.rs', action: 'allow' },
    { path: '**/*.css', action: 'allow' },
    { path: '**/*.scss', action: 'allow' },
    { path: '**/*.html', action: 'allow' },
    { path: '**/*.md', action: 'allow' },
    { path: '**/*.json', action: 'review' },
    { path: '**/*.yaml', action: 'review' },
    { path: '**/*.yml', action: 'review' },

    // Block sensitive files
    { path: '.env*', action: 'block', reason: 'Environment files may contain secrets' },
    { path: '**/.env*', action: 'block', reason: 'Environment files may contain secrets' },
    { path: '**/*.pem', action: 'block', reason: 'Private keys are sensitive' },
    { path: '**/*.key', action: 'block', reason: 'Private keys are sensitive' },
    { path: '**/id_rsa*', action: 'block', reason: 'SSH keys are sensitive' },
    { path: '**/id_ed25519*', action: 'block', reason: 'SSH keys are sensitive' },
    { path: '**/.ssh/**', action: 'block', reason: 'SSH configuration is sensitive' },
    { path: '**/secrets/**', action: 'block', reason: 'Secrets directory is protected' },
    { path: '**/credentials*', action: 'block', reason: 'Credentials are sensitive' },

    // Block CI/CD and infrastructure
    { path: '.github/workflows/**', action: 'block', reason: 'CI/CD workflows can run arbitrary code' },
    { path: '.gitlab-ci.yml', action: 'block', reason: 'CI/CD config can run arbitrary code' },
    { path: 'Jenkinsfile', action: 'block', reason: 'CI/CD config can run arbitrary code' },
    { path: '.circleci/**', action: 'block', reason: 'CI/CD config can run arbitrary code' },
    { path: 'Dockerfile*', action: 'review', reason: 'Container config should be reviewed' },
    { path: 'docker-compose*', action: 'review', reason: 'Container config should be reviewed' },
    { path: '**/terraform/**', action: 'block', reason: 'Infrastructure as code is sensitive' },
    { path: '**/*.tf', action: 'block', reason: 'Terraform files are sensitive' },

    // Protect broker's own config
    { path: '.connect/**', action: 'block', reason: 'Broker configuration is protected' },
    { path: '**/.connect/**', action: 'block', reason: 'Broker configuration is protected' },

    // Command rules
    { command: 'rm -rf *', action: 'block', reason: 'Destructive command' },
    { command: 'rm -rf /', action: 'block', reason: 'Destructive command' },
    { command: 'rm -rf ~', action: 'block', reason: 'Destructive command' },
    { command: 'chmod 777 *', action: 'block', reason: 'Insecure permissions' },
    { command: 'sudo *', action: 'review', reason: 'Elevated privileges' },
    { command: 'npm install *', action: 'allow' },
    { command: 'npm run *', action: 'allow' },
    { command: 'pnpm *', action: 'allow' },
    { command: 'yarn *', action: 'allow' },
    { command: 'npx *', action: 'review' },
    { command: 'pip install *', action: 'allow' },
    { command: 'git add *', action: 'allow' },
    { command: 'git commit *', action: 'allow' },
    { command: 'git status', action: 'allow' },
    { command: 'git diff *', action: 'allow' },
    { command: 'git log *', action: 'allow' },
    { command: 'git push *', action: 'review', reason: 'Pushing code to remote' },
    { command: 'git push -f *', action: 'block', reason: 'Force push can overwrite history' },
    { command: 'git push --force *', action: 'block', reason: 'Force push can overwrite history' },

    // Git operation rules
    { git: 'force-push', action: 'block', reason: 'Force push can destroy history' },
    { git: 'branch-delete', action: 'review', reason: 'Deleting branches should be reviewed' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Policy Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load policy from a directory (looks for .connect/policy.yml or .connect/policy.yaml)
 */
export function loadPolicy(workingDir: string): Policy {
  const policyPaths = [
    path.join(workingDir, '.connect', 'policy.yml'),
    path.join(workingDir, '.connect', 'policy.yaml'),
    path.join(workingDir, '.connect', 'policy.json'),
  ];

  for (const policyPath of policyPaths) {
    if (fs.existsSync(policyPath)) {
      try {
        const content = fs.readFileSync(policyPath, 'utf-8');

        if (policyPath.endsWith('.json')) {
          // Parse and validate JSON
          const parsed = JSON.parse(content);
          const result = validatePolicy(parsed);

          if (!result.valid) {
            console.error(`Warning: Invalid policy at ${policyPath}:`);
            for (const error of result.errors) {
              console.error(`  - ${error.message}`);
            }
            continue;
          }

          return result.policy!;
        }

        // Parse YAML
        const { policy, errors } = parseYamlPolicy(content);

        if (errors.length > 0) {
          console.error(`Warning: Policy parsing errors in ${policyPath}:`);
          for (const error of errors) {
            const lineInfo = error.line ? ` (line ${error.line})` : '';
            console.error(`  - ${error.message}${lineInfo}`);
          }
        }

        if (policy) {
          return policy;
        }
      } catch (error) {
        console.error(`Warning: Failed to parse policy at ${policyPath}:`, error);
      }
    }
  }

  // Return default policy if no custom policy found
  return DEFAULT_POLICY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a file write against the policy
 */
export function evaluateFileWrite(policy: Policy, filePath: string): PolicyEvaluation {
  // Normalize the path
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check rules in order (first match wins)
  for (const rule of policy.rules) {
    if (rule.path && matchPattern(rule.path, normalizedPath)) {
      return {
        action: rule.action,
        rule,
        reason: rule.reason,
      };
    }
  }

  // Return default action
  return {
    action: policy.default,
    reason: 'No matching rule, using default policy',
  };
}

/**
 * Evaluate a shell command against the policy
 */
export function evaluateCommand(policy: Policy, command: string): PolicyEvaluation {
  // First, check for shell operators (potential injection)
  if (hasShellOperators(command)) {
    return {
      action: 'review',
      reason: 'Command contains shell operators that may chain commands',
    };
  }

  // Check rules in order
  for (const rule of policy.rules) {
    if (rule.command && matchCommand(rule.command, command)) {
      return {
        action: rule.action,
        rule,
        reason: rule.reason,
      };
    }
  }

  // Return default action
  return {
    action: policy.default,
    reason: 'No matching rule, using default policy',
  };
}

/**
 * Evaluate a git operation against the policy
 */
export function evaluateGitOperation(
  policy: Policy,
  operation: GitOperation
): PolicyEvaluation {
  // Check git-specific rules first
  for (const rule of policy.rules) {
    if (rule.git === operation) {
      return {
        action: rule.action,
        rule,
        reason: rule.reason,
      };
    }
  }

  // Also check command-based git rules for consistency
  const gitCommandMap: Record<GitOperation, string[]> = {
    'commit': ['git commit'],
    'push': ['git push'],
    'force-push': ['git push -f', 'git push --force'],
    'branch-delete': ['git branch -d', 'git branch -D', 'git push origin --delete'],
  };

  const commands = gitCommandMap[operation] || [];
  for (const cmd of commands) {
    for (const rule of policy.rules) {
      if (rule.command && matchCommand(rule.command, cmd)) {
        return {
          action: rule.action,
          rule,
          reason: rule.reason,
        };
      }
    }
  }

  return {
    action: policy.default,
    reason: 'No matching rule, using default policy',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the default policy (for `connect broker init`)
 */
export function getDefaultPolicy(): Policy {
  return DEFAULT_POLICY;
}

/**
 * Generate policy YAML string with proper escaping
 */
export function generatePolicyYaml(policy: Policy): string {
  let yaml = `# Connect Agent Permission Broker Policy
# This file controls what AI agents can do in your workspace
#
# Actions:
#   allow  - Permit the operation silently
#   block  - Deny the operation
#   review - Prompt user for approval
#
# Rules are evaluated in order - first match wins

version: ${policy.version}
default: ${policy.default}

rules:
`;

  // Group rules by type for better readability
  const fileRules = policy.rules.filter((r) => r.path);
  const commandRules = policy.rules.filter((r) => r.command);
  const gitRules = policy.rules.filter((r) => r.git);

  if (fileRules.length > 0) {
    yaml += `  # File access rules\n`;
    for (const rule of fileRules) {
      yaml += `  - path: ${escapeYamlString(rule.path!)}\n`;
      yaml += `    action: ${rule.action}\n`;
      if (rule.reason) {
        yaml += `    reason: ${escapeYamlString(rule.reason)}\n`;
      }
      yaml += `\n`;
    }
  }

  if (commandRules.length > 0) {
    yaml += `  # Shell command rules\n`;
    for (const rule of commandRules) {
      yaml += `  - command: ${escapeYamlString(rule.command!)}\n`;
      yaml += `    action: ${rule.action}\n`;
      if (rule.reason) {
        yaml += `    reason: ${escapeYamlString(rule.reason)}\n`;
      }
      yaml += `\n`;
    }
  }

  if (gitRules.length > 0) {
    yaml += `  # Git operation rules\n`;
    for (const rule of gitRules) {
      yaml += `  - git: ${rule.git}\n`;
      yaml += `    action: ${rule.action}\n`;
      if (rule.reason) {
        yaml += `    reason: ${escapeYamlString(rule.reason)}\n`;
      }
      yaml += `\n`;
    }
  }

  return yaml;
}

/**
 * Initialize policy in a directory
 */
export function initPolicy(workingDir: string, options: { force?: boolean } = {}): {
  success: boolean;
  path?: string;
  error?: string;
} {
  const connectDir = path.join(workingDir, '.connect');
  const policyPath = path.join(connectDir, 'policy.yml');

  // Check for existing policy unless force is set
  if (!options.force && fs.existsSync(policyPath)) {
    return {
      success: false,
      path: policyPath,
      error: 'Policy already exists. Use --force to overwrite.',
    };
  }

  // Create .connect directory if it doesn't exist
  if (!fs.existsSync(connectDir)) {
    fs.mkdirSync(connectDir, { recursive: true, mode: 0o700 });
  }

  // Generate a minimal policy (not the full default - let users customize)
  const minimalPolicy: Policy = {
    version: 1,
    default: 'review',
    rules: [
      // Allow source code
      { path: 'src/**', action: 'allow' },
      { path: 'lib/**', action: 'allow' },
      { path: 'app/**', action: 'allow' },
      { path: 'tests/**', action: 'allow' },
      { path: '**/*.ts', action: 'allow' },
      { path: '**/*.js', action: 'allow' },
      { path: '**/*.py', action: 'allow' },
      { path: '**/*.md', action: 'allow' },

      // Block sensitive files
      { path: '.env*', action: 'block', reason: 'Environment files may contain secrets' },
      { path: '**/*.key', action: 'block', reason: 'Private keys are sensitive' },
      { path: '.github/workflows/**', action: 'block', reason: 'CI/CD workflows can run arbitrary code' },

      // Protect broker config
      { path: '.connect/**', action: 'block', reason: 'Broker configuration is protected' },

      // Command rules
      { command: 'rm -rf *', action: 'block', reason: 'Destructive command' },
      { command: 'git push -f *', action: 'block', reason: 'Force push can overwrite history' },
      { command: 'npm install *', action: 'allow' },
      { command: 'git *', action: 'allow' },
    ],
  };

  const yaml = generatePolicyYaml(minimalPolicy);
  fs.writeFileSync(policyPath, yaml, { mode: 0o600 });

  // Add .connect to .gitignore if it exists and doesn't already include it
  const gitignorePath = path.join(workingDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.connect')) {
      fs.appendFileSync(gitignorePath, '\n# Connect Agent Broker\n.connect/\n');
    }
  }

  return {
    success: true,
    path: policyPath,
  };
}
