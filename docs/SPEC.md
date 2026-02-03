# Context Daemon Specification v0.1

> Automatic context capture for AI-assisted development

## Overview

Context Daemon (`ctxd`) is a background service that captures the intent behind AI-assisted code changes. It creates a `.context/` directory that serves as the "memory" of why code exists.

## Core Principles

1. **Invisible capture** — Zero workflow change for developers
2. **Explicit reading** — Context is always human-inspectable
3. **Portable** — Clone repo = clone understanding
4. **Privacy-first** — All data local by default

## Directory Structure

```
.context/
├── daemon.yaml          # Daemon configuration
├── intent-log.jsonl     # All AI interactions (append-only)
├── context.lock         # Semantic snapshot
├── project.yaml         # Project config (auto-detected + manual)
├── constraints.yaml     # Rules and boundaries
├── glossary.yaml        # Domain terminology
└── decisions/           # Auto-generated ADRs
    ├── ADR-001.md
    ├── ADR-002.md
    └── ...
```

## File Specifications

### intent-log.jsonl

Append-only log of AI interactions. One JSON object per line.

```jsonl
{
  "id": "int_001",
  "ts": "2026-02-03T14:32:00Z",
  "tool": "claude-code",
  "session": "sess_abc123",
  "prompt": "Add Redis cache for user sessions, we have perf issues at 10k users",
  "files": ["src/auth/session.ts", "src/config/redis.ts"],
  "diff_hash": "a3f2c1d",
  "intent": {
    "category": "performance",
    "confidence": 0.92,
    "problem": "scaling bottleneck at 10k concurrent users",
    "solution": "Redis session cache",
    "alternatives": ["memcached", "in-memory LRU"],
    "concepts": ["caching", "sessions", "scalability"]
  },
  "commit": "a1b2c3d",
  "commit_msg": "feat: add redis session cache",
  "adr_generated": "ADR-003"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (int_XXX) |
| `ts` | ISO 8601 | ✅ | Timestamp |
| `tool` | string | ✅ | AI tool used |
| `session` | string | ❌ | Tool session ID |
| `prompt` | string | ✅ | User's prompt/request |
| `files` | string[] | ✅ | Files modified |
| `diff_hash` | string | ❌ | Hash of the diff |
| `intent` | object | ✅ | Inferred intent (see below) |
| `commit` | string | ❌ | Git commit SHA |
| `commit_msg` | string | ❌ | Commit message |
| `adr_generated` | string | ❌ | ADR ID if generated |

**Intent object:**

| Field | Type | Description |
|-------|------|-------------|
| `category` | enum | feature, bugfix, refactor, performance, security, docs, test |
| `confidence` | number | 0-1 confidence score |
| `problem` | string | Problem being solved |
| `solution` | string | Solution implemented |
| `alternatives` | string[] | Alternatives considered |
| `concepts` | string[] | Related concepts |

### context.lock

Semantic snapshot of project understanding. Updated periodically.

```yaml
ctx_version: "0.1"
generated: "2026-02-03T15:00:00Z"
hash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

project:
  name: "my-ecommerce"
  description: "E-commerce platform on Nuxt 3"
  stack: ["nuxt3", "typescript", "postgresql", "redis"]
  language: "typescript"

stats:
  total_interactions: 156
  first_interaction: "2026-01-15T10:00:00Z"
  last_interaction: "2026-02-03T14:45:00Z"
  decisions_count: 12
  constraints_count: 5
  glossary_terms: 23

# Semantic index for AI consumption
semantic_index:
  - concept: "authentication"
    summary: "JWT-based auth with Redis session cache"
    confidence: 0.95
    files:
      - "src/auth/**"
      - "src/middleware/auth.ts"
    decisions: ["ADR-001", "ADR-003"]
    recent_intents: ["int_001", "int_015"]
    
  - concept: "payments"
    summary: "Stripe integration with webhook handlers"
    confidence: 0.88
    files:
      - "src/billing/**"
    decisions: ["ADR-002"]
    constraints: ["PCI-DSS compliance"]
    glossary_terms: ["AOV", "chargeback"]

# Active constraints
constraints:
  - id: "perf-001"
    rule: "LCP must stay under 2.5s"
    source: "manual"  # or "inferred"
    
  - id: "sec-001"
    rule: "All user input must be sanitized"
    source: "inferred"
    from_intent: "int_045"

# Glossary snapshot (most used terms)
glossary:
  SKU: "Stock Keeping Unit - unique product identifier"
  AOV: "Average Order Value"
  LCP: "Largest Contentful Paint"
```

### decisions/ADR-XXX.md

Auto-generated Architecture Decision Records.

```markdown
# ADR-003: Redis for Session Cache

**ID**: ADR-003
**Date**: 2026-02-03
**Status**: Accepted
**Source**: Auto-generated from int_001
**Confidence**: 0.92

## Context

Performance bottleneck observed with 10k concurrent users. Session lookups
were hitting the database on every request, causing ~50ms latency.

Original prompt:
> "Add Redis cache for user sessions, we have perf issues at 10k users"

## Decision

Implement Redis as a session cache layer between the application and database.

## Alternatives Considered

| Alternative | Reason Rejected |
|------------|-----------------|
| Memcached | No persistence, fewer data structures |
| In-memory LRU | Doesn't scale horizontally across instances |

## Implementation

Files modified:
- `src/auth/session.ts` - Session middleware with Redis lookup
- `src/config/redis.ts` - Redis connection configuration

## Consequences

### Positive
- Session lookups reduced from ~50ms to ~2ms
- Database load significantly reduced

### Negative
- New infrastructure dependency (Redis)
- Need to handle connection failures gracefully
- Additional operational complexity

## Related

- **Intents**: int_001, int_002 (connection pool fix)
- **Commits**: a1b2c3d, b2c3d4e
- **Concepts**: caching, sessions, performance, scalability
```

### project.yaml

Project configuration. Auto-detected with manual overrides.

```yaml
ctx_version: "0.1"
auto_detected: true
last_scan: "2026-02-03T15:00:00Z"

# Auto-detected
name: "my-ecommerce"
description: "E-commerce platform"  # From package.json
stack:
  - nuxt3        # Detected from package.json
  - typescript   # Detected from tsconfig.json
  - postgresql   # Detected from .env
  - redis        # Detected from config

language: typescript
package_manager: pnpm  # Detected from lockfile

structure:
  src: "Source code"
  src/api: "API routes"
  src/components: "Vue components"
  src/composables: "Shared composables"

# Manual overrides (human-editable)
overrides:
  ai_instructions: |
    - Follow existing patterns in composables/
    - All API calls go through src/api/client.ts
    - Use Pinia for state management
    
  key_files:
    - src/api/client.ts    # API abstraction
    - src/types/index.ts   # Shared types
```

### constraints.yaml

Rules the AI must follow. Mix of inferred and manual.

```yaml
ctx_version: "0.1"

# Inferred from intent history
inferred:
  - id: "inf-001"
    rule: "Use TypeScript strict mode"
    confidence: 0.95
    from_intents: ["int_012", "int_034"]
    
  - id: "inf-002"
    rule: "API errors must return consistent shape"
    confidence: 0.88
    from_intents: ["int_056"]

# Manually specified
manual:
  - id: "man-001"
    rule: "Never commit secrets or API keys"
    severity: critical
    
  - id: "man-002"
    rule: "All components must have TypeScript props"
    severity: warning
    
  - id: "man-003"
    rule: "LCP must stay under 2.5s"
    severity: error
    metric: true

# Forbidden patterns
forbidden:
  - pattern: "console.log"
    context: "production code"
    
  - pattern: "any"
    context: "without explicit comment"
    
  - pattern: "@ts-ignore"
    context: "without explanation"
```

### glossary.yaml

Domain terminology. Auto-learned and manually extended.

```yaml
ctx_version: "0.1"

# Auto-learned from prompts/code
learned:
  SKU:
    definition: "Stock Keeping Unit - unique product identifier"
    confidence: 0.95
    first_seen: "int_023"
    occurrences: 45
    
  backorder:
    definition: "Order placed for out-of-stock items"
    confidence: 0.82
    first_seen: "int_067"
    occurrences: 12

# Manually defined
manual:
  AOV:
    definition: "Average Order Value"
    formula: "total_revenue / number_of_orders"
    context: "Key metric for marketing team"
    
  Flash Sale:
    definition: "Time-limited discount event"
    constraints:
      - "Max 72h duration"
      - "Requires inventory lock"
```

### daemon.yaml

Daemon configuration.

```yaml
ctx_version: "0.1"

# Capture settings
capture:
  enabled: true
  
  tools:
    claude-code:
      enabled: true
      log_path: "~/.claude/logs"
      
    cursor:
      enabled: true
      method: "extension"  # or "logs"
      
    copilot:
      enabled: false
      
  # Generic clipboard capture (opt-in)
  clipboard:
    enabled: false
    
  # File patterns to ignore
  ignore:
    - ".env*"
    - "*.pem"
    - "*.key"
    - "node_modules/**"

# Intent inference
inference:
  provider: "local"  # "local", "anthropic", "openai"
  model: "llama3.2"  # For local provider
  
  # API provider settings (if not local)
  # api_key: "env:ANTHROPIC_API_KEY"
  
  # Confidence threshold for logging
  min_confidence: 0.5

# ADR generation
adr:
  auto_generate: true
  threshold: 0.8  # Min confidence to generate
  require_review: false  # Mark as draft if true

# Lock file
lock:
  update_frequency: "1h"  # or "on-commit", "manual"
  include_full_index: true

# Privacy
privacy:
  redact_patterns:
    - "api[_-]?key"
    - "secret"
    - "password"
    - "token"
    - "bearer\\s+\\S+"
```

## CLI Specification

### Daemon Commands

```bash
# Start daemon in background
ctxd start [--foreground]

# Stop daemon
ctxd stop

# Restart daemon
ctxd restart

# Check status
ctxd status

# View daemon logs
ctxd logs [--follow]
```

### Context Commands

```bash
# Initialize .context/ in current repo
ctx init

# View intent log
ctx log [--since <duration>] [--limit <n>] [--tool <name>]

# View specific intent
ctx show <intent-id>

# List decisions/ADRs
ctx decisions [--status <accepted|draft|superseded>]

# View specific ADR
ctx adr <adr-id>

# Ask why something exists
ctx why <file-or-path>

# Search context
ctx search <query>
```

### Management Commands

```bash
# Update context.lock
ctx lock [--force]

# Export for AI consumption
ctx export [--format <md|json|yaml>] [--output <file>]

# Validate .context/ structure
ctx validate

# Clean old entries
ctx clean [--before <date>] [--dry-run]

# Redact sensitive entry
ctx redact <intent-id> [--field <field>]

# Pause capture temporarily
ctx pause [--until <duration>]
ctx resume
```

### Migration Commands

```bash
# Import from other formats
ctx migrate --from cursor    # .cursorrules
ctx migrate --from claude    # CLAUDE.md, AGENTS.md
ctx migrate --from adr       # Existing ADR directory
```

## AI Tool Integration Protocol

### Reading Context

AI tools should:

1. **Detect** `.context/` at repo root
2. **Load** `context.lock` for semantic overview
3. **Load** relevant `decisions/` based on files being edited
4. **Respect** `constraints.yaml` as hard rules
5. **Reference** `glossary.yaml` for domain terms

### Recommended Context Injection

```
System prompt:
├── project.yaml → ai_instructions
├── constraints.yaml → "RULES YOU MUST FOLLOW"
└── context.lock → semantic_index (relevant concepts)

Per-request:
├── Relevant ADRs based on files
├── Glossary terms that appear in conversation
└── Recent related intents (optional)
```

### Writing Context (Optional)

AI tools MAY write to `.context/` if they support it:

1. **Append** to `intent-log.jsonl` with tool identifier
2. **Never modify** existing entries
3. **Follow** the schema exactly

## Versioning

- Spec version in `ctx_version` field
- Files without version assumed v0.1
- Breaking changes increment minor version in 0.x
- Stable release will be 1.0

## Privacy Considerations

1. **Local-first**: All data in `.context/` stays local
2. **Gitignore option**: Can ignore `intent-log.jsonl` if sensitive
3. **Redaction**: Built-in patterns for secrets, manual redaction available
4. **Pause/resume**: Temporarily disable capture
5. **No telemetry**: Daemon never phones home

---

*Context Daemon Specification v0.1 — Draft*
*Last updated: 2026-02-03*
