/**
 * Context Daemon (ctxd)
 * 
 * Automatic context capture for AI-assisted development.
 * Runs in background, captures prompts → code → intent.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chokidar from 'chokidar';

// =============================================================================
// TYPES
// =============================================================================

interface IntentLogEntry {
  id: string;
  ts: string;
  tool: string;
  session?: string;
  prompt: string;
  files: string[];
  diff_hash?: string;
  intent: InferredIntent;
  commit?: string;
  commit_msg?: string;
  adr_generated?: string;
}

interface InferredIntent {
  category: 'feature' | 'bugfix' | 'refactor' | 'performance' | 'security' | 'docs' | 'test';
  confidence: number;
  problem?: string;
  solution: string;
  alternatives?: string[];
  concepts?: string[];
}

interface CapturedInteraction {
  tool: string;
  prompt: string;
  timestamp: Date;
  files: string[];
  diff?: string;
}

interface DaemonConfig {
  capture: {
    enabled: boolean;
    tools: Record<string, { enabled: boolean; log_path?: string }>;
    clipboard: { enabled: boolean };
    ignore: string[];
  };
  inference: {
    provider: 'local' | 'anthropic' | 'openai';
    model?: string;
    min_confidence: number;
  };
  adr: {
    auto_generate: boolean;
    threshold: number;
  };
  lock: {
    update_frequency: string;
  };
  privacy: {
    redact_patterns: string[];
  };
}

// =============================================================================
// CONTEXT DAEMON
// =============================================================================

export class ContextDaemon extends EventEmitter {
  private config: DaemonConfig;
  private contextDir: string;
  private running: boolean = false;
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private pendingInteractions: CapturedInteraction[] = [];
  private intentCounter: number = 0;
  
  constructor(projectRoot: string, config?: Partial<DaemonConfig>) {
    super();
    this.contextDir = path.join(projectRoot, '.context');
    this.config = this.loadConfig(config);
  }
  
  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------
  
  async start(): Promise<void> {
    if (this.running) return;
    
    console.log('[ctxd] Starting Context Daemon...');
    
    // Ensure .context/ exists
    await this.ensureContextDir();
    
    // Load existing state
    await this.loadState();
    
    // Start watchers
    await this.startWatchers();
    
    this.running = true;
    this.emit('started');
    
    console.log('[ctxd] Daemon started. Capturing context...');
  }
  
  async stop(): Promise<void> {
    if (!this.running) return;
    
    console.log('[ctxd] Stopping daemon...');
    
    // Flush pending
    await this.flushPending();
    
    // Update lock
    await this.updateLock();
    
    // Close watchers
    for (const [name, watcher] of this.watchers) {
      await watcher.close();
      console.log(`[ctxd] Closed watcher: ${name}`);
    }
    
    this.running = false;
    this.emit('stopped');
    
    console.log('[ctxd] Daemon stopped.');
  }
  
  // ---------------------------------------------------------------------------
  // WATCHERS
  // ---------------------------------------------------------------------------
  
  private async startWatchers(): Promise<void> {
    // Claude Code watcher
    if (this.config.capture.tools['claude-code']?.enabled) {
      await this.startClaudeCodeWatcher();
    }
    
    // Git watcher
    await this.startGitWatcher();
    
    // File watcher (for correlation)
    await this.startFileWatcher();
  }
  
  private async startClaudeCodeWatcher(): Promise<void> {
    const logPath = this.config.capture.tools['claude-code']?.log_path 
      || path.join(os.homedir(), '.claude', 'logs');
    
    if (!fs.existsSync(logPath)) {
      console.log('[ctxd] Claude Code logs not found, skipping watcher');
      return;
    }
    
    const watcher = chokidar.watch(path.join(logPath, '**/*.jsonl'), {
      persistent: true,
      ignoreInitial: true,
    });
    
    watcher.on('change', async (filePath) => {
      await this.parseClaudeCodeLog(filePath);
    });
    
    this.watchers.set('claude-code', watcher);
    console.log('[ctxd] Claude Code watcher started');
  }
  
  private async startGitWatcher(): Promise<void> {
    // Watch .git/logs/HEAD for commits
    const gitLogsPath = path.join(process.cwd(), '.git', 'logs', 'HEAD');
    
    if (!fs.existsSync(gitLogsPath)) {
      console.log('[ctxd] Git logs not found, skipping watcher');
      return;
    }
    
    const watcher = chokidar.watch(gitLogsPath, {
      persistent: true,
      ignoreInitial: true,
    });
    
    watcher.on('change', async () => {
      await this.handleGitChange();
    });
    
    this.watchers.set('git', watcher);
    console.log('[ctxd] Git watcher started');
  }
  
  private async startFileWatcher(): Promise<void> {
    const watcher = chokidar.watch('.', {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.context/**',
        ...this.config.capture.ignore,
      ],
    });
    
    watcher.on('change', (filePath) => {
      this.trackFileChange(filePath);
    });
    
    this.watchers.set('files', watcher);
    console.log('[ctxd] File watcher started');
  }
  
  // ---------------------------------------------------------------------------
  // CAPTURE
  // ---------------------------------------------------------------------------
  
  private async parseClaudeCodeLog(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Look for user messages (prompts)
          if (entry.role === 'user' && entry.content) {
            const prompt = typeof entry.content === 'string' 
              ? entry.content 
              : entry.content.map((c: any) => c.text || '').join(' ');
            
            if (prompt.length > 10) { // Ignore very short prompts
              this.capturePrompt('claude-code', prompt);
            }
          }
        } catch {
          // Skip invalid lines
        }
      }
    } catch (error) {
      console.error('[ctxd] Error parsing Claude Code log:', error);
    }
  }
  
  private capturePrompt(tool: string, prompt: string): void {
    // Redact sensitive content
    const redactedPrompt = this.redactSensitive(prompt);
    
    const interaction: CapturedInteraction = {
      tool,
      prompt: redactedPrompt,
      timestamp: new Date(),
      files: [...this.recentChangedFiles],
    };
    
    this.pendingInteractions.push(interaction);
    this.emit('prompt-captured', interaction);
    
    // Process after a delay (to capture related file changes)
    setTimeout(() => this.processInteraction(interaction), 2000);
  }
  
  private recentChangedFiles: Set<string> = new Set();
  private fileChangeTimeout: NodeJS.Timeout | null = null;
  
  private trackFileChange(filePath: string): void {
    this.recentChangedFiles.add(filePath);
    
    // Clear old changes after 30 seconds
    if (this.fileChangeTimeout) clearTimeout(this.fileChangeTimeout);
    this.fileChangeTimeout = setTimeout(() => {
      this.recentChangedFiles.clear();
    }, 30000);
  }
  
  private async handleGitChange(): Promise<void> {
    // Link recent interactions to commits
    const recentCommit = await this.getRecentCommit();
    if (recentCommit && this.pendingInteractions.length > 0) {
      const interaction = this.pendingInteractions[this.pendingInteractions.length - 1];
      await this.linkToCommit(interaction, recentCommit);
    }
  }
  
  // ---------------------------------------------------------------------------
  // PROCESSING
  // ---------------------------------------------------------------------------
  
  private async processInteraction(interaction: CapturedInteraction): Promise<void> {
    try {
      // Infer intent
      const intent = await this.inferIntent(interaction);
      
      // Create log entry
      const entry: IntentLogEntry = {
        id: `int_${String(++this.intentCounter).padStart(3, '0')}`,
        ts: interaction.timestamp.toISOString(),
        tool: interaction.tool,
        prompt: interaction.prompt,
        files: interaction.files,
        intent,
      };
      
      // Append to log
      await this.appendIntentLog(entry);
      
      // Generate ADR if significant
      if (this.config.adr.auto_generate && intent.confidence >= this.config.adr.threshold) {
        const adrId = await this.generateADR(entry);
        entry.adr_generated = adrId;
      }
      
      this.emit('intent-logged', entry);
      
    } catch (error) {
      console.error('[ctxd] Error processing interaction:', error);
    }
  }
  
  private async inferIntent(interaction: CapturedInteraction): Promise<InferredIntent> {
    // Simple rule-based inference for now
    // TODO: Replace with LLM inference
    
    const prompt = interaction.prompt.toLowerCase();
    
    let category: InferredIntent['category'] = 'feature';
    if (prompt.includes('fix') || prompt.includes('bug')) category = 'bugfix';
    else if (prompt.includes('refactor')) category = 'refactor';
    else if (prompt.includes('perf') || prompt.includes('optim') || prompt.includes('fast')) category = 'performance';
    else if (prompt.includes('secur') || prompt.includes('auth')) category = 'security';
    else if (prompt.includes('doc') || prompt.includes('comment')) category = 'docs';
    else if (prompt.includes('test')) category = 'test';
    
    // Extract problem/solution (naive)
    const solution = interaction.prompt.slice(0, 100);
    
    return {
      category,
      confidence: 0.7, // Default confidence for rule-based
      solution,
      concepts: this.extractConcepts(interaction.prompt),
    };
  }
  
  private extractConcepts(text: string): string[] {
    // Simple keyword extraction
    const keywords = [
      'auth', 'cache', 'database', 'api', 'ui', 'test',
      'performance', 'security', 'payment', 'user', 'session',
    ];
    
    return keywords.filter(kw => text.toLowerCase().includes(kw));
  }
  
  // ---------------------------------------------------------------------------
  // WRITING
  // ---------------------------------------------------------------------------
  
  private async appendIntentLog(entry: IntentLogEntry): Promise<void> {
    const logPath = path.join(this.contextDir, 'intent-log.jsonl');
    const line = JSON.stringify(entry) + '\n';
    await fs.promises.appendFile(logPath, line);
  }
  
  private async generateADR(entry: IntentLogEntry): Promise<string> {
    const adrDir = path.join(this.contextDir, 'decisions');
    await fs.promises.mkdir(adrDir, { recursive: true });
    
    // Find next ADR number
    const existing = await fs.promises.readdir(adrDir).catch(() => []);
    const nextNum = existing.length + 1;
    const adrId = `ADR-${String(nextNum).padStart(3, '0')}`;
    
    const content = `# ${adrId}: ${entry.intent.solution.slice(0, 50)}

**ID**: ${adrId}
**Date**: ${new Date().toISOString().split('T')[0]}
**Status**: Accepted
**Source**: Auto-generated from ${entry.id}
**Confidence**: ${entry.intent.confidence}

## Context

${entry.intent.problem || 'Context inferred from AI interaction.'}

Original prompt:
> "${entry.prompt.slice(0, 200)}${entry.prompt.length > 200 ? '...' : ''}"

## Decision

${entry.intent.solution}

## Files Modified

${entry.files.map(f => `- \`${f}\``).join('\n')}

## Related

- **Intent**: ${entry.id}
- **Concepts**: ${entry.intent.concepts?.join(', ') || 'N/A'}
`;
    
    const adrPath = path.join(adrDir, `${adrId}.md`);
    await fs.promises.writeFile(adrPath, content);
    
    console.log(`[ctxd] Generated ${adrId}`);
    return adrId;
  }
  
  private async updateLock(): Promise<void> {
    // TODO: Generate context.lock from intent log + project analysis
    console.log('[ctxd] Updating context.lock...');
  }
  
  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  
  private loadConfig(override?: Partial<DaemonConfig>): DaemonConfig {
    const defaults: DaemonConfig = {
      capture: {
        enabled: true,
        tools: {
          'claude-code': { enabled: true },
          'cursor': { enabled: false },
          'copilot': { enabled: false },
        },
        clipboard: { enabled: false },
        ignore: ['*.env*', '*.pem', '*.key'],
      },
      inference: {
        provider: 'local',
        model: 'llama3.2',
        min_confidence: 0.5,
      },
      adr: {
        auto_generate: true,
        threshold: 0.8,
      },
      lock: {
        update_frequency: '1h',
      },
      privacy: {
        redact_patterns: ['api[_-]?key', 'secret', 'password', 'token'],
      },
    };
    
    // Try to load from file
    const configPath = path.join(this.contextDir, 'daemon.yaml');
    if (fs.existsSync(configPath)) {
      // TODO: Parse YAML and merge
    }
    
    return { ...defaults, ...override };
  }
  
  private async ensureContextDir(): Promise<void> {
    await fs.promises.mkdir(this.contextDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.contextDir, 'decisions'), { recursive: true });
  }
  
  private async loadState(): Promise<void> {
    // Load intent counter from existing log
    const logPath = path.join(this.contextDir, 'intent-log.jsonl');
    if (fs.existsSync(logPath)) {
      const content = await fs.promises.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      this.intentCounter = lines.length;
    }
  }
  
  private async flushPending(): Promise<void> {
    // Process any remaining interactions
    for (const interaction of this.pendingInteractions) {
      await this.processInteraction(interaction);
    }
    this.pendingInteractions = [];
  }
  
  private redactSensitive(text: string): string {
    let result = text;
    for (const pattern of this.config.privacy.redact_patterns) {
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, '[REDACTED]');
    }
    return result;
  }
  
  private async getRecentCommit(): Promise<string | null> {
    // TODO: Get most recent commit SHA
    return null;
  }
  
  private async linkToCommit(interaction: CapturedInteraction, commit: string): Promise<void> {
    // TODO: Update intent log entry with commit info
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const daemon = new ContextDaemon(process.cwd());
  
  switch (command) {
    case 'start':
      await daemon.start();
      // Keep alive
      process.on('SIGINT', async () => {
        await daemon.stop();
        process.exit(0);
      });
      break;
      
    case 'stop':
      // TODO: Send stop signal to running daemon
      console.log('Stopping daemon...');
      break;
      
    case 'status':
      // TODO: Check if daemon is running
      console.log('Daemon status: unknown');
      break;
      
    default:
      console.log(`
Context Daemon (ctxd)

Usage:
  ctxd start     Start the daemon
  ctxd stop      Stop the daemon  
  ctxd status    Check daemon status

The daemon captures AI coding interactions and builds
project context automatically.
      `);
  }
}

main().catch(console.error);
