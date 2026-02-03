# Context Daemon Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTEXT DAEMON (ctxd)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   WATCHERS  │    │  CAPTURERS  │    │  PROCESSOR  │    │   WRITERS   │  │
│  │             │    │             │    │             │    │             │  │
│  │ • Files     │───▶│ • Prompts   │───▶│ • Intent    │───▶│ • Log       │  │
│  │ • Git       │    │ • Diffs     │    │   Inference │    │ • ADRs      │  │
│  │ • Clipboard │    │ • Commits   │    │ • Linking   │    │ • Lock      │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            .context/ DIRECTORY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  intent-log.jsonl    │ decisions/     │ context.lock    │ project.yaml     │
│  (append-only)       │ (ADRs)         │ (semantic hash) │ (auto-detected)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Watchers

Monitor various sources for AI coding activity.

#### FileWatcher
```typescript
interface FileWatcher {
  // Watch for file changes
  watch(paths: string[]): EventEmitter<FileEvent>;
  
  // Correlate changes with time windows
  getChangesInWindow(start: Date, end: Date): FileChange[];
}

interface FileEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
  timestamp: Date;
  diff?: string;
}
```

#### GitWatcher
```typescript
interface GitWatcher {
  // Watch for git operations
  onCommit(callback: (commit: Commit) => void): void;
  onStage(callback: (files: string[]) => void): void;
  
  // Get recent history
  getRecentCommits(n: number): Commit[];
  getDiff(commit: string): string;
}
```

#### ToolWatcher
```typescript
interface ToolWatcher {
  tool: 'claude-code' | 'cursor' | 'copilot' | 'windsurf';
  
  // Watch for AI interactions
  onPrompt(callback: (prompt: PromptEvent) => void): void;
  onResponse(callback: (response: ResponseEvent) => void): void;
}

interface PromptEvent {
  tool: string;
  prompt: string;
  timestamp: Date;
  sessionId?: string;
}
```

### 2. Capturers

Aggregate data from watchers into structured events.

```typescript
interface CapturedInteraction {
  id: string;
  timestamp: Date;
  
  // Source
  tool: string;
  prompt: string;
  
  // Changes
  filesBefore: FileSnapshot[];
  filesAfter: FileSnapshot[];
  diff: string;
  
  // Git (if available)
  commit?: string;
  branch?: string;
}
```

### 3. Processor

Transform raw captures into meaningful context.

#### Intent Inference
```typescript
interface IntentInferrer {
  // Analyze prompt + diff to extract intent
  infer(interaction: CapturedInteraction): Promise<InferredIntent>;
}

interface InferredIntent {
  // Classification
  category: 'feature' | 'bugfix' | 'refactor' | 'performance' | 'security' | 'docs';
  
  // Extracted meaning
  problem?: string;
  solution: string;
  alternatives?: string[];
  
  // Confidence
  confidence: number;
  
  // Relations
  relatedConcepts: string[];
  relatedFiles: string[];
}
```

#### ADR Generator
```typescript
interface ADRGenerator {
  // Detect if interaction is significant enough for ADR
  shouldGenerateADR(intent: InferredIntent): boolean;
  
  // Generate ADR from intent
  generate(intent: InferredIntent, interaction: CapturedInteraction): ADR;
}

interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  alternatives: { name: string; reason: string }[];
  consequences: string[];
  date: Date;
}
```

#### Lock Generator
```typescript
interface LockGenerator {
  // Generate semantic snapshot of project context
  generate(contextDir: string): ContextLock;
}

interface ContextLock {
  version: string;
  generated: Date;
  hash: string;
  
  summary: {
    architecture: string;
    keyDecisions: number;
    activeConstraints: number;
    domainTerms: number;
  };
  
  semanticIndex: SemanticEntry[];
}

interface SemanticEntry {
  concept: string;
  files: string[];
  decisions: string[];
  constraints?: string[];
  glossaryTerms?: string[];
}
```

### 4. Writers

Persist context to `.context/` directory.

```typescript
interface ContextWriter {
  // Append to intent log
  appendLog(entry: IntentLogEntry): void;
  
  // Write/update ADR
  writeADR(adr: ADR): void;
  
  // Update lock file
  updateLock(lock: ContextLock): void;
  
  // Update project config
  updateProject(project: ProjectConfig): void;
}
```

## Data Formats

### intent-log.jsonl

Append-only log of all AI interactions:

```jsonl
{"id":"int_001","ts":"2026-02-03T14:32:00Z","tool":"claude-code","prompt":"Add Redis cache for sessions","files":["src/auth/session.ts"],"diff":"a3f2c1d","intent":{"category":"performance","problem":"10k user bottleneck","solution":"Redis cache"},"commit":"feat: add redis cache"}
{"id":"int_002","ts":"2026-02-03T14:45:00Z","tool":"claude-code","prompt":"Fix the connection pool issue","files":["src/config/redis.ts"],"diff":"b4e3d2f","intent":{"category":"bugfix","problem":"connection leak","solution":"proper pool cleanup"},"commit":"fix: redis connection leak"}
```

### decisions/*.md

Auto-generated Architecture Decision Records:

```markdown
# ADR-003: Redis for Session Cache

**Date**: 2026-02-03
**Status**: Accepted
**Context ID**: int_001

## Context

Performance bottleneck observed with 10k concurrent users. Session lookups
were hitting the database on every request.

## Decision

Implement Redis as a session cache layer between the application and database.

## Alternatives Considered

| Alternative | Reason Rejected |
|------------|-----------------|
| Memcached | No persistence, fewer data structures |
| In-memory LRU | Doesn't scale horizontally |
| Database optimization | Wouldn't solve the fundamental I/O bottleneck |

## Consequences

### Positive
- Session lookups reduced from ~50ms to ~2ms
- Database load reduced by 80%

### Negative
- New infrastructure dependency
- Need to handle Redis connection failures
- Additional operational complexity

## Related

- Files: `src/auth/session.ts`, `src/config/redis.ts`
- Commits: `feat: add redis cache`, `fix: redis connection leak`
```

### context.lock

Semantic snapshot for AI consumption:

```yaml
ctx_version: "1.0"
generated: "2026-02-03T15:00:00Z"
hash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

project:
  name: my-ecommerce
  stack: [nuxt3, typescript, postgresql, redis]
  architecture: "Monorepo with API + Workers + Storefront"

summary:
  total_interactions: 156
  decisions: 12
  constraints: 5
  domain_terms: 23

semantic_index:
  - concept: authentication
    description: "User auth with JWT + Redis sessions"
    files:
      - src/auth/**
      - src/middleware/auth.ts
    decisions: [ADR-001, ADR-003]
    key_intents: [int_001, int_015, int_089]
    
  - concept: payments
    description: "Stripe integration with webhook handlers"
    files:
      - src/billing/**
      - src/webhooks/stripe.ts
    decisions: [ADR-002]
    constraints: [PCI-DSS]
    key_intents: [int_023, int_024]
    
  - concept: inventory
    description: "Real-time stock management"
    files:
      - src/inventory/**
    decisions: [ADR-007]
    domain_terms: [SKU, backorder, safety_stock]

constraints:
  - id: perf-001
    rule: "LCP must stay under 2.5s"
    enforced_since: "2026-01-15"
    
  - id: sec-001
    rule: "All user input must be sanitized"
    enforced_since: "2026-01-01"

glossary_snapshot:
  SKU: "Stock Keeping Unit - unique product identifier"
  AOV: "Average Order Value"
  LCP: "Largest Contentful Paint - Core Web Vital"
```

### project.yaml

Auto-detected project configuration:

```yaml
ctx_version: "1.0"
auto_detected: true
last_updated: "2026-02-03T15:00:00Z"

name: my-ecommerce
description: "E-commerce platform" # From package.json or README

stack:
  detected:
    - nuxt3        # From package.json
    - typescript   # From tsconfig.json
    - postgresql   # From .env / config
    - redis        # From config
  
language: typescript
package_manager: pnpm

structure:
  src: "Source code"
  src/api: "API routes"
  src/components: "Vue components"
  src/composables: "Shared logic"

# Human-editable overrides
ai_instructions: |
  - Follow existing patterns in composables/
  - All API calls through src/api/client.ts
```

## Daemon Lifecycle

### Startup

```
ctxd start
    │
    ├─▶ Load config from .context/daemon.yaml (or defaults)
    │
    ├─▶ Initialize watchers
    │   ├─▶ FileWatcher (chokidar)
    │   ├─▶ GitWatcher (git hooks)
    │   └─▶ ToolWatchers (per tool)
    │
    ├─▶ Load existing context
    │   └─▶ Parse .context/ if exists
    │
    ├─▶ Start event loop
    │
    └─▶ Write PID file, daemonize
```

### Event Processing

```
Event received (file change, prompt, commit)
    │
    ├─▶ Debounce (500ms window)
    │
    ├─▶ Correlate events
    │   └─▶ Match prompts with file changes and commits
    │
    ├─▶ Capture interaction
    │   └─▶ Bundle prompt + diff + commit
    │
    ├─▶ Infer intent
    │   └─▶ LLM analysis (local or API)
    │
    ├─▶ Check ADR threshold
    │   └─▶ If significant → generate ADR
    │
    ├─▶ Write to .context/
    │   ├─▶ Append intent-log.jsonl
    │   ├─▶ Write ADR if generated
    │   └─▶ Update context.lock (periodic)
    │
    └─▶ Emit event (for extensions)
```

### Shutdown

```
ctxd stop (or SIGTERM)
    │
    ├─▶ Flush pending writes
    │
    ├─▶ Update context.lock (final)
    │
    ├─▶ Close watchers
    │
    └─▶ Remove PID file, exit
```

## Tool Integration

### Claude Code

**Capture method**: Log file parsing

```
~/.claude/logs/
└── sessions/
    └── <session-id>/
        ├── messages.jsonl    ← Parse prompts
        └── events.jsonl      ← Parse tool calls
```

**Implementation**:
```typescript
class ClaudeCodeWatcher implements ToolWatcher {
  private logDir = path.join(os.homedir(), '.claude', 'logs');
  
  watch() {
    // Watch for new log files
    chokidar.watch(this.logDir).on('change', (file) => {
      this.parseLogFile(file);
    });
  }
  
  parseLogFile(file: string) {
    // Parse JSONL, extract prompts and responses
    // Emit events for each interaction
  }
}
```

### Cursor

**Capture method**: Extension API + log parsing

```typescript
class CursorWatcher implements ToolWatcher {
  // Option 1: VS Code extension that hooks into Cursor
  // Option 2: Parse Cursor's internal logs
  // Option 3: Intercept HTTP traffic to AI API (with permission)
}
```

### Generic (Clipboard)

**Capture method**: Clipboard monitoring (opt-in)

```typescript
class ClipboardWatcher implements ToolWatcher {
  // When user copies from AI chat → clipboard
  // Detect AI-like responses and correlate with file changes
  // Privacy-sensitive, requires explicit opt-in
}
```

## Intent Inference

### Local LLM (Default)

Use local model for privacy:

```typescript
class LocalIntentInferrer implements IntentInferrer {
  private model: Ollama; // or llama.cpp
  
  async infer(interaction: CapturedInteraction): Promise<InferredIntent> {
    const prompt = `
      Analyze this AI coding interaction:
      
      PROMPT: ${interaction.prompt}
      
      FILES CHANGED: ${interaction.files.join(', ')}
      
      DIFF:
      ${interaction.diff}
      
      Extract:
      1. Category (feature/bugfix/refactor/performance/security/docs)
      2. Problem being solved
      3. Solution implemented
      4. Alternatives that might have been considered
      
      Respond in JSON format.
    `;
    
    return this.model.generate(prompt);
  }
}
```

### API-based (Optional)

For better quality, use Claude/GPT API:

```typescript
class APIIntentInferrer implements IntentInferrer {
  private client: Anthropic | OpenAI;
  
  async infer(interaction: CapturedInteraction): Promise<InferredIntent> {
    // Similar prompt, better model
    // Requires API key configuration
  }
}
```

## Privacy Model

### Data Flow

```
AI Tool → Daemon (local) → .context/ (local) → Git (your choice)
              │
              └─▶ Never leaves your machine unless you commit
```

### Sensitive Data Handling

```typescript
interface PrivacyConfig {
  // Redact patterns from logs
  redactPatterns: RegExp[];
  
  // Files to never capture
  ignoreFiles: string[];
  
  // Pause capture temporarily
  pauseUntil?: Date;
}

// Default redactions
const defaultRedactions = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /bearer\s+\S+/i,
];
```

## Configuration

### .context/daemon.yaml

```yaml
# Daemon configuration
version: "1.0"

capture:
  enabled: true
  tools:
    claude-code: true
    cursor: true
    copilot: false  # Disabled
  clipboard: false  # Opt-in

inference:
  provider: local  # or 'anthropic', 'openai'
  model: llama3.2  # For local
  # api_key: env:ANTHROPIC_API_KEY  # For API

adr:
  auto_generate: true
  threshold: 0.8  # Confidence threshold
  
lock:
  update_frequency: "1h"  # Or 'on-commit'

privacy:
  redact_patterns:
    - "api[_-]?key"
    - "secret"
  ignore_files:
    - ".env*"
    - "*.pem"
```

## Future: Context Cloud

Optional team sync layer:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Dev A   │     │ Dev B   │     │ Dev C   │
│ ctxd    │     │ ctxd    │     │ ctxd    │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Context Cloud  │
            │                 │
            │ • Sync locks    │
            │ • Team glossary │
            │ • Shared ADRs   │
            │ • Analytics     │
            └─────────────────┘
```

Not required. Fully functional without cloud.
