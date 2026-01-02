import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';

interface ShellOptions {
  shell?: string;
  autoConnect?: boolean;
}

const CONFIG_FILENAMES = [
  'pconnect.yml',
  'pconnect.yaml',
  'pconnect.json',
  '.pconnect.yml',
  '.pconnect.yaml',
  '.pconnect.json',
];

type ShellType = 'zsh' | 'bash' | 'fish' | 'unknown';

/**
 * Get the current shell type
 */
function detectShell(): ShellType {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  return 'unknown';
}

/**
 * Generate shell initialization script
 */
function generateShellInit(shell: 'zsh' | 'bash' | 'fish', autoConnect: boolean): string {
  const stateFile = path.join(getConfigDir(), 'shell-state.json');

  if (shell === 'fish') {
    return `# Private Connect Shell Integration (fish)
# Add to ~/.config/fish/config.fish:
#   connect shell-init fish | source

# Connection status function
function __pconnect_status
    if test -f "${stateFile}"
        set -l count (cat "${stateFile}" 2>/dev/null | grep -o '"services":' | wc -l)
        if test $count -gt 0
            set -l service_count (cat "${stateFile}" 2>/dev/null | grep -c '"name"')
            if test $service_count -gt 0
                echo "($service_count services)"
            end
        end
    end
end

# Prompt integration
function fish_right_prompt
    set -l pconnect_status (__pconnect_status)
    if test -n "$pconnect_status"
        set_color cyan
        echo -n "● $pconnect_status"
        set_color normal
    end
end

${autoConnect ? `# Auto-connect on directory change
function __pconnect_autoconnect --on-variable PWD
    for config in ${CONFIG_FILENAMES.join(' ')}
        if test -f "$PWD/$config"
            # Check if already connected to this project
            set -l current_project (cat "${stateFile}" 2>/dev/null | grep -o '"project":"[^"]*"' | cut -d'"' -f4)
            if test "$current_project" != "$PWD"
                echo ""
                echo "📦 Found $config - connecting..."
                connect dev --background 2>/dev/null
            end
            break
        end
    end
end` : '# Auto-connect disabled. Enable with: connect shell-init --auto-connect'}
`;
  }

  // Bash/Zsh version
  const isZsh = shell === 'zsh';
  
  return `# Private Connect Shell Integration (${shell})
# Add to your ~/.${shell}rc:
#   eval "$(connect shell-init)"

# Connection status function
__pconnect_status() {
    if [[ -f "${stateFile}" ]]; then
        local service_count
        service_count=$(grep -c '"name"' "${stateFile}" 2>/dev/null || echo "0")
        if [[ "$service_count" -gt 0 ]]; then
            echo "($service_count services)"
        fi
    fi
}

# Prompt integration - shows connected services count
__pconnect_prompt() {
    local status=$(__pconnect_status)
    if [[ -n "$status" ]]; then
        echo " \\033[36m●\\033[0m $status"
    fi
}

${isZsh ? `# Zsh prompt integration
if [[ -z "$PCONNECT_PROMPT_ADDED" ]]; then
    export PCONNECT_PROMPT_ADDED=1
    # Add to right prompt
    RPROMPT='$(__pconnect_prompt)'"$RPROMPT"
fi` : `# Bash prompt integration
if [[ -z "$PCONNECT_PROMPT_ADDED" ]]; then
    export PCONNECT_PROMPT_ADDED=1
    # Append to PS1
    PS1="$PS1\\$(__pconnect_prompt)"
fi`}

${autoConnect ? `# Auto-connect on directory change
__pconnect_autoconnect() {
    local config_files=(${CONFIG_FILENAMES.join(' ')})
    for config in "\${config_files[@]}"; do
        if [[ -f "$PWD/$config" ]]; then
            # Check if already connected to this project
            local current_project
            current_project=$(grep -o '"project":"[^"]*"' "${stateFile}" 2>/dev/null | cut -d'"' -f4)
            if [[ "$current_project" != "$PWD" ]]; then
                echo ""
                echo "📦 Found $config - connecting..."
                connect dev --background 2>/dev/null
            fi
            break
        fi
    done
}

${isZsh ? `# Zsh hook
autoload -Uz add-zsh-hook
add-zsh-hook chpwd __pconnect_autoconnect

# Run on initial shell
__pconnect_autoconnect` : `# Bash hook using PROMPT_COMMAND
__pconnect_last_pwd=""
__pconnect_check_dir() {
    if [[ "$PWD" != "$__pconnect_last_pwd" ]]; then
        __pconnect_last_pwd="$PWD"
        __pconnect_autoconnect
    fi
}
PROMPT_COMMAND="__pconnect_check_dir;\${PROMPT_COMMAND}"

# Run on initial shell
__pconnect_autoconnect`}` : '# Auto-connect disabled. Enable with: connect shell-init --auto-connect'}

# Alias for quick status
alias pcs='connect status'
`;
}

/**
 * connect shell-init - Output shell initialization script
 */
export async function shellInitCommand(shell: string | undefined, options: ShellOptions) {
  let detectedShell: ShellType;
  
  if (shell === 'zsh' || shell === 'bash' || shell === 'fish') {
    detectedShell = shell;
  } else if (shell) {
    console.error(chalk.red(`\n✗ Unknown shell: ${shell}`));
    console.log(chalk.gray('  Supported shells: zsh, bash, fish\n'));
    process.exit(1);
    return; // TypeScript needs this
  } else {
    detectedShell = detectShell();
  }
  
  if (detectedShell === 'unknown') {
    console.error(chalk.red('\n✗ Could not detect shell type.'));
    console.log(chalk.gray('  Specify your shell: connect shell-init zsh|bash|fish\n'));
    process.exit(1);
    return; // TypeScript needs this
  }

  const autoConnect = options.autoConnect !== false;
  const script = generateShellInit(detectedShell, autoConnect);
  
  // Output to stdout (for eval)
  console.log(script);
}

/**
 * connect shell-setup - Interactive setup for shell integration
 */
export async function shellSetupCommand(options: ShellOptions) {
  const shell = detectShell();
  const rcFile = shell === 'zsh' ? '~/.zshrc' : shell === 'bash' ? '~/.bashrc' : '~/.config/fish/config.fish';
  
  console.log(chalk.cyan('\n🐚 Shell Integration Setup\n'));
  
  if (shell === 'unknown') {
    console.log(chalk.yellow('⚠ Could not detect your shell.'));
    console.log(chalk.gray('  Please manually add one of the following to your shell config:\n'));
    console.log(chalk.white('  For Zsh (~/.zshrc):'));
    console.log(chalk.cyan('    eval "$(connect shell-init zsh)"'));
    console.log();
    console.log(chalk.white('  For Bash (~/.bashrc):'));
    console.log(chalk.cyan('    eval "$(connect shell-init bash)"'));
    console.log();
    console.log(chalk.white('  For Fish (~/.config/fish/config.fish):'));
    console.log(chalk.cyan('    connect shell-init fish | source'));
    console.log();
    return;
  }

  console.log(chalk.white(`  Detected shell: ${chalk.cyan(shell)}`));
  console.log(chalk.white(`  Config file: ${chalk.cyan(rcFile)}`));
  console.log();

  const initLine = shell === 'fish' 
    ? 'connect shell-init fish | source'
    : `eval "$(connect shell-init ${shell})"`;

  console.log(chalk.white('  Add this line to your shell config:\n'));
  console.log(chalk.cyan(`    ${initLine}`));
  console.log();
  console.log(chalk.gray('  Then restart your shell or run:'));
  console.log(chalk.cyan(`    source ${rcFile}`));
  console.log();
  
  console.log(chalk.white('  Features:'));
  console.log(chalk.gray('    • Prompt shows connected services count'));
  console.log(chalk.gray('    • Auto-connects when entering project directories'));
  console.log(chalk.gray('    • Quick status alias: pcs'));
  console.log();

  // Try to detect if already installed
  const expandedRcFile = rcFile.replace('~', os.homedir());
  try {
    if (fs.existsSync(expandedRcFile)) {
      const content = fs.readFileSync(expandedRcFile, 'utf-8');
      if (content.includes('connect shell-init')) {
        console.log(chalk.green('  ✓ Shell integration already installed!\n'));
        return;
      }
    }
  } catch {
    // Ignore
  }

  console.log(chalk.yellow('  ⚠ Not yet installed. Add the line above to enable.\n'));
}

/**
 * Update shell state file (called by other commands)
 */
export function updateShellState(services: Array<{ name: string; port: number }>, project?: string): void {
  const stateFile = path.join(getConfigDir(), 'shell-state.json');
  const configDir = getConfigDir();
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const state = {
    services,
    project: project || process.cwd(),
    connectedAt: new Date().toISOString(),
  };

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Clear shell state (called on disconnect)
 */
export function clearShellState(): void {
  const stateFile = path.join(getConfigDir(), 'shell-state.json');
  try {
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  } catch {
    // Ignore
  }
}

