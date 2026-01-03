import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Agent Permission Broker - Policy Engine
 * 
 * Parses and evaluates YAML policies for AI agent permissions.
 * Supports file path patterns, shell command rules, and git operations.
 */

export type Action = 'allow' | 'block' | 'review';
export type ResourceType = 'file' | 'command' | 'git';

export interface PolicyRule {
  // File rules
  path?: string;
  
  // Command rules
  command?: string;
  
  // Git rules
  git?: 'commit' | 'push' | 'force-push' | 'branch-delete';
  
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

// Default secure policy
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
    { command: 'curl *|*sh', action: 'block', reason: 'Remote code execution' },
    { command: 'wget *|*sh', action: 'block', reason: 'Remote code execution' },
    { command: 'curl *|*bash', action: 'block', reason: 'Remote code execution' },
    { command: 'wget *|*bash', action: 'block', reason: 'Remote code execution' },
    { command: 'chmod 777*', action: 'block', reason: 'Insecure permissions' },
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
    { command: 'git diff*', action: 'allow' },
    { command: 'git log*', action: 'allow' },
    { command: 'git push*', action: 'review', reason: 'Pushing code to remote' },
    { command: 'git push -f*', action: 'block', reason: 'Force push can overwrite history' },
    { command: 'git push --force*', action: 'block', reason: 'Force push can overwrite history' },
    
    // Git operation rules
    { git: 'force-push', action: 'block', reason: 'Force push can destroy history' },
    { git: 'branch-delete', action: 'review', reason: 'Deleting branches should be reviewed' },
  ],
};

/**
 * Match a pattern against a path (glob-like matching)
 */
export function matchPattern(pattern: string, target: string): boolean {
  // Normalize paths
  const normalizedTarget = target.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // Convert glob pattern to regex
  let regex = normalizedPattern
    // Escape regex special chars except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** matches anything including /
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    // * matches anything except /
    .replace(/\*/g, '[^/]*')
    // Restore **
    .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')
    // ? matches single char
    .replace(/\?/g, '.');
  
  // Anchor the pattern
  regex = `^${regex}$`;
  
  try {
    return new RegExp(regex).test(normalizedTarget);
  } catch {
    return false;
  }
}

/**
 * Match a command pattern (supports wildcards)
 */
export function matchCommand(pattern: string, command: string): boolean {
  // Normalize whitespace
  const normalizedCommand = command.trim().replace(/\s+/g, ' ');
  const normalizedPattern = pattern.trim().replace(/\s+/g, ' ');
  
  // Convert pattern to regex
  let regex = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  
  regex = `^${regex}$`;
  
  try {
    return new RegExp(regex, 'i').test(normalizedCommand);
  } catch {
    return false;
  }
}

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
        
        // Simple YAML parser for our specific format
        if (policyPath.endsWith('.json')) {
          return JSON.parse(content) as Policy;
        }
        
        // Parse YAML
        return parseYamlPolicy(content);
      } catch (error) {
        console.error(`Warning: Failed to parse policy at ${policyPath}:`, error);
      }
    }
  }
  
  // Return default policy if no custom policy found
  return DEFAULT_POLICY;
}

/**
 * Simple YAML parser for policy files
 */
function parseYamlPolicy(content: string): Policy {
  const lines = content.split('\n');
  const policy: Policy = {
    version: 1,
    default: 'review',
    rules: [],
  };
  
  let currentRule: Partial<PolicyRule> | null = null;
  let inRules = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;
    
    // Parse version
    if (trimmed.startsWith('version:')) {
      policy.version = parseInt(trimmed.split(':')[1].trim(), 10);
      continue;
    }
    
    // Parse default action
    if (trimmed.startsWith('default:')) {
      policy.default = trimmed.split(':')[1].trim() as Action;
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
      if (currentRule && (currentRule.path || currentRule.command || currentRule.git)) {
        policy.rules.push(currentRule as PolicyRule);
      }
      currentRule = {};
      
      // Parse inline rule: - path: "src/**"
      const inlineMatch = trimmed.match(/^-\s+(\w+):\s*["']?([^"']+)["']?$/);
      if (inlineMatch) {
        const [, key, value] = inlineMatch;
        (currentRule as Record<string, string>)[key] = value;
      }
      continue;
    }
    
    // Rule property
    if (currentRule) {
      const propMatch = trimmed.match(/^(\w+):\s*["']?([^"']+)["']?$/);
      if (propMatch) {
        const [, key, value] = propMatch;
        (currentRule as Record<string, string>)[key] = value;
      }
    }
  }
  
  // Add last rule
  if (currentRule && (currentRule.path || currentRule.command || currentRule.git)) {
    policy.rules.push(currentRule as PolicyRule);
  }
  
  return policy;
}

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
export function evaluateGitOperation(policy: Policy, operation: 'commit' | 'push' | 'force-push' | 'branch-delete'): PolicyEvaluation {
  for (const rule of policy.rules) {
    if (rule.git === operation) {
      return {
        action: rule.action,
        rule,
        reason: rule.reason,
      };
    }
  }
  
  return {
    action: policy.default,
    reason: 'No matching rule, using default policy',
  };
}

/**
 * Get the default policy (for `connect broker init`)
 */
export function getDefaultPolicy(): Policy {
  return DEFAULT_POLICY;
}

/**
 * Generate policy YAML string
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
  const fileRules = policy.rules.filter(r => r.path);
  const commandRules = policy.rules.filter(r => r.command);
  const gitRules = policy.rules.filter(r => r.git);

  if (fileRules.length > 0) {
    yaml += `  # File access rules\n`;
    for (const rule of fileRules) {
      yaml += `  - path: "${rule.path}"\n`;
      yaml += `    action: ${rule.action}\n`;
      if (rule.reason) {
        yaml += `    reason: "${rule.reason}"\n`;
      }
      yaml += `\n`;
    }
  }

  if (commandRules.length > 0) {
    yaml += `  # Shell command rules\n`;
    for (const rule of commandRules) {
      yaml += `  - command: "${rule.command}"\n`;
      yaml += `    action: ${rule.action}\n`;
      if (rule.reason) {
        yaml += `    reason: "${rule.reason}"\n`;
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
        yaml += `    reason: "${rule.reason}"\n`;
      }
      yaml += `\n`;
    }
  }

  return yaml;
}

/**
 * Initialize policy in a directory
 */
export function initPolicy(workingDir: string): string {
  const connectDir = path.join(workingDir, '.connect');
  const policyPath = path.join(connectDir, 'policy.yml');
  
  // Create .connect directory if it doesn't exist
  if (!fs.existsSync(connectDir)) {
    fs.mkdirSync(connectDir, { recursive: true });
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
      { command: 'curl *|*sh', action: 'block', reason: 'Remote code execution' },
      { command: 'git push -f*', action: 'block', reason: 'Force push can overwrite history' },
      { command: 'npm install *', action: 'allow' },
      { command: 'git *', action: 'allow' },
    ],
  };
  
  const yaml = generatePolicyYaml(minimalPolicy);
  fs.writeFileSync(policyPath, yaml);
  
  // Add .connect to .gitignore if it exists and doesn't already include it
  const gitignorePath = path.join(workingDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.connect')) {
      fs.appendFileSync(gitignorePath, '\n# Connect Agent Broker\n.connect/\n');
    }
  }
  
  return policyPath;
}

